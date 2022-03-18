const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const botController = require("./src/bot-controller");

//Loading Configuration from Config Vars/Environment Variables
const PORT = process.env.PORT || 80;
const token = process.env.BOT_TOKEN;
var msgsuite_ng_config = require("./config");
if(!msgsuite_ng_config){ console.log("Error loading MSGSUITE_NG_CONFIG, make sure the config.js file is made."); process.exit(1); }




//poor man's key-value pair database
//this might be cleared at every dyno restart and possible app crash
//but the bot is not critical, and can work with some working data loss
//worst case scenario - bot will ask all the details, again.
global.database = { user: []}; 
global.user_init = { state: 'INIT', current_domain_page: 1, data: { email: undefined, td_name: undefined, domain: undefined } };
global.msgsuite_ng_config = msgsuite_ng_config;


//REST Server - for status checking and prevent idling
const app = express();
app.use(helmet());
app.use(bodyParser.json());
app.use(cors());
app.use(morgan('combined'));
app.get('/', (req, res) => {
    res.send({"status": "ok"});
});


app.listen(PORT, () => {
    console.log('listening on port '+ PORT);
});


//Telegram Bot Server
const bot = new TelegramBot(token, {polling: true});


bot.on('message', (msg) => {
    botController.message(bot, msg);
});


bot.on('callback_query', (msg) => {
    try{
        botController.callback_query(bot, msg);
    }catch(e){
        console.error(e);
    }
});