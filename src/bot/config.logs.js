require('dotenv').config({ quiet: true });

module.exports = {
    JOIN_LOGS: process.env.JOIN_LOGS_WEBHOOK_URL || '',
    LEAVE_LOGS: process.env.LEAVE_LOGS_WEBHOOK_URL || '',
    SLASH_LOGS: process.env.SLASH_LOGS_WEBHOOK_URL || '',
    PREFIX_LOGS: process.env.PREFIX_LOGS_WEBHOOK_URL || '',
    ERROR_LOGS: process.env.ERROR_LOGS_WEBHOOK_URL || '',
    DM_LOGS: process.env.DM_LOGS_WEBHOOK_URL || ''
};
