const fetch = require('node-fetch');
var TD_CREATION_STATUS = {
	'INIT': 0,
	'TD_CREATED': 1,
	'TD_SHARED': 2,
	'TD_LEFT': 3,
	'ALL_DONE': 4
};

module.exports = {
	processTDRequest: async (bot, msg, user, selectedDomain) => {
		var tdGenerator = new TDGenerator(selectedDomain, user.data.email, user.data.td_name);

		tdGenerator.updateTDCreationStatusMessage(bot, msg, TD_CREATION_STATUS.INIT);
		
		//Load Access Token
		await tdGenerator.getAccessToken();
		console.log("Access token generated.");

		//Create TD, Share and Leave
		var teamDriveId = await tdGenerator.createTD();
		tdGenerator.updateTDCreationStatusMessage(bot, msg, TD_CREATION_STATUS.TD_CREATED);
		console.log("TD created.");

		await tdGenerator.allowOutsiders(teamDriveId);
		var myPermissionID = await tdGenerator.shareTD(teamDriveId, user);
		tdGenerator.updateTDCreationStatusMessage(bot, msg, TD_CREATION_STATUS.TD_SHARED);
		console.log("TD shared.");

		var response = await tdGenerator.leaveTD(teamDriveId, myPermissionID);
		tdGenerator.updateTDCreationStatusMessage(bot, msg, TD_CREATION_STATUS.TD_LEFT);
		console.log("TD left.");

		tdGenerator.updateTDCreationStatusMessage(bot, msg, TD_CREATION_STATUS.ALL_DONE);
		console.log("All complete.");

		return true;
	}
}

class TDGenerator{

	constructor(domain, email, td_name){
		this.email = email;
		this.td_name = td_name;

		this.domain = domain;

		return this;
	}

	async getAccessToken() {
		var now = new Date();
		if(this.domain.access_token !== undefined && this.domain.access_token !== "" && this.domain.access_token_expires > now){
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

		let response = await fetch(url, options);
		let access_response = await response.json();

		if(access_response.access_token != undefined){
			this.domain.access_token = access_response.access_token;

			var expiration = new Date();
			expiration.setSeconds(expiration.getSeconds() + 59*60);
			this.domain.access_token_expires = expiration;
			return this.domain.access_token;
		}else{
			return null;
		}
	}

	async createTD(){
		let url = "https://www.googleapis.com/drive/v3/drives";
		url += "?requestId=" + uuidv4();

		var options = {
			'method': 'post',
			'contentType': 'application/json',
			'body': JSON.stringify({'name': this.td_name,}),
			'headers': {'authorization' : "Bearer " + this.domain.access_token, 'Content-Type': 'application/json'}
		}

		let response = await fetch(url, options);
		let response_json = await response.json();

		
		console.log("TD ID - " + response_json.id);
		return response_json.id;
	}


	//Function specific to circumvent bans by Organisation to be shared outside
	async allowOutsiders(teamDriveId){
	  	let url = "https://www.googleapis.com/drive/v3/drives/"+teamDriveId;

	  	var options = {
		    'method': 'patch',
		    'body': JSON.stringify({ 'restrictions': { 'domainUsersOnly': false } }),
		    'headers': {'authorization' : "Bearer " + this.domain.access_token, 'Content-Type': 'application/json'}
	  	}

		let response = await fetch(url, options);
	  
	 	return teamDriveId;
	}

	async shareTD(teamDriveId, user){

		// Get created drive user permission ID
		let url = `https://www.googleapis.com/drive/v3/files/${teamDriveId}/permissions`;
		var params = { 
		    supportsAllDrives: true,
		    fields:  "permissions(id,emailAddress)"
	  	};
		url += "?" + enQuery(params);

	  	let options = {
	    	'headers': {'authorization' : "Bearer " + this.domain.access_token}
	  	};

	  	let response = await fetch(url, options);
		let response_json = await response.json();
		const myPermissionID = response_json.permissions[0].id;



		// Share team drive with email address
		url = `https://www.googleapis.com/drive/v3/files/${teamDriveId}/permissions`;
		params = { supportsAllDrives: true };
		url += "?" + enQuery(params);

	  	options = {
		    'method': 'post',
		    
		    'body': JSON.stringify({ role: "organizer", type: "user", emailAddress: user.data.email }),
		    'headers': {'authorization' : "Bearer " + this.domain.access_token, 'Content-Type': 'application/json'}
	  	}

	  	response = await fetch(url, options);

	  	return myPermissionID;
	}

	async leaveTD(teamDriveId, myPermissionID){
		// Delete creator from the team drive
		var url = `https://www.googleapis.com/drive/v3/files/${teamDriveId}/permissions/${myPermissionID}`;
		var params = { supportsAllDrives: true };
		url += "?" + enQuery(params);

	  	var options = {
		    'method': 'delete',
		    'headers': {'authorization' : "Bearer " + this.domain.access_token}
	  	};

		let response = await fetch(url, options);
		
		return response;
	}

	async updateTDCreationStatusMessage(bot, msg, status=0){

		var message = "TD request at " + this.domain.name + " - \n";
		var create_td = "╠═ `Creating TD    `🟠\n";
		var share_td =  "╠═ `Sharing TD     `⚪\n";
		var leave_td =  "╚═ `Leaving TD     `⚪";
		var all

		if(status>TD_CREATION_STATUS.INIT){
			create_td = "╠═ `Creating TD    `🟢\n";
			share_td =  "╠═ `Sharing TD     `🟠\n";
		}
		if(status>TD_CREATION_STATUS.TD_CREATED){
			share_td =  "╠═ `Sharing TD     `🟢\n";
			leave_td =  "╚═ `Leaving TD     `🟠";
		}
		if(status>TD_CREATION_STATUS.TD_SHARED){
			leave_td =  "╚═ `Leaving TD     `🟢";
		}

		var final_message = message + create_td + share_td + leave_td;

		if(status==TD_CREATION_STATUS.ALL_DONE){
			final_message += "\n\n\n✅  All done! \n\nCheck your shiny-new TD here - https://drive.google.com/drive/shared-drives";
		}

		

		return await bot.editMessageText(final_message, {
			message_id: msg.message.message_id,
			chat_id: msg.message.chat.id,
			parse_mode: 'Markdown'
		});
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