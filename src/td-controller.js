const fetch = require('node-fetch');
const errorsDB = require("./errors-db");
const ERROR_LOG_CHANNEL_ID = global.config.ERROR_LOG_CHANNEL_ID;
const MAX_DOMAIN_ERRORS = global.config.MAX_DOMAIN_ERRORS;

const WELCOME_MESSAGE = config.WELCOME_MESSAGE;
const SIGNATURE_MESSAGE = config.SIGNATURE_MESSAGE;

var TD_CREATION_STATUS = {
	'ERROR': -1,
	'INIT': 0,
	'TD_CREATED': 1,
	'TD_SHARED': 2,
	'TD_LEFT': 3,
	'ALL_DONE': 4
};

module.exports = {
	processTDRequest: async (bot, msg, user, selectedDomain) => {
		var tdGenerator = new TDGenerator(selectedDomain, user.current_td_request.email, user.current_td_request.td_name);
		tdGenerator.user = user;

		tdGenerator.status(bot, msg, TD_CREATION_STATUS.INIT);
		
		//Load Access Token
		if(!await tdGenerator.getAccessToken()){
			return await tdGenerator.status(bot, msg, TD_CREATION_STATUS.ERROR);
		}
		console.log("Access token generated.");

		

		//Create TD
		if(!await tdGenerator.createTD()){
			return await tdGenerator.status(bot, msg, TD_CREATION_STATUS.ERROR);
		}
		tdGenerator.status(bot, msg, TD_CREATION_STATUS.TD_CREATED);
		console.log(`TD created. ID - ${tdGenerator.teamDriveId}`);


		//Share TD
		if(!await tdGenerator.allowOutsiders()){
			return await tdGenerator.status(bot, msg, TD_CREATION_STATUS.ERROR);
		}
		if(!await tdGenerator.getCurrentPermissionID()){
			return await tdGenerator.status(bot, msg, TD_CREATION_STATUS.ERROR);
		}
		if(!await tdGenerator.shareTD()){
			return await tdGenerator.status(bot, msg, TD_CREATION_STATUS.ERROR);
		}
		tdGenerator.status(bot, msg, TD_CREATION_STATUS.TD_SHARED);
		console.log("TD shared.");


		//Leave TD
		if(!await tdGenerator.leaveTD()){
			return await tdGenerator.status(bot, msg, TD_CREATION_STATUS.ERROR);
		}
		tdGenerator.status(bot, msg, TD_CREATION_STATUS.TD_LEFT);
		console.log("TD left.");

		tdGenerator.status(bot, msg, TD_CREATION_STATUS.ALL_DONE);
		console.log("All complete.");

		return true;
	}
}

class TDGenerator{

	constructor(domain, email, td_name){
		this.user = undefined;
		this.email = email;
		this.td_name = td_name;
		this.domain = domain;
		this.teamDriveId = undefined;
		this.myPermissionID = undefined;

		this.error = "Domain: " + this.domain.name + "\n\n";

		//Flag to decide if this error was due to bad input by users?
		//Decides based on known error messages provided in errors-db
		//So if the custom error message is found for an error, it is believed that the error is caused due to user input and not domain
		this.isUserError = false;

		return this;
	}

	//Function to process error generated for a domain
	domainError(){
		this.domain.access_token = "";
		this.domain.access_token_expires = undefined;

		if(this.isUserError){
			this.user.inputError = true;
			return;
		}

		if(this.domain.errors == undefined) { this.domain.errors = []; }
		this.domain.errors.push(this.error);
		if(this.domain.errors.length >= MAX_DOMAIN_ERRORS){
			this.domain.disabled = true;
		}
	}

	//Function to clear any previous errors on domain
	//Would still be in the Error Log Channel for review
	domainFine(){
		this.domain.errors = [];
		this.domain.disabled = false;
	}

	getErrorMessage(errorFunction, errorKey){
		
		try{
			if(errorsDB[errorFunction] == undefined){
				return errorsDB["default"];
			}

			if(errorKey != undefined && errorsDB[errorFunction][errorKey] != undefined){
				//Error due to bad input by user
				this.isUserError = true;
				return errorsDB[errorFunction][errorKey];
			}

			
			return errorsDB[errorFunction]["default"];
		}catch(ex){
			return errorsDB["default"];
		}
	}


	async getAccessToken() {
		//Get Access Token for the selected domain
		
		var now = new Date();
		if(this.domain.access_token !== undefined && this.domain.access_token !== "" && this.domain.access_token_expires > now){
			//Reusing a fresh token
			return this.domain.access_token;
		}

		const url = "https://www.googleapis.com/oauth2/v4/token";
		
		const body = {
			client_id: this.domain.client_id,
			client_secret: this.domain.client_secret,
			refresh_token: this.domain.refresh_token,
			grant_type: "refresh_token",
		};

		let options = {
			'method': "post",
			'body': JSON.stringify(body),
			'headers': {'Content-Type': 'application/json'}
		};

		//ERROR HANDLING
		let response = await fetch(url, options);
		if(response.status != 200){ //HTTP_OK
			var response_text = await response.text();
			this.error += this.getErrorMessage("getAccessToken") + "\n\n";
			this.error += "Error: #E1_AT1 \n";
			this.error += response_text;

			return false;
		}
		
		var access_response;
		try{access_response = await response.json(); }
		catch(ex){
			this.error += this.getErrorMessage("getAccessToken") + "\n\n";
			this.error += "Error: #E1_AT2 Couldn't parse AT response.";
			return false;
		}

		if(!access_response.access_token){
			this.error += this.getErrorMessage("getAccessToken") + "\n\n";
			this.error += "Error: #E1_AT3 Couldn't find AT in response.";
			return false;
		}
		
		//ALL OK THEN
		this.domain.access_token = access_response.access_token;
		var expiration = new Date();
		expiration.setSeconds(expiration.getSeconds() + 59*60);
		this.domain.access_token_expires = expiration;
		return true;
	}

	async createTD(){
		//Request to create TD under owner's permissions
		let url = "https://www.googleapis.com/drive/v3/drives";
		url += "?requestId=" + uuidv4();

		var options = {
			'method': 'post',
			'contentType': 'application/json',
			'body': JSON.stringify({'name': this.td_name,}),
			'headers': {'authorization' : "Bearer " + this.domain.access_token, 'Content-Type': 'application/json'}
		}

		//ERROR HANDLING
		let response = await fetch(url, options);
		if(response.status != 200){ //HTTP_OK
			var response_text = await response.text();

			//Getting custom error response based on API error code
			var resp_json, reason;
			try{ resp_json = JSON.parse(response_text); reason = resp_json.error.errors[0].reason; } catch(ex){}
			if(reason != undefined){
				this.error += this.getErrorMessage("createTD", reason) + "\n\n";
			}else{
				this.error += this.getErrorMessage("createTD") + "\n\n";
			}

			
			this.error += "Error: #E2_CTD1 \n";
			this.error += response_text;

			return false;
		}

		var response_json;
		try{ response_json = await response.json(); }
		catch(ex){
			this.error += this.getErrorMessage("createTD")+ "\n\n";
			this.error += "Error: #E2_CTD2 Couldn't parse CTD response.";
			return false;
		}

		if(!response_json.id){
			this.error += this.getErrorMessage("createTD") + "\n\n";
			this.error += "Error: #E2_CTD3 Couldn't find TDID in response.";
			return false;

		}

		//ALL OK THEN
		this.teamDriveId = response_json.id;
		return true;
	}

	//Function specific to circumvent bans by Organisation to be shared outside
	async allowOutsiders(){
		//Allowing the TD to be shared with outsiders
	  	let url = "https://www.googleapis.com/drive/v3/drives/"+this.teamDriveId;

	  	var options = {
		    'method': 'patch',
		    'body': JSON.stringify({ 'restrictions': { 'domainUsersOnly': false } }),
		    'headers': {'authorization' : "Bearer " + this.domain.access_token, 'Content-Type': 'application/json'}
	  	}

	  	//ERROR HANDLING
		let response = await fetch(url, options);
		if(response.status != 200){ //HTTP_OK
			var response_text = await response.text();
			this.error += this.getErrorMessage("allowOutsiders") + "\n\n";
			this.error += "Error: #E3_AO1 \n";
			this.error += response_text;
			
			return false;
		}
	  
	  	//ALL OK THEN
	 	return true;
	}

	async getCurrentPermissionID(){
		// Get created drive user permission ID i.e. owner's permission id, so that he can leave after sharing
		let url = `https://www.googleapis.com/drive/v3/files/${this.teamDriveId}/permissions`;
		var params = { 
		    supportsAllDrives: true,
		    fields:  "permissions(id,emailAddress)"
	  	};
		url += "?" + enQuery(params);

	  	let options = {
	    	'headers': {'authorization' : "Bearer " + this.domain.access_token}
	  	};

	  	//ERROR HANDLING
	  	let response = await fetch(url, options);
	  	if(response.status != 200){ //HTTP_OK
			var response_text = await response.text();
			this.error += this.getErrorMessage("getCurrentPermissionID") + "\n\n";
			this.error += "Error: #E4_CPID1 \n";
			this.error += response_text;

			return false;
		}

		var response_json;
		try{response_json = await response.json(); }
		catch(ex){
			this.error += this.getErrorMessage("getCurrentPermissionID") + "\n\n";
			this.error += "Error: #E4_CPID2 Couldn't parse CPID response.";
			return false;
		}

		if(!response_json.permissions || response_json.permissions.length == 0 || !response_json.permissions[0].id){
			this.error += this.getErrorMessage("getCurrentPermissionID") + "\n\n";
			this.error += "Error: #E4_CPID3 Couldn't find CPID in response.";
			return false;

		}

		//ALL OK THEN
		this.myPermissionID = response_json.permissions[0].id;
		return true;
	}


	async shareTD(){
		// Share team drive with email address
		var url = `https://www.googleapis.com/drive/v3/files/${this.teamDriveId}/permissions`;
		var params = { supportsAllDrives: true };
		url += "?" + enQuery(params);

	  	var options = {
		    'method': 'post',
		    
		    'body': JSON.stringify({ role: "organizer", type: "user", emailAddress: this.email }),
		    'headers': {'authorization' : "Bearer " + this.domain.access_token, 'Content-Type': 'application/json'}
	  	}

	  	//ERROR HANDLING
	  	var response = await fetch(url, options);
	  	if(response.status != 200){ //HTTP_OK
			var response_text = await response.text();

			//Getting custom error response based on API error code
			var resp_json, reason;
			try{ resp_json = JSON.parse(response_text); reason = resp_json.error.errors[0].reason; } catch(ex){ console.error(ex);}
			if(reason != undefined){
				this.error += this.getErrorMessage("shareTD", reason) + "\n\n";
			}else{
				this.error += this.getErrorMessage("shareTD") + "\n\n";
			}

			this.error += "Error: #E5_STD1 \n";
			this.error += response_text;

			return false;
		}

		//ALL OK THEN
	  	return true;
	}

	async leaveTD(){
		// Delete creator from the team drive
		var url = `https://www.googleapis.com/drive/v3/files/${this.teamDriveId}/permissions/${this.myPermissionID}`;
		var params = { supportsAllDrives: true };
		url += "?" + enQuery(params);

	  	var options = {
		    'method': 'delete',
		    'headers': {'authorization' : "Bearer " + this.domain.access_token}
	  	};

		let response = await fetch(url, options);
		if(response.status != 204){ //HTTP_SUCCEEDED
			var response_text = await response.text();
			this.error += this.getErrorMessage("leaveTD") + "\n\n";
			this.error += "Error: #E6_LTD1 \n";
			this.error += response_text;


			return false;
		}
		
		//ALL OK THEN
		return true;
	}

	//Updates the TG Generation Status message
	async status(bot, msg, status=0){
		if(status == TD_CREATION_STATUS.ERROR){
			//console.log(this.error);
			this.domainError();

			//Send error to user
			await bot.sendMessage(msg.message.chat.id, this.error);

			try{
				//Error Logs to a dedicated Channel for Admin
				var logChannelMessage = this.error.replaceAll( this.getErrorMessage("default") + ".\n\n", "");
				//console.log(logChannelMessage);
				if(ERROR_LOG_CHANNEL_ID != -1){
					await bot.sendMessage(ERROR_LOG_CHANNEL_ID, logChannelMessage);
				}
			}catch(ex){ console.error(ex); }

			return false;
		}

		if(status==TD_CREATION_STATUS.ALL_DONE){
			var success_message_footer = "✅  All done\\! \nCheck out your shiny new TD [here](https://drive.google.com/drive/folders/" + escape_markdown(this.teamDriveId) + ")\\!";


			success_message_footer += "\n\n" + SIGNATURE_MESSAGE;
			this.domainFine();

			await bot.sendMessage(msg.message.chat.id, success_message_footer, {parse_mode: 'MarkdownV2'});

			return true;
		}

		var message = escape_markdown("TD request at " + this.domain.name + " - ") + "\n";
		var create_td = escape_markdown("╠═ `Creating TD    `🟠") + "\n";
		var share_td =  escape_markdown("╠═ `Sharing TD     `⚪") + "\n";
		var leave_td =  escape_markdown("╚═ `Leaving TD     `⚪");

		if(status>TD_CREATION_STATUS.INIT){
			create_td = escape_markdown("╠═ `Creating TD    `🟢") + "\n";
			share_td =  escape_markdown("╠═ `Sharing TD     `🟠") + "\n";
		}
		if(status>TD_CREATION_STATUS.TD_CREATED){
			share_td =  escape_markdown("╠═ `Sharing TD     `🟢") + "\n";
			leave_td =  escape_markdown("╚═ `Leaving TD     `🟠");
		}
		if(status>TD_CREATION_STATUS.TD_SHARED){
			leave_td =  escape_markdown("╚═ `Leaving TD     `🟢");
		}

		var final_message = message + create_td + share_td + leave_td;

		return await bot.editMessageText(final_message, {
			message_id: msg.message.message_id,
			chat_id: msg.message.chat.id,
			parse_mode: 'MarkdownV2',
			disable_web_page_preview: true
		});

		return true;
	}

	
}




function enQuery(data) {
	const ret = [];
	for (let d in data) {
		ret.push(encodeURIComponent(d) + "=" + encodeURIComponent(data[d]));
	}
	return ret.join("&");
}

function uuidv4() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0,
	    v = c == "x" ? r : (r & 0x3) | 0x8;
	  	return v.toString(16);
	});
}

function escape_markdown(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}