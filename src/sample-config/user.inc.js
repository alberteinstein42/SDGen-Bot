//No need to load this file in users-db.js config, this is used as template to create new user

module.exports = {
    "state": "INIT", //Initial state of User
    "telegram": {}, //Telegram Object of user
    "current_domain_page": 1,
    "banned": false,
    "admin_td_grant": 0,
    "current_td_request": {},
    "drives": [],
    "inputError": false
}