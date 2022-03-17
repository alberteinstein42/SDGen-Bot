module.exports = {

	message: (bot, msg) => {
		//console.log(msg);
		try{
			var user = global.database.user[msg.from.id];
			if(!user){user = global.user_init; }
			handleMessage(bot, msg, user);
		}catch(ex){
			console.error(ex);
		}    		
	},

	callback_query: (bot, msg) => {
		//console.log(msg);
		
		var user = global.database.user[msg.from.id];
		if(!user){user = global.user_init; }

		handleCallbackQuery(bot, msg, user);
		
	}
};

function handleCallbackQuery(bot, msg, user){
	const chatId = msg.message.chat.id;

	switch(msg.data){
		case 'ENTER_EMAIL':
			bot.editMessageText("Email Address? -", {
				message_id: msg.message.message_id,
				chat_id: chatId
			});

			user.state = 'ENTER_EMAIL';
			break;
		case 'GO_TO_FIRST_PAGE':
			break;
		case 'GO_TO_PREV_PAGE':
			break;
		case 'GO_TO_NEXT_PAGE':
			break;
		case 'GO_TO_LAST_PAGE':
			break;


		default:

	}

	//Handling the dynamic SELECTED_DOMAIN_XX separately
	if(msg.data.startsWith("SELECTED_DOMAIN_")){
		var selectedDomain = msg.data.split("SELECTED_DOMAIN_")[1];
		bot.editMessageText("Processing your request to create TD on Domain #" + selectedDomain, {
			message_id: msg.message.message_id,
			chat_id: chatId
		});
	}
}

function validateEmail(emailAdress){
	let regexEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
	if (emailAdress.match(regexEmail)) {
		return true; 
	} else {
		return false; 
	}
}

function handleMessage(bot, msg, user){
	const chatId = msg.chat.id;

	switch(user.state){
		case 'ENTER_EMAIL':
			if(!validateEmail(msg.text.trim())){
				bot.sendMessage(chatId, "Invalid Email Address, please provide a valid email. - ");	
				break;
			}
			user.state = "ENTER_TD_NAME";
			user.data.email = msg.text.trim();
			bot.sendMessage(chatId, "Drive Name? - ");
			break;

		case 'ENTER_TD_NAME':
			user.state = "SELECT_DOMAIN";
			user.data.td_name = msg.text.trim();
			
			var inline_keyboard = generateDomainsMarkup(user);			
			bot.sendMessage(chatId, "Select Domain - ", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
			});
			break;

		default:
			var inline_keyboard = [
				[{"text": "💽 Generate TD", "callback_data": "ENTER_EMAIL"}], 
				[{"text": "❌ Cancel", "callback_data": "CANCEL"}]
			]; 
			bot.sendMessage(chatId, "Hi, welcome to MsGSuite-NG.", {
				reply_markup: '{ "inline_keyboard": '+ JSON.stringify(inline_keyboard) + ' }'
			});
	}
}


function generateDomainsMarkup(user){
	var domains = global.msgsuite_ng_config.domains;
	var bottom_controls = [{"text": "⏮", "callback_data": "GO_TO_FIRST_PAGE"}, {"text": "⏪", "callback_data": "GO_TO_PREV_PAGE"}, {"text": "⏩", "callback_data": "GO_TO_NEXT_PAGE"}, {"text": "⏭", "callback_data": "GO_TO_LAST_PAGE"}];
	var cancel_control = [{"text": "❌ Cancel", "callback_data": "CANCEL"}];

	
	var inline_keyboard = generateDomainsPage(user.current_domain_page);
	inline_keyboard.push(bottom_controls);
	inline_keyboard.push(cancel_control);
	return inline_keyboard;
}

function generateDomainsPage(pageNo){
	pageNo = pageNo - 1; // To make the code easy to read, pages and domain indices start from 1
	var domains = global.msgsuite_ng_config.domains;
	var currentPageLength = Math.min(domains.length - (pageNo * 10), 10);
	var emoji_numbers = ["0⃣", "1⃣", "2⃣", "3⃣", "4⃣", "5⃣", "6⃣", "7⃣", "8⃣", "9⃣", "🔟"];

	var pageArr = [[{"text": "🎲 Random", "callback_data": "SELECTED_DOMAIN_RANDOM"}]];
	for(i=0; i<currentPageLength; i++){
		var domainIndex = pageNo*10 + i;
		var domain = domains[domainIndex];
		pageArr.push([
			{"text": emoji_numbers[domainIndex+1] + " " + domain.name, "callback_data": "SELECTED_DOMAIN_" + (domainIndex+1)}
		]);
	}

	return pageArr;
}