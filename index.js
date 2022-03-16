const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const botController = require("./src/bot-controller");


//REST Server
const app = express();
app.use(helmet());
app.use(bodyParser.json());
app.use(cors());
app.use(morgan('combined'));
app.get('/', (req, res) => {
    res.send({"status": "ok"});
});


app.listen(80, () => {
    console.log('listening on port 80');
});


//Telegram Bot Server
const token = process.env.BOT_TOKEN; //save config vars in settings of the heroku project
const bot = new TelegramBot(token, {polling: true});


bot.on('message', (msg) => {
    botController.handle(bot, msg);
});