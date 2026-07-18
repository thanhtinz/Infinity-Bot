require('dotenv').config({ quiet: true });

const env = process.env;
const read = (key, fallback = '') => env[key] ?? fallback;
const REQUIRED_ENV = ['DATABASE_URL', 'BOT_TOKEN', 'CLIENT_ID', 'OWNER_ID', 'ENCRYPTION_KEY'];

module.exports = {
    DATABASE_URL: read('DATABASE_URL'),
    BOT_TOKEN: read('BOT_TOKEN'),
    CLIENT_ID: read('CLIENT_ID'),
    OWNER_ID: read('OWNER_ID'),
    PREFIX: read('PREFIX', '!'),
    ENCRYPTION_KEY: read('ENCRYPTION_KEY'),
    DB_SYNC: read('DB_SYNC', 'true') !== 'false',

    getMissingRequiredEnv() {
        return REQUIRED_ENV.filter((key) => !read(key));
    }
};
