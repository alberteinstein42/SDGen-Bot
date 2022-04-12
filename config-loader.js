module.exports = {
	"load": () => {
		//Backup Config
		global.BACKUP_RCLONE_REMOTE = process.env.BACKUP_RCLONE_REMOTE; 
		global.BACKUP_CONFIG_PATH = process.env.BACKUP_CONFIG_PATH; 
		global.BACKUP_USER_DB_PATH = process.env.BACKUP_USER_DB_PATH; 
		if(!BACKUP_RCLONE_REMOTE || !BACKUP_CONFIG_PATH || !BACKUP_USER_DB_PATH){
			console.log("WARN:\tBackup path not configured properly. Configuration updates and User data will be lost every restart.");
			console.log("SUGGN:\tSet Environment Variables - BACKUP_RCLONE_REMOTE, BACKUP_CONFIG_PATH and BACKUP_USER_DB_PATH accordingly.");
		}

		//Loading Configuration, App Data and Default Settings
		global.LOCAL_CONFIG_LOCATION = process.env.LOCAL_CONFIG_LOCATION || "./config/";
		global.SAMPLE_CONFIG_LOCATION = process.env.SAMPLE_CONFIG_LOCATION || "./src/sample-config/";
		global.CONFIG_FILE_NAME = process.env.CONFIG_FILE_NAME || "config.js";
		global.USERS_DB_FIlE_NAME = process.env.USERS_DB_FIlE_NAME || "users-db.js";

		//App Config
		try { global.config = require(LOCAL_CONFIG_LOCATION + global.CONFIG_FILE_NAME); }catch(ex) {}
		if(!global.config){ 
			console.log("ERROR:\tWhile loading CONFIG, make sure the config.js file exists at " + LOCAL_CONFIG_LOCATION);
			console.log("INFO:\tLoading from default configuration - src/sample-config/config.inc.js");
			global.config = require(SAMPLE_CONFIG_LOCATION + "config.inc.js");

			console.log("WARN:\tSample config loaded, bot might not work as intended!");
		}

		//App Data - users-db
		try { global.users = require(LOCAL_CONFIG_LOCATION + global.USERS_DB_FIlE_NAME); } catch(ex) {}
		if(!global.users){ 
			console.log("ERROR:\tWhile loading Users Data, make sure the users-db.js file exists at " + LOCAL_CONFIG_LOCATION); 
			console.log("INFO:\tLoading from default configuration - src/sample-config/users-db.inc.js"); 
			global.config = require(SAMPLE_CONFIG_LOCATION + "users-db.inc.js");
		}

	}
}