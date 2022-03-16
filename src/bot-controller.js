module.exports = {

	handle: (bot, msg) => {
		const chatId = msg.chat.id;
    	bot.sendMessage(chatId, "Received"
    		{
    			reply_markup:[{
    				"text": "Generate TD",
    				"callback_data": "generate_td"
    			}]
    		});
	}
};