const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const { exec } = require("child_process");


const configLoader = require("./config-loader.js");
configLoader.load();
const token = config.BOT_TOKEN;
if(!token) { console.log("FATAL:\tBot Token not found in config file."); process.exit(1); }



//REST Server - for status checking and prevent idling
const app = express();
app.use(helmet());
app.use(bodyParser.json());
app.use(cors());
//app.use(morgan('combined'));

app.get('/', (req, res) => {
    res.send({"status": "ok"});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('listening on port '+ PORT);
});


//Telegram Bot Server
const botController = require("./src/bot-controller");
const bot = new TelegramBot(token, {polling: true});

bot.on('message', async (msg) => {
    try{
        await botController.message(bot, msg);
    }catch(ex){
        console.error(ex);
    }
});

bot.on('callback_query', async (msg) => {
    try{
        await botController.callback_query(bot, msg);
    }catch(ex){
        console.error(ex);
    }
});


//Set up graceful shutdown behaviour
//Save database to Google Drive
process
  .on('SIGTERM', shutdown('SIGTERM'))
  .on('SIGINT', shutdown('SIGINT'))
  .on('uncaughtException', shutdown('uncaughtException'));

function shutdown(signal) {
  return (err) => {
    console.log(`INFO:\t${ signal }...`);
    console.error(err.stack || err)
    console.log("INFO:\tProcessing SHUTDOWN triggers...");


    console.log("INFO:\tBacking up config...");
    var config_json = "module.exports = " + JSON.stringify(config) + ";";
    fs.writeFileSync(LOCAL_CONFIG_LOCATION + CONFIG_FILE_NAME, config_json, function(err) {
        if (err) console.error(err.stack || err);
    });

    console.log("INFO:\tBacking users-db...");
    var users_db_json = "module.exports = " + JSON.stringify(users) + ";";
    fs.writeFileSync(LOCAL_CONFIG_LOCATION + USERS_DB_FIlE_NAME, users_db_json, function(err) {
        if (err) console.error(err.stack || err);
    });

    if(process.env.NO_UPLOAD == "TRUE"){ process.exit(err ? 1 : 0);  }
    
    console.log("INFO:\tUploading to Google Drive...");
    let copyCmd = "rclone copyto " + LOCAL_CONFIG_LOCATION + CONFIG_FILE_NAME + " " + BACKUP_RCLONE_REMOTE + BACKUP_CONFIG_PATH + " && ";
    copyCmd += "rclone copyto " + LOCAL_CONFIG_LOCATION + USERS_DB_FIlE_NAME + " " + BACKUP_RCLONE_REMOTE + BACKUP_USER_DB_PATH;
    exec(copyCmd, (err, stdout, stderr) => {
        
        if (err) {
            console.log(`error: ${err.message}`);
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
        }

        console.log(`stdout: ${stdout}`);
        process.exit(err ? 1 : 0);

        return err;
    });
  };
}