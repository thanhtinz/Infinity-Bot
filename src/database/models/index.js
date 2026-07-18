const sequelize = require('../sequelize');
const config = require('../../bot/config');

const UserAIConfig = require('./UserAIConfig');
const Reminder = require('./Reminder');
const Task = require('./Task');
const Expense = require('./Expense');
const ChatChannel = require('./ChatChannel');

const modelList = [
    UserAIConfig,
    Reminder,
    Task,
    Expense,
    ChatChannel,
];

for (const model of modelList) {
    if (Object.prototype.hasOwnProperty.call(model, 'init')) {
        model.init(sequelize);
    }
}

const models = {
    UserAIConfig,
    Reminder,
    Task,
    Expense,
    ChatChannel,
    sequelize
};

for (const model of Object.values(models)) {
    if (typeof model.associate === 'function') {
        model.associate(models);
    }
}

const dbReady = sequelize.authenticate()
    .then(async () => {
        if (!config.DB_SYNC) return true;
        await sequelize.sync();
        return true;
    })
    .catch((err) => {
        console.error('Database initialization error:', err.message || err.parent?.message || err.original?.message || err.code || String(err));
        throw err;
    });

models.dbReady = dbReady;

module.exports = models;
