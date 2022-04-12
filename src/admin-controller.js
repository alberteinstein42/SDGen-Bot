const fs = require('fs');
const { exec } = require("child_process");

const tdController = require("./td-controller");
var quotaController = require("./quota-controller");
var user_init = require("./sample-config/user.inc.js");
var domain_init = require("./sample-config/domain.inc.js");

var db_users = global.users.users;
const all_domains = global.config.domains;

const MAX_DOMAINS_PER_PAGE = global.config.MAX_DOMAINS_PER_PAGE;
const MAX_TD_PER_USER = global.config.MAX_TD_PER_USER;
const TD_DYNAMIC_QUOTA = global.config.TD_DYNAMIC_QUOTA;

module.exports = {

	message: async (bot, msg) => {
		var user = db_users["TU_"+msg.from.id];
		if(!user){ user = initializeUser(msg); }
	
		await handleMessage(bot, msg, user);
	},

	callback_query: async (bot, msg) => {
		var user = db_users["TU_"+msg.from.id];
		if(!user){ user = initializeUser(msg); }

		await handleCallbackQuery(bot, msg, user);
	},

	isOwner: (user) => {
		return config.ADMINS.OWNER == user.telegram.id;
	},

	isModerator: (user) => {
		return config.ADMINS.MODERATORS.includes(user.telegram.id);
	},

	isAdmin: (user) => {
		return module.exports.isOwner(user) || module.exports.isModerator(user);
	}
};

async function handleMessage(bot, msg, user){
	const chatId = msg.chat.id;
	var major_admin_command = user.state.split("|")[0];

	switch(major_admin_command){
		case 'ADMIN_INIT':
			await handleAdminInit(bot, msg, user);
			break;

		case 'ADMIN_MANAGE_DOMAINS':
			await handleManageDomains(bot, msg, user);
			break;

		case 'ADMIN_MANAGE_USERS':
			await handleManageUsers(bot, msg, user);
			break;

		case 'ADMIN_MANAGE_ADMINS':
			if(!module.exports.isOwner(user)){ break; }
			await handleManageAdmin(bot, msg, user);
			break;

		case 'ADMIN_MANAGE_CONFIGURATION':
			await handleManageConfiguration(bot, msg, user);
			break;

		case 'ADMIN_BOT_MAINTENANCE_MODE':
			await handleBotMaintenanceMode(bot, msg, user);
			break;

		default:
			break;
	}
}

//This function handles the button clicks in the bot
async function handleCallbackQuery(bot, msg, user){
	const chatId = msg.message.chat.id;
	const messageId = msg.message.message_id;
	
	var major_admin_command = msg.data.split("|")[0];

	switch(major_admin_command){
		case 'ADMIN_INIT':
			await handleAdminInit(bot, msg, user, true);
			break;

		case 'ADMIN_LOGOUT':
			clearData(user);
			await bot.editMessageText("👋🏻 Bye, cya!", {
				message_id: messageId,
				chat_id: chatId
			});

			break;

		case 'ADMIN_MANAGE_DOMAINS':
			await handleManageDomains(bot, msg, user, true);
			break;

		case 'ADMIN_MANAGE_USERS':
			await handleManageUsers(bot, msg, user, true);
			break;

		case 'ADMIN_MANAGE_ADMINS':
			if(!module.exports.isOwner(user)){ break; }
			await handleManageAdmin(bot, msg, user, true);
			break;

		case 'ADMIN_MANAGE_CONFIGURATION':
			await handleManageConfiguration(bot, msg, user, true);
			break;

		case 'ADMIN_BOT_MAINTENANCE_MODE':
			await handleBotMaintenanceMode(bot, msg, user, true);
			break;
		
		default:
			break;
	}
}

async function handleBotMaintenanceMode(bot, msg, user, from_callback_query){
	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
	}

	var micro_admin_command = msg.data ? msg.data.split("|")[1] || "" : user.state.split("|")[1] || "";
	var callback_data_prefix = `ADMIN_BOT_MAINTENANCE_MODE`;
	
	
	switch(micro_admin_command){
		case "ENABLE":
			global.config.BOT_MAINTENANCE_MODE_ENABLED = true;
			await handleAdminInit(bot, msg, user, from_callback_query);
			break;

		case "DISABLE":
			global.config.BOT_MAINTENANCE_MODE_ENABLED = false;
			await handleAdminInit(bot, msg, user, from_callback_query);
			break;

		default:
			break;
	}
}

async function handleManageConfiguration(bot, msg, user, from_callback_query){
	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
	}

	var micro_admin_command = msg.data ? msg.data.split("|")[1] || "" : user.state.split("|")[1] || "";
	var callback_data_prefix = `ADMIN_MANAGE_CONFIGURATION`;
	
	switch(micro_admin_command){
		case "":
			await showConfigMenu(bot, msg, user, callback_data_prefix, true);

			break;

		case "MAX_DOMAINS_PER_PAGE":
		case "MAX_DOMAIN_ERRORS":
			var nano_admin_command = msg.data ? msg.data.split("|")[2] || "" : user.state.split("|")[2] || "";
			if(nano_admin_command == "EDIT"){
				global.config[micro_admin_command] = parseInt(msg.text.trim());
				user.state = callback_data_prefix;

				await showConfigMenu(bot, msg, user, callback_data_prefix);
			}else{
				user.state = `${callback_data_prefix}|${micro_admin_command}|EDIT`;
				await askNewConfigValue(bot, msg, user, callback_data_prefix, from_callback_query, `Provide new value for ${micro_admin_command} - `);
			}
		
			break;

		case "WELCOME_MESSAGE":
		case "SIGNATURE_MESSAGE":

			var nano_admin_command = msg.data ? msg.data.split("|")[2] || "" : user.state.split("|")[2] || "";
			if(nano_admin_command == "EDIT"){
				global.config[micro_admin_command] = msg.text.trim();
				user.state = callback_data_prefix;

				await showConfigMenu(bot, msg, user, callback_data_prefix);
			}else{
				user.state = `${callback_data_prefix}|${micro_admin_command}|EDIT`;
				await askNewConfigValue(bot, msg, user, callback_data_prefix, from_callback_query, `Provide new value for ${micro_admin_command} - `);
			}
		
			break;

		case "ERROR_LOG_CHANNEL_ID":
		case "MAX_TD_PER_USER":
			var nano_admin_command = msg.data ? msg.data.split("|")[2] || "" : user.state.split("|")[2] || "";
			if(nano_admin_command == "EDIT"){
				global.config[micro_admin_command] = parseInt(msg.text.trim());
				user.state = callback_data_prefix;

				await showConfigMenu(bot, msg, user, callback_data_prefix);
			}else{
				user.state = `${callback_data_prefix}|${micro_admin_command}|EDIT`;
				await askNewConfigValue(bot, msg, user, callback_data_prefix, from_callback_query, `Provide new value for ${micro_admin_command} - \n(Enter -1 to disable this option)`);
			}
		
			break;

		case "TD_DYNAMIC_QUOTA":

			var nano_admin_command = msg.data ? msg.data.split("|")[2] || "" : user.state.split("|")[2] || "";
			if(nano_admin_command == "EDIT"){
				var tds_per_days = msg.text.trim();
				var tds = tds_per_days.split("/")[0];
				var days = tds_per_days.split("/")[1];
				global.config[micro_admin_command].TDS = parseInt(tds);
				global.config[micro_admin_command].DAYS = parseInt(days);
				user.state = callback_data_prefix;

				await showConfigMenu(bot, msg, user, callback_data_prefix);
			}else{
				user.state = `${callback_data_prefix}|${micro_admin_command}|EDIT`;
				await askNewConfigValue(bot, msg, user, callback_data_prefix, from_callback_query, `Provide new value for ${micro_admin_command} - \n(Format: TDS/DAYS)`);
			}
		
			break;

		case "SAVE_CONFIG":
			const { stdout, stderr } = await saveConfigToDrive();
			var output = "" + stdout;
			var error = "" + stderr;

			
			await bot.answerCallbackQuery(msg.id, {
				'text': `Config saved to ${BACKUP_RCLONE_REMOTE}`,
				'show_alert': true
			});
			break;
		default:
			break;
	}
}

async function askNewConfigValue(bot, msg, user, callback_data_prefix, from_callback_query, query_title=""){
	var inline_keyboard = [[{"text": `🔙 Go Back`, "callback_data": `${callback_data_prefix}`}]];

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
		await bot.editMessageText(query_title, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			chat_id: chatId,
			message_id: messageId
		});
	}else{
		await bot.sendMessage(msg.chat.id, query_title, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
		});
	}	
}

async function showConfigMenu(bot, msg, user, callback_data_prefix, from_callback_query){
	var inline_keyboard = [
		[{"text": `📄 MAX_DOMAINS_PER_PAGE: ${global.config.MAX_DOMAINS_PER_PAGE}`, "callback_data": `${callback_data_prefix}|MAX_DOMAINS_PER_PAGE`}], 
		[{"text": `‼️ MAX_DOMAIN_ERRORS: ${global.config.MAX_DOMAIN_ERRORS}`, "callback_data": `${callback_data_prefix}|MAX_DOMAIN_ERRORS`}], 
		[{"text": `🔔 ERROR_LOG_CHANNEL_ID: ${global.config.ERROR_LOG_CHANNEL_ID}`, "callback_data": `${callback_data_prefix}|ERROR_LOG_CHANNEL_ID`}], 
		[{"text": `📦 MAX_TD_PER_USER: ${global.config.MAX_TD_PER_USER}`, "callback_data": `${callback_data_prefix}|MAX_TD_PER_USER`}], 
		[{"text": `⏱ TD_DYNAMIC_QUOTA: ${global.config.TD_DYNAMIC_QUOTA.TDS}/${global.config.TD_DYNAMIC_QUOTA.DAYS}`, "callback_data": `${callback_data_prefix}|TD_DYNAMIC_QUOTA`}], 
		[{"text": `🎉 WELCOME_MESSAGE: ${global.config.WELCOME_MESSAGE}`, "callback_data": `${callback_data_prefix}|WELCOME_MESSAGE`}], 
		[{"text": `👣 SIGNATURE_MESSAGE: ${global.config.SIGNATURE_MESSAGE}`, "callback_data": `${callback_data_prefix}|SIGNATURE_MESSAGE`}], 
		[{"text": `📤 Save Config to Drive`, "callback_data": `${callback_data_prefix}|SAVE_CONFIG`}], 
		[{"text": `🔙 Go Back`, "callback_data": `ADMIN_INIT`}]
	];

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
		await bot.editMessageText(`Bot Configuration - `, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			chat_id: chatId,
			message_id: messageId
		});
	}else{
		await bot.sendMessage(msg.chat.id, `Bot Configuration - `, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
		});
	}
}


async function handleManageAdmin(bot, msg, user, from_callback_query){
	var minor_admin_command = msg.data ? msg.data.split("|")[1] || "" : user.state.split("|")[1] || "";
	var user_id = msg.data ? msg.data.split("|")[2] : user.state.split("|")[2];
	var user_object = db_users[`TU_${user_id}`];

	switch(minor_admin_command){
		case '':
			await handleManageAdminInit(bot, msg, user, from_callback_query);
			break;
		case 'ADD':
			await handleAddAdmin(bot, msg, user, from_callback_query);
			break;
		case 'REMOVE':

			await handleRemoveAdmin(bot, msg, user, from_callback_query);
			break;

		
		default:
			break;
	}
}

async function handleRemoveAdmin(bot, msg, user, from_callback_query, user_removed=false){
	user.state = 'ADMIN_INIT';
	var callback_data_prefix = `ADMIN_MANAGE_ADMINS|REMOVE`;
	var inline_keyboard = []; 

	for(moderator of global.config.ADMINS.MODERATORS){
		var mod_user = db_users[`TU_${moderator}`];
		if(!mod_user){ continue; }

		inline_keyboard.push([{"text": `${mod_user.telegram.first_name} ${mod_user.telegram.last_name}`, "callback_data": `ADMIN_MANAGE_ADMINS|REMOVE|${mod_user.telegram.id}`}])
	}
	
	inline_keyboard.push([{"text": `🔙 Go Back`, "callback_data": `ADMIN_MANAGE_ADMINS`}]);

	

	var user_id = msg.data ? msg.data.split("|")[2] : "";
	var user_object = db_users[`TU_${user_id}`];
	
	if(user_id != "" && typeof user_object != "undefined" && !user_removed){
		var admin_index = global.config.ADMINS.MODERATORS.indexOf(user_id);
		global.config.ADMINS.MODERATORS.splice(admin_index, 1);
		handleRemoveAdmin(bot, msg, user, from_callback_query, true);

		return;
	}

	var list_title = global.config.ADMINS.MODERATORS.length > 0 ? "Admins List, click to remove - " : "No Admins added yet.";
	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;

		await bot.editMessageText(list_title, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			message_id: messageId,
			chat_id: chatId
		});
	}else{
		await bot.sendMessage(msg.chat.id, list_title, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
		});
	}
}

async function handleAddAdmin(bot, msg, user, from_callback_query){
	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
	}

	var user_id;
	
	if(from_callback_query){
		await askUserIdForAdmin(bot, msg, user, from_callback_query);
		return;
	}

	if(!from_callback_query 
		&& msg.forward_from 
		&& (user_id = msg.forward_from.id)
		&& db_users[`TU_${user_id}`]){

		global.config.ADMINS.MODERATORS.push(user_id);
		handleRemoveAdmin(bot, msg, user, from_callback_query)
		user.state = 'ADMIN_INIT';
		return;
	}

	var user_id = msg.text.trim();
	if(user_id && db_users[`TU_${user_id}`]){

		global.config.ADMINS.MODERATORS.push(user_id);
		handleRemoveAdmin(bot, msg, user, from_callback_query)
		user.state = 'ADMIN_INIT';

		return;
	}

	var errMsg = "The said User has never used this Bot. Can't do actions preemptively.\n\n";
	await askUserIdForAdmin(bot, msg, user, from_callback_query, errMsg);

}

async function askUserIdForAdmin(bot, msg, user, from_callback_query, errMsg=""){
	var inline_keyboard = [[{"text": `🔙 Go Back`, "callback_data": `ADMIN_MANAGE_ADMINS`}]];
	user.state = 'ADMIN_MANAGE_ADMINS|ADD';

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
		await bot.editMessageText(`${errMsg}Enter User ID or forward a message from the User -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			chat_id: chatId,
			message_id: messageId
		});
	}else{
		await bot.sendMessage(msg.chat.id, `${errMsg}Enter User ID or forward a message from the User -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
		});
	}
}

async function handleManageAdminInit(bot, msg, user, from_callback_query){
	
	user.state = 'ADMIN_INIT';
	var inline_keyboard = [
		[{"text": "🤩 Add Admin", "callback_data": "ADMIN_MANAGE_ADMINS|ADD"}], 
		[{"text": "🤨 Remove Admin", "callback_data": "ADMIN_MANAGE_ADMINS|REMOVE"}],
		[{"text": "🏠 Go Home", "callback_data": "ADMIN_INIT"}]
	]; 

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;

		await bot.editMessageText("Manage Admins - ", {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			message_id: messageId,
			chat_id: chatId
		});

	}else{
		await bot.sendMessage(msg.chat.id, "Manage Admins - ", {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
		});
	}
}


async function handleManageUsers(bot, msg, user, from_callback_query){
	var minor_admin_command = msg.data ? msg.data.split("|")[1] || "" : user.state.split("|")[1] || "";

	switch(minor_admin_command){
		case '':
			await askUserId(bot, msg, user, from_callback_query);
			break;
		case 'SELECT_USER':
			await handleSelectedUser(bot, msg, user, from_callback_query);
			break;

		default:
			break;
	}
}

async function handleSelectedUser(bot, msg, user, from_callback_query){
	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
	}

	var user_id = msg.data ? msg.data.split("|")[2] : user.state.split("|")[2];
	var micro_admin_command = msg.data ? msg.data.split("|")[3] || "" : user.state.split("|")[3] || "";
	
	var callback_data_prefix = `ADMIN_MANAGE_USERS|SELECT_USER|${user_id}`;

	switch(micro_admin_command){
		case "":
			if(from_callback_query && !user_id){
				await askUserId(bot, msg, user, from_callback_query);
				break;
			}

			if(!from_callback_query 
				&& msg.forward_from 
				&& (user_id = msg.forward_from.id)
				&& db_users[`TU_${user_id}`]){

				await showUserManageOptions(bot, msg, user, user_id, from_callback_query);
				user.state = 'ADMIN_INIT';
				break;
			}

			var user_id = msg.text.trim();
			if(user_id && db_users[`TU_${user_id}`]){
				await showUserManageOptions(bot, msg, user, user_id, from_callback_query);
				user.state = 'ADMIN_INIT';

				break;
			}

			var errMsg = "The said User has never used this Bot. Can't do actions preemptively.\n\n";
			await askUserId(bot, msg, user, from_callback_query, errMsg);

			break;

		case "OPTIONS":
			await showUserManageOptions(bot, msg, user, user_id, from_callback_query);

			break;
		
		case "GRANT_TD":
			db_users[`TU_${user_id}`].admin_td_grant++;
			await bot.answerCallbackQuery(msg.id, {
				'text': `One additional TD granted.\nTotal Admin Grants: ${db_users[`TU_${user_id}`].admin_td_grant}`,
				'show_alert': true
			});
			await showUserManageOptions(bot, msg, user, user_id, from_callback_query);

			break;

		case "BAN_USER":
			db_users[`TU_${user_id}`].banned = true;
			var admin_index = global.config.ADMINS.MODERATORS.indexOf(user_id);
			global.config.ADMINS.MODERATORS.splice(admin_index, 1);
			
			await showUserManageOptions(bot, msg, user, user_id, from_callback_query);
			break;

		case "UNBAN_USER":
			db_users[`TU_${user_id}`].banned = false;
			await showUserManageOptions(bot, msg, user, user_id, from_callback_query);
			break;

		case "RESET_USER":
			var user_object = db_users[`TU_${user_id}`];
			clearData(user_object);
			user_object.admin_td_grant = 0;
			user_object.drives = [];
			await showUserManageOptions(bot, msg, user, user_id, from_callback_query);

			
			break;

		case "MAKE_ADMIN":
			if(!module.exports.isOwner(user)) { break; }

			global.config.ADMINS.MODERATORS.push(user_id);
			await showUserManageOptions(bot, msg, user, user_id, from_callback_query);
			break;

		case "REMOVE_ADMIN":
			if(!module.exports.isOwner(user)) { break; }
			var admin_index = global.config.ADMINS.MODERATORS.indexOf(user_id);
			global.config.ADMINS.MODERATORS.splice(admin_index, 1);
			await showUserManageOptions(bot, msg, user, user_id, from_callback_query);

			break;

		default:
			break;
	}
}

async function showUserManageOptions(bot, msg, user, user_id, from_callback_query){
	var callback_data_prefix = `ADMIN_MANAGE_USERS|SELECT_USER|${user_id}`;
	var user_object = db_users[`TU_${user_id}`];

	var inline_keyboard = [
		[{"text": "🤗 Grant TD", "callback_data": `${callback_data_prefix}|GRANT_TD`}]
	];

	if(user_object.banned){
		inline_keyboard.push([{"text": "🙂 UnBan User", "callback_data": `${callback_data_prefix}|UNBAN_USER`}]);
	}else{
		inline_keyboard.push([{"text": "😡 Ban User", "callback_data": `${callback_data_prefix}|BAN_USER`}]);
	}

	inline_keyboard.push([{"text": "🤕 Reset User", "callback_data": `${callback_data_prefix}|RESET_USER`}]);

	if(module.exports.isOwner(user)){
		if(global.config.ADMINS.MODERATORS.includes(user_id)){
			inline_keyboard.push([{"text": "🤨 Remove Admin", "callback_data": `${callback_data_prefix}|REMOVE_ADMIN`}]);
		}else{
			inline_keyboard.push([{"text": "🤩 Make Admin", "callback_data": `${callback_data_prefix}|MAKE_ADMIN`}]);
		}
	}

	inline_keyboard.push([{"text": "🏠 Go Home", "callback_data": "ADMIN_INIT"}]);

	var user_info = `User Info - \n`;
	user_info += `Name: ${user_object.telegram.first_name} ${user_object.telegram.last_name}`;
	user_info += (global.config.ADMINS.MODERATORS.includes(user_id) ? "⭐️" : "") + "\n"; 
	user_info += `Total TDs: ${user_object.drives.length}\n`;
	user_info += `Quota: `;
	var quotaExhausted = quotaController.tdQuotaExhausted(user_object);

	if(MAX_TD_PER_USER != -1){
		user_info += `${user_object.drives.length}/${MAX_TD_PER_USER} TDs created.`;
	}else{
		user_info += `${user_object.tds_after_cutoff}/${TD_DYNAMIC_QUOTA.TDS} TDs created in last ${TD_DYNAMIC_QUOTA.DAYS} days.\n`;
	}
	if(quotaExhausted && user_object.first_td_after_cutoff){
		var quota_cycle_next_date =  user_object.first_td_after_cutoff.date.addDays(TD_DYNAMIC_QUOTA.DAYS);
		user_info += `--Next TD after: ` + dateDiffString(quota_cycle_next_date, new Date()) + "\n";
	}

	user_info += `--Admin TD Grant: ${user_object.admin_td_grant}`;
	
	delete user_object.first_td_after_cutoff;
	delete user_object.tds_after_cutoff;

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
		

		await bot.editMessageText(user_info, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			message_id: messageId,
			chat_id: chatId
		});

	}else{
		await bot.sendMessage(msg.chat.id, user_info, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
		});
	}
}

async function askUserId(bot, msg, user, from_callback_query, errMsg=""){
	var inline_keyboard = [[{"text": `🔙 Go Back`, "callback_data": `ADMIN_INIT`}]];
	user.state = 'ADMIN_MANAGE_USERS|SELECT_USER';

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
		await bot.editMessageText(`${errMsg}Enter User ID or forward a message from the User -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			chat_id: chatId,
			message_id: messageId
		});
	}else{
		await bot.sendMessage(msg.chat.id, `${errMsg}Enter User ID or forward a message from the User -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
		});
	}	
}

async function handleAdminInit(bot, msg, user, from_callback_query){
	
	user.state = 'ADMIN_INIT';
	var inline_keyboard = [
		[{"text": "🕵🏻‍♂️ Manage Domains", "callback_data": "ADMIN_MANAGE_DOMAINS"}], 
		[{"text": "👮🏻‍♂️ Manage Users", "callback_data": "ADMIN_MANAGE_USERS"}]
	]; 

	if(module.exports.isOwner(user)){
		inline_keyboard.push([{"text": "🥷🏻 Manage Admins", "callback_data": "ADMIN_MANAGE_ADMINS"}]);
	}

	inline_keyboard.push([{"text": "💾 Manage Configuration", "callback_data": "ADMIN_MANAGE_CONFIGURATION"}]);

	if(global.config.BOT_MAINTENANCE_MODE_ENABLED){
		inline_keyboard.push([{"text": "🕹 Disable Maintenance Mode", "callback_data": "ADMIN_BOT_MAINTENANCE_MODE|DISABLE"}]);
	}else{
		inline_keyboard.push([{"text": "🕹 Bot Maintenance Mode", "callback_data": "ADMIN_BOT_MAINTENANCE_MODE|ENABLE"}]);
	}

	
	inline_keyboard.push([{"text": "🔒 Logout", "callback_data": "ADMIN_LOGOUT"}]);

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;

		await bot.editMessageText("Hi Admin !", {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			message_id: messageId,
			chat_id: chatId
		});

	}else{
		await bot.sendMessage(msg.chat.id, "Hi Admin !", {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
		});
	}
}

async function handleManageDomains(bot, msg, user, from_callback_query){
	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
	}

	var minor_admin_command = msg.data ? msg.data.split("|")[1] || "" : user.state.split("|")[1] || "";

	switch(minor_admin_command){
		case '':
			showDomainsList(bot, msg, user);
			break;
		case 'NEW_DOMAIN':
			var new_domain = JSON.parse(JSON.stringify(domain_init));
			new_domain.id = global.config.domains.length + 1;
			new_domain.name = "New Domain";
			new_domain.disabled = true;
			global.config.domains.push(new_domain);
			msg.data = `ADMIN_MANAGE_DOMAINS|SELECT_DOMAIN|${new_domain.id}`;
			await handleSelectDomain(bot, msg, user, from_callback_query);
			break;

		case 'SELECT_DOMAIN':
			await handleSelectDomain(bot, msg, user, from_callback_query);
			break;

		case 'GO_TO_FIRST_PAGE':
			user.current_domain_page = 1;

			showDomainsList(bot, msg, user);
			break;

		case 'GO_TO_PREV_PAGE':
			user.current_domain_page = Math.max(user.current_domain_page - 1, 1);

			showDomainsList(bot, msg, user);
			break;

		case 'GO_TO_NEXT_PAGE':
			var totalPages = Math.ceil(all_domains.length / MAX_DOMAINS_PER_PAGE);
			user.current_domain_page = Math.min(user.current_domain_page + 1, totalPages);

			showDomainsList(bot, msg, user);
			break;

		case 'GO_TO_LAST_PAGE':
			var totalPages = Math.ceil(all_domains.length / MAX_DOMAINS_PER_PAGE);
			user.current_domain_page = totalPages;

			showDomainsList(bot, msg, user);
			break;
		default:
			break;
	}
}

async function showDomainsList(bot, msg, user){
	const chatId = msg.message.chat.id;
	const messageId = msg.message.message_id;
	
	var inline_keyboard = generateDomainsMarkup(user);
	await bot.editMessageText("Select Domain to manage -", {
		reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
		message_id: messageId,
		chat_id: chatId
	});
}

async function handleSelectDomain(bot, msg, user, from_callback_query){
	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
	}

	var domainNumber = msg.data ? msg.data.split("|")[2] : user.state.split("|")[2];
	var micro_admin_command = msg.data ? msg.data.split("|")[3] || "" : user.state.split("|")[3] || "";
	var domain = findDomainById(domainNumber);
	var callback_data_prefix = `ADMIN_MANAGE_DOMAINS|SELECT_DOMAIN|${domainNumber}`;

	switch(micro_admin_command){
		case "":
			await showDomainInfo(bot, msg, user, domain, callback_data_prefix, true);

			break;

		case "NAME":
			var nano_admin_command = msg.data ? msg.data.split("|")[4] || "" : user.state.split("|")[4] || "";
			if(nano_admin_command == "EDIT"){
				var new_domain_name = msg.text.trim();
				if(new_domain_name == ""){
					await askNewDomainName(bot, msg, user, domain, callback_data_prefix);
				}else{
					domain.name = new_domain_name;
					user.state = callback_data_prefix;
					await showDomainInfo(bot, msg, user, domain, callback_data_prefix);
				}

			}else{
				user.state = `${callback_data_prefix}|NAME|EDIT`;
				await askNewDomainName(bot, msg, user, domain, callback_data_prefix, true);
			}
			

			break;
		case "CLIENT_ID":
			var nano_admin_command = msg.data ? msg.data.split("|")[4] || "" : user.state.split("|")[4] || "";
			if(nano_admin_command == "EDIT"){
				var new_client_id = msg.text.trim();
				if(new_client_id == ""){
					await askNewClientId(bot, msg, user, domain, callback_data_prefix);
				}else{
					domain.client_id = new_client_id;
					user.state = callback_data_prefix;
					await showDomainInfo(bot, msg, user, domain, callback_data_prefix);
				}

			}else{
				user.state = `${callback_data_prefix}|CLIENT_ID|EDIT`;
				await askNewClientId(bot, msg, user, domain, callback_data_prefix, true);
			}

		
			break;
		case "CLIENT_SECRET":
			var nano_admin_command = msg.data ? msg.data.split("|")[4] || "" : user.state.split("|")[4] || "";
			if(nano_admin_command == "EDIT"){
				var new_client_secret = msg.text.trim();
				if(new_client_secret == ""){
					await askNewClientSecret(bot, msg, user, domain, callback_data_prefix);
				}else{
					domain.client_secret = new_client_secret;
					user.state = callback_data_prefix;
					await showDomainInfo(bot, msg, user, domain, callback_data_prefix);
				}

			}else{
				user.state = `${callback_data_prefix}|CLIENT_SECRET|EDIT`;
				await askNewClientSecret(bot, msg, user, domain, callback_data_prefix, true);
			}
		
			break;
		case "REFRESH_TOKEN":
			var nano_admin_command = msg.data ? msg.data.split("|")[4] || "" : user.state.split("|")[4] || "";
			if(nano_admin_command == "EDIT"){
				var new_refresh_token = msg.text.trim();
				if(new_refresh_token == ""){
					await askNewRefreshToken(bot, msg, user, domain, callback_data_prefix);
				}else{
					domain.refresh_token = new_refresh_token;
					user.state = callback_data_prefix;
					await showDomainInfo(bot, msg, user, domain, callback_data_prefix);
				}

			}else{
				user.state = `${callback_data_prefix}|REFRESH_TOKEN|EDIT`;
				await askNewRefreshToken(bot, msg, user, domain, callback_data_prefix, true);
			}
		
			break;
		case "ENABLE":
			domain.disabled = false;
			await showDomainInfo(bot, msg, user, domain, callback_data_prefix, true);
		
			break;
		case "DISABLE":
			domain.disabled = true;
			await showDomainInfo(bot, msg, user, domain, callback_data_prefix, true);
	
			break;

		default:
			break;
	}
}

async function askNewRefreshToken(bot, msg, user, domain, callback_data_prefix, from_callback_query){
	var inline_keyboard = [[{"text": `🔙 Go Back`, "callback_data": `${callback_data_prefix}`}]];

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
		await bot.editMessageText(`Domain#${domain.id}: ${domain.name}\n\nProvide new Refresh Token -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			chat_id: chatId,
			message_id: messageId
		});
	}else{
		await bot.sendMessage(msg.chat.id, `Domain#${domain.id}: ${domain.name}\n\nProvide new Refresh Token -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
		});
	}	
}

async function askNewClientSecret(bot, msg, user, domain, callback_data_prefix, from_callback_query){
	var inline_keyboard = [[{"text": `🔙 Go Back`, "callback_data": `${callback_data_prefix}`}]];

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
		await bot.editMessageText(`Domain#${domain.id}: ${domain.name}\n\nProvide new Client Secret -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			chat_id: chatId,
			message_id: messageId
		});
	}else{
		await bot.sendMessage(msg.chat.id, `Domain#${domain.id}: ${domain.name}\n\nProvide new Client Secret -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
		});
	}	
}

async function askNewClientId(bot, msg, user, domain, callback_data_prefix, from_callback_query){
	var inline_keyboard = [[{"text": `🔙 Go Back`, "callback_data": `${callback_data_prefix}`}]];

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
		await bot.editMessageText(`Domain#${domain.id}: ${domain.name}\n\nProvide new Client ID -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			chat_id: chatId,
			message_id: messageId
		});
	}else{
		await bot.sendMessage(msg.chat.id, `Domain#${domain.id}: ${domain.name}\n\nProvide new Client ID -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
		});
	}	
}

async function askNewDomainName(bot, msg, user, domain, callback_data_prefix, from_callback_query){
	var inline_keyboard = [[{"text": `🔙 Go Back`, "callback_data": `${callback_data_prefix}`}]];

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
		await bot.editMessageText(`Domain#${domain.id}: ${domain.name}\n\nProvide new Name -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			chat_id: chatId,
			message_id: messageId
		});
	}else{
		await bot.sendMessage(msg.chat.id, `Domain#${domain.id}: ${domain.name}\n\nProvide new Name -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
		});
	}	
}

async function showDomainInfo(bot, msg, user, domain, callback_data_prefix, from_callback_query){
	var inline_keyboard = [
		[{"text": `🏷️ Name: ${domain.name}`, "callback_data": `${callback_data_prefix}|NAME`}]
	];

	if(module.exports.isOwner(user)){
		inline_keyboard.push([{"text": `🔑 Client ID: ${domain.client_id}`, "callback_data": `${callback_data_prefix}|CLIENT_ID`}]);
		inline_keyboard.push([{"text": `🔑 Client Secret: ${domain.client_secret}`, "callback_data": `${callback_data_prefix}|CLIENT_SECRET`}]);
		inline_keyboard.push([{"text": `🔑 Refresh Token: ${domain.refresh_token}`, "callback_data": `${callback_data_prefix}|REFRESH_TOKEN`}]);
	}

	inline_keyboard.push([{"text": (domain.disabled ? "🟢 Enable" : "🔴 Disable"), "callback_data": `${callback_data_prefix}|` + ((domain.disabled ? "ENABLE" : "DISABLE"))}]);
	inline_keyboard.push([{"text": `🔙 Go Back`, "callback_data": `ADMIN_MANAGE_DOMAINS`}]);

	if(from_callback_query){
		const chatId = msg.message.chat.id;
		const messageId = msg.message.message_id;
		await bot.editMessageText(`Domain#${domain.id} details -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }',
			chat_id: chatId,
			message_id: messageId
		});
	}else{
		await bot.sendMessage(msg.chat.id, `Domain#${domain.id} details -`, {
			reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
		});
	}
}

//Some default keyboard buttons
var admin_logout_control = [{"text": "🔒 Logout", "callback_data": "ADMIN_LOGOUT"}];
var go_home = [{"text": "🏠 Go Home", "callback_data": "ADMIN_INIT"}];
var new_domain_markup = [{"text": "🆕 Add New Domain", "callback_data": "ADMIN_MANAGE_DOMAINS|NEW_DOMAIN"}];
var page_bottom_controls = [{"text": "⏮", "callback_data": "ADMIN_MANAGE_DOMAINS|GO_TO_FIRST_PAGE"}, {"text": "⏪", "callback_data": "ADMIN_MANAGE_DOMAINS|GO_TO_PREV_PAGE"}, {"text": "⏩", "callback_data": "ADMIN_MANAGE_DOMAINS|GO_TO_NEXT_PAGE"}, {"text": "⏭", "callback_data": "ADMIN_MANAGE_DOMAINS|GO_TO_LAST_PAGE"}];


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

function generateDomainsMarkup(user){	
	var inline_keyboard = generateDomainsPage(user.current_domain_page);
	inline_keyboard.push(page_bottom_controls);
	if(module.exports.isOwner(user)){
		inline_keyboard.push(new_domain_markup);
	}
	inline_keyboard.push(go_home);
	return inline_keyboard;
}

function generateDomainsPage(page){
	var pageArr = [[]];
	pageNo = page - 1; // To make the code easy to read, pages and domain indices start from 1
	
	var currentPageLength = Math.min(all_domains.length - (pageNo * MAX_DOMAINS_PER_PAGE), MAX_DOMAINS_PER_PAGE);
	
	for(i=0; i<currentPageLength; i++){
		var domainIndex = pageNo*MAX_DOMAINS_PER_PAGE + i;
		var domain = all_domains[domainIndex];
		pageArr.push([{
			"text": (domainIndex+1) + ". " + domain.name + (domain.disabled ? "❗" : ""), 
			"callback_data": "ADMIN_MANAGE_DOMAINS|SELECT_DOMAIN|" + domain.id
		}]);
	}

	return pageArr;
}

function findDomainById(id){
	return all_domains.find(o => o.id == id);
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

async function saveConfigToDrive(){
	console.log("INFO:\tBacking up config...");
    var config_json = "module.exports = " + JSON.stringify(global.config) + ";";
    fs.writeFileSync(LOCAL_CONFIG_LOCATION + CONFIG_FILE_NAME, config_json, function(err) {
        if (err) console.error(err.stack || err);
    });

    console.log("INFO:\tBacking users-db...");
    var users_db_json = "module.exports = " + JSON.stringify(global.users) + ";";
    fs.writeFileSync(LOCAL_CONFIG_LOCATION + USERS_DB_FIlE_NAME, users_db_json, function(err) {
        if (err) console.error(err.stack || err);
    });
    
    console.log("INFO:\tUploading to Google Drive...");
    let copyCmd = "rclone copyto " + LOCAL_CONFIG_LOCATION + CONFIG_FILE_NAME + " " + BACKUP_RCLONE_REMOTE + BACKUP_CONFIG_PATH + " && ";
    copyCmd += "rclone copyto " + LOCAL_CONFIG_LOCATION + USERS_DB_FIlE_NAME + " " + BACKUP_RCLONE_REMOTE + BACKUP_USER_DB_PATH;
    console.log(copyCmd);
    return await exec(copyCmd);
}