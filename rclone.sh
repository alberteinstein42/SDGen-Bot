#!/bin/bash
#

#loading Environment Variables and if they doesn't exits then loading default values
#Backup Paths
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-MyBotComfigRemote:}"
BACKUP_CONFIG_PATH="${BACKUP_CONFIG_PATH:-config/config.js}"
BACKUP_USER_DB_PATH="${BACKUP_USER_DB_PATH:-config/users-db.js}"
#Local Paths
LOCAL_CONFIG_LOCATION="${LOCAL_CONFIG_LOCATION:-./config/}"
SAMPLE_CONFIG_LOCATION="${SAMPLE_CONFIG_LOCATION:-./src/sample-config/}"
CONFIG_FILE_NAME="${CONFIG_FILE_NAME:-config.js}"
USERS_DB_FIlE_NAME="${USERS_DB_FIlE_NAME:-users-db.js}"

#rclone config loading
if [[ -z "${CONFIG_RCLONE}" ]]; then
	echo "ERROR: rclone config Environment Variable is not set, please do it on CONFIG_RCLONE"
	echo "ERROR: Without rclone config, sample configuration would be loaded, without Bot Token"
else
	echo "loading rclone config from ENV VARs"
	#echo "Config VAR Data = $CONFIG_RCLONE"
	echo "Saving to /app/.config/rclone/rclone.conf"
	mkdir -p /app/.config/rclone/ 
	echo -e "$CONFIG_RCLONE" > /app/.config/rclone/rclone.conf
	echo "Saved config"
	ls -l /app/.config/rclone/

	#echo "Config data - "
	#cat /app/.config/rclone/rclone.conf

	rclone config file

	#Getting the config file and users database for bot
	echo "Downloading Bot Configuration"
	rclone copy $BACKUP_RCLONE_REMOTE$BACKUP_CONFIG_PATH $LOCAL_CONFIG_LOCATION
	rclone copy $BACKUP_RCLONE_REMOTE$BACKUP_USER_DB_PATH $LOCAL_CONFIG_LOCATION
	pwd
	ls $LOCAL_CONFIG_LOCATION

	echo "Bot Configuration put in place"
fi

if [[ -z "${NTBA_FIX_319}" ]]; then
	echo -e "SUGGN:\tSet Environment Variable NTBA_FIX_319 to some value to manually enable automatic cancellation of promises."
fi	
