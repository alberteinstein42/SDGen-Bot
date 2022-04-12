const tdController = require("./td-controller");
var db_users = global.users.users;
var user_init = require("./sample-config/user.inc.js");
var adminController = require("./admin-controller");
var quotaController = require("./quota-controller");
var db_domains = getAvailableDomains();
const MAX_DOMAINS_PER_PAGE = global.config.MAX_DOMAINS_PER_PAGE;
const MAX_TD_PER_USER = global.config.MAX_TD_PER_USER;
const TD_DYNAMIC_QUOTA = global.config.TD_DYNAMIC_QUOTA;


const WELCOME_MESSAGE = config.WELCOME_MESSAGE;
const SIGNATURE_MESSAGE = config.SIGNATURE_MESSAGE;

module.exports = {

	message: async (bot, msg) => {
		var user = db_users["TU_"+msg.from.id];
		if(!user){ user = initializeUser(msg); }
		if(user.state.startsWith("ADMIN_")) { await adminController.message(bot, msg, user); return; }
		
		if(adminController.isAdmin(user) && msg.text == "/admin"){
			clearData(user);
			user.state = 'ADMIN_INIT';
			await adminController.message(bot, msg, user); return;
		}

		if(global.config.BOT_MAINTENANCE_MODE_ENABLED){
			await bot.sendMessage(msg.chat.id, "😴😴😴\n\nThe Bot is currently in maintenance mode. Please check back later.");

			return;
		}

		await handleMessage(bot, msg, user);
	},

	callback_query: async (bot, msg) => {
		var user = db_users["TU_"+msg.from.id];
		if(!user){ user = initializeUser(msg); }
		if(user.state.startsWith("ADMIN_")) { await adminController.callback_query(bot, msg, user); return; }

		if(global.config.BOT_MAINTENANCE_MODE_ENABLED){
			await bot.editMessageText("😴😴😴\n\nThe Bot is currently in maintenance mode. Please check back later.", {
				message_id: msg.message.message_id,
				chat_id: msg.message.chat.id
			});

			return;
		}

		await handleCallbackQuery(bot, msg, user);
	},


};

//This function handles the button clicks in the bot
async function handleCallbackQuery(bot, msg, user){
	const chatId = msg.message.chat.id;
	const messageId = msg.message.message_id;
	
	if(user.banned){
		await bot.editMessageText("You've been banned from using this Bot.", {
			message_id: messageId,
			chat_id: chatId
		});

		return;
	}

	if(user.is_bot){
		await bot.editMessageText("I don't talk to Bots.", {
			message_id: messageId,
			chat_id: chatId
		});
		return;
	}

	switch(msg.data){
		case 'CANCEL':
			await bot.editMessageText("Have a good day\\!" + "\n\n" + SIGNATURE_MESSAGE, {
				message_id: messageId,
				chat_id: chatId,
				parse_mode: 'MarkdownV2',
				disable_web_page_preview: true
			});
			clearData(user);

			break;

		case 'ENTER_EMAIL':
			if(quotaController.tdQuotaExhausted(user)){
				var quotaErrMsg = "";
				if(MAX_TD_PER_USER != -1){
					quotaErrMsg = `Sorry, you've already created maximum Shared Drives alloted per user(${user.drives.length}/${MAX_TD_PER_USER}).`;
				}else{
					
					var quota_cycle_next_date =  user.first_td_after_cutoff.date.addDays(TD_DYNAMIC_QUOTA.DAYS);
					
					delete user.first_td_after_cutoff;
					delete user.tds_after_cutoff;
					quotaErrMsg = `Sorry, your Shared Drive quota for the period is exhausted.\n`;
					quotaErrMsg += `Quota: ${TD_DYNAMIC_QUOTA.TDS} TDs every ${TD_DYNAMIC_QUOTA.DAYS} days.\n\n`;
					quotaErrMsg += `You will again be able to create a TD after: ` + dateDiffString(quota_cycle_next_date, new Date());
				}


				await bot.sendMessage(chatId, quotaErrMsg);
				user.state = "INIT";
				user.current_td_request = { 
					"email": undefined,
					"td_name": undefined, 
					"domain": undefined,
				};
				user.current_domain_page = 1;

				break;
			}

			delete user.tds_after_cutoff;
			var cancel_button = [[{"text": "❌ Cancel", "callback_data": "CANCEL"}]];
			await bot.editMessageText("Email Address? -", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(cancel_button) + ' }',
				message_id: messageId,
				chat_id: chatId
			});

			user.state = 'ENTER_EMAIL';
			break;

		case 'SELECT_DOMAIN':

			//If user opts to manually select a domain
			var inline_keyboard = generateDomainsMarkup(user);			
			await bot.editMessageText("Choose a Domain - ", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
				message_id: messageId,
				chat_id: chatId
			});

			user.state = 'SELECT_DOMAIN';
			break;

		case 'GO_TO_FIRST_PAGE':
			user.current_domain_page = 1;

			var inline_keyboard = generateDomainsMarkup(user);			
			await bot.editMessageText("Choose a Domain - ", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
				chat_id: chatId,
				message_id: messageId
			});
			break;

		case 'GO_TO_PREV_PAGE':
			user.current_domain_page = Math.max(user.current_domain_page - 1, 1);

			var inline_keyboard = generateDomainsMarkup(user);			
			await bot.editMessageText("Choose a Domain - ", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
				chat_id: chatId,
				message_id: messageId
			});
			break;

		case 'GO_TO_NEXT_PAGE':
			var totalPages = Math.ceil(db_domains.length / MAX_DOMAINS_PER_PAGE);
			user.current_domain_page = Math.min(user.current_domain_page + 1, totalPages);

			var inline_keyboard = generateDomainsMarkup(user);			
			bot.editMessageText("Choose a Domain - ", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
				chat_id: chatId,
				message_id: messageId
			});
			break;

		case 'GO_TO_LAST_PAGE':
			var totalPages = Math.ceil(db_domains.length / MAX_DOMAINS_PER_PAGE);
			user.current_domain_page = totalPages;

			var inline_keyboard = generateDomainsMarkup(user);			
			await bot.editMessageText("Choose a Domain - ", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
				chat_id: chatId,
				message_id: messageId
			});
			break;
		case 'SELECT_RANDOM_MANUAL':
			user.state = "SELECT_RANDOM_MANUAL";
			
			var inline_keyboard = generateRandomManualMarkup();			
			await bot.editMessageText("Choose a Domain - ", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
				chat_id: chatId,
				message_id: messageId
			});

		default:
			break;
	}

	//Handling the dynamic SELECTED_DOMAIN_XX separately
	if(msg.data.startsWith("SELECTED_DOMAIN_") || msg.data.startsWith("FORCE_SELECTED_DOMAIN_")){
		var selectedDomain = msg.data.split("SELECTED_DOMAIN_")[1];
		var domain;
		if(selectedDomain == "RANDOM"){
			selectedDomain = randomIntFromInterval(1, db_domains.length);
			domain = db_domains[selectedDomain];
		}else{
			domain = findDomainById(selectedDomain);
		}
		

		var tds_with_domain = hasAlreadyTDWithThisDomain(domain, user.drives);
		if(!msg.data.startsWith("FORCE_SELECTED_DOMAIN_") && tds_with_domain){

			var confirm_domain_keyboard = generateConfirmMultipleTDMarkup(domain);			
			await bot.editMessageText(`You already have ${tds_with_domain} TD with ${domain.name}, do you want to create one more?`, {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(confirm_domain_keyboard) + ' }',
				chat_id: chatId,
				message_id: messageId
			});

			return;
		}

		user.current_td_request.domain_id = domain.id; //not the array index, but actual domain.id
		user.current_td_request.domain_name = domain.name;
		var hasTDCreated = await tdController.processTDRequest(bot, msg, user, domain);
		if(hasTDCreated){
			user.current_td_request.date = new Date();
			user.drives.push(JSON.parse(JSON.stringify(user.current_td_request)));
		}else if(user.inputError){
			clearData(user);
		}else{
			user.inputError = false;
			user.state = "SELECT_RANDOM_MANUAL";
			
			var inline_keyboard = generateRandomManualMarkup();			
			await bot.sendMessage(chatId, "Choose a Domain - ", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
			});
		}
		
		//Refresh the Domains List for Updates
		db_domains = getAvailableDomains();
	}
}

async function handleMessage(bot, msg, user){
	const chatId = msg.chat.id;

	if(user.banned){
		await bot.sendMessage(chatId, "You've been banned from using this Bot.");
		return;
	}

	if(user.is_bot){
		await bot.sendMessage(chatId, "I don't talk to Bots.");
		return;
	}

	switch(user.state){
		case 'ENTER_EMAIL':
			var cancel_button = [[{"text": "❌ Cancel", "callback_data": "CANCEL"}]]; 
			
			if(!validateEmail(msg.text.trim())){	
				await bot.sendMessage(chatId, "Invalid Email Address, please provide a valid email. - ", {
					reply_markup: '{ "inline_keyboard": '+ JSON.stringify(cancel_button) + ' }'
				});	
				break;
			}

			user.current_td_request.email = removeDotsAndPluses(msg.text.trim().toLowerCase());
			user.state = "ENTER_TD_NAME";
			
			await bot.sendMessage(chatId, "Shared Drive name? - ", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(cancel_button) + ' }'
			});
			break;

		case 'ENTER_TD_NAME':
			var td_name = msg.text.trim();

			//Empty drive name check
			if(td_name == undefined || !td_name || td_name == ""){
				await bot.sendMessage(chatId, "Shared Drive name? - ", {
					reply_markup: '{ "inline_keyboard": '+ JSON.stringify(cancel_button) + ' }'
				});

				break;
			}

			user.current_td_request.td_name = td_name;
			if(db_domains.length == 0){
				await bot.sendMessage(chatId, "Sorry, no domains are available right now. Please try again later.");
				user.state = 'INIT';
				user.current_td_request = { 
					"email": undefined,
					"td_name": undefined, 
					"domain": undefined,
				};
				break;
			}

			//Asks user about wether to select domains randomly or manually
			user.state = "SELECT_RANDOM_MANUAL";
			
			var inline_keyboard = generateRandomManualMarkup();			
			await bot.sendMessage(chatId, "Choose a Domain - ", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
			});
			break;

		default:
			var inline_keyboard = [
				[{"text": "💽 Generate TD", "callback_data": "ENTER_EMAIL"}], 
				[{"text": "❌ Cancel", "callback_data": "CANCEL"}]
			]; 

			await bot.sendMessage(chatId, WELCOME_MESSAGE + "\n\n" + SIGNATURE_MESSAGE, {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
				parse_mode: 'MarkdownV2',
				disable_web_page_preview: true
			});
	}
}

//Some default keyboard buttons
var cancel_control = [{"text": "❌ Cancel", "callback_data": "CANCEL"}];
var random_control = [{"text": "🎲 Random", "callback_data": "SELECTED_DOMAIN_RANDOM"}];
var page_bottom_controls = [{"text": "⏮", "callback_data": "GO_TO_FIRST_PAGE"}, {"text": "⏪", "callback_data": "GO_TO_PREV_PAGE"}, {"text": "⏩", "callback_data": "GO_TO_NEXT_PAGE"}, {"text": "⏭", "callback_data": "GO_TO_LAST_PAGE"}];

//For multiple td on same domain
function generateConfirmMultipleTDMarkup(domain){
	var pageArr = [[]];
	pageArr.push([{"text": "🙃 Yes, I do", "callback_data": `FORCE_SELECTED_DOMAIN_${domain.id}`}]);
	pageArr.push([{"text": "😥 No, select again", "callback_data": "SELECT_RANDOM_MANUAL"}]);
	pageArr.push(cancel_control);

	return pageArr;
}

function generateRandomManualMarkup(){
	var pageArr = [[]];
	pageArr.push(random_control);
	pageArr.push([{"text": "🧐 Manual", "callback_data": "SELECT_DOMAIN"}]);
	pageArr.push(cancel_control);

	return pageArr;
}


function generateDomainsMarkup(user){	
	var inline_keyboard = generateDomainsPage(user.current_domain_page);
	inline_keyboard.push(page_bottom_controls);
	inline_keyboard.push(cancel_control);
	return inline_keyboard;
}

function generateDomainsPage(page){
	pageNo = page - 1; // To make the code easy to read, pages and domain indices start from 1
	
	var currentPageLength = Math.min(db_domains.length - (pageNo * MAX_DOMAINS_PER_PAGE), MAX_DOMAINS_PER_PAGE);
	

	var pageArr = [[]];
	if(page==1){
		pageArr.push(random_control);
	}

	for(i=0; i<currentPageLength; i++){
		var domainIndex = pageNo*MAX_DOMAINS_PER_PAGE + i;
		var domain = db_domains[domainIndex];
		pageArr.push([
			{"text": (domainIndex+1) + ". " + domain.name, "callback_data": "SELECTED_DOMAIN_" + domain.id}
		]);
	}

	return pageArr;
}

function getEmojiNumber(number){
	var emoji_numbers = ["0⃣", "1⃣", "2⃣", "3⃣", "4⃣", "5⃣", "6⃣", "7⃣", "8⃣", "9⃣", "🔟"];
	var nStr = number + "";
	var numberEmoji = "";
	for(let i in nStr){
		numberEmoji += emoji_numbers[nStr[i]];
	}

	return numberEmoji;
}

function randomIntFromInterval(min, max) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min)
}

//Clear user navigation data on successful creation of TD
function clearData(user){
	user.state = 'INIT';
	user.current_domain_page = 1;
	user.inputError = false;
	user.current_td_request = {
		email: undefined,
		td_name: undefined,
		domain: undefined
	};
}

function validateEmail(emailAdress){
	let regexEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
	if (emailAdress.match(regexEmail)) {
		return true; 
	} else {
		return false; 
	}
}

//Removes dots and text after plus sign in emails
function removeDotsAndPluses(emailAdress){
	let regex = /(.*)\+(.*)@(.*)/gm;
	let subst = `$1@$3`;
	let result = emailAdress.replace(regex, subst);

	result = result.split("@");
	emailAdress = result[0].replace(/\./g,'') + "@" + result[1];

	return emailAdress;
}

function initializeUser(msg){
	var user = db_users["TU_"+msg.from.id] = JSON.parse(JSON.stringify(user_init));
	user.telegram = JSON.parse(JSON.stringify(msg.from));
	return user;
}

function getAvailableDomains(){
	var available = [];
	var all_domains = global.config.domains;
	for(i=0; i<all_domains.length; i++){
		if(!all_domains[i].disabled){
			available.push(all_domains[i]);
		}
	}

	return available;
}


function escape_markdown(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function findDomainById(id){
	return db_domains.find(o => o.id == id);
}

function dateDiffString(date1, date2){
	var toGo = "";

	var delta = Math.abs(date2 - date1) / 1000; 

	// calculate (and subtract) whole days
	var days = Math.floor(delta / 86400);
	delta -= days * 86400;
	toGo += days ? `${days} days, ` : "";

	// calculate (and subtract) whole hours
	var hours = Math.floor(delta / 3600) % 24;
	delta -= hours * 3600;
	toGo += hours ? `${hours} hours, ` : "";

	// calculate (and subtract) whole minutes
	var minutes = Math.floor(delta / 60) % 60;
	delta -= minutes * 60;
	toGo += minutes ? `${minutes} minutes, ` : "";

	// what's left is seconds
	var seconds = Math.ceil(delta % 60);  // in theory the modulus is not required
	toGo += seconds ? `${seconds} seconds` : "";

	return toGo;
}

Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

function hasAlreadyTDWithThisDomain(domain, drives){
	var tds_with_domain = 0;
	for(drive of drives){
		tds_with_domain += drive.domain_id == domain.id;
	}

	return tds_with_domain;
}