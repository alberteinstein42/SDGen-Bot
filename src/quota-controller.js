const MAX_TD_PER_USER = global.config.MAX_TD_PER_USER;
const TD_DYNAMIC_QUOTA = global.config.TD_DYNAMIC_QUOTA;

module.exports = {
	tdQuotaExhausted: (user) => {

		//If per user quota setting is disabled, then use daily quota system
		if(MAX_TD_PER_USER == -1){
			return module.exports.tdDailyQuotaExhausted(user);
		}

		if(user.drives.length >= MAX_TD_PER_USER){
			return true;
		}

		return false;
	},


	//Working - Sorts the user drives list, then calculates the number of TDs created in last x days. X = TD_DYNAMIC_QUOTA.DAYS
	//If the number of TDs in those x days is greater or equal to the quota for that period, then user is prompted with error
	//Else he's allowed to create TDs
	tdDailyQuotaExhausted: (user) => {
		sortUserDrives(user);


		var cut_off_date = (new Date()).addDays(-TD_DYNAMIC_QUOTA.DAYS);

		var tds_after_cutoff = 0;
		var first_td_after_cutoff;

		for(drive of user.drives){
			
			if(typeof drive.date == "string"){ drive.date = new Date(drive.date); }
			if(drive.date > cut_off_date){ 
				tds_after_cutoff++; 
				first_td_after_cutoff = first_td_after_cutoff || drive;
			}
		}

		user.tds_after_cutoff = tds_after_cutoff;

		if(tds_after_cutoff >= TD_DYNAMIC_QUOTA.TDS + user.admin_td_grant){
			user.first_td_after_cutoff = first_td_after_cutoff;
			
			return true;
		}

		return false;
	}
};

function sortUserDrives(user){
	user.drives.sort(function(a, b) {
		var dateA = new Date(a.date), dateB = new Date(b.date);
		
		if (dateA < dateB) return -1;
		if (dateA > dateB) return 1;
		return 0;
	});
}