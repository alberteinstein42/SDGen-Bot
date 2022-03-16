module.exports = {

	handle: (bot, msg) => {
		const chatId = msg.chat.id;
    	bot.sendMessage(chatId,
    		{
    			text: "Received"
    		});
	}
};