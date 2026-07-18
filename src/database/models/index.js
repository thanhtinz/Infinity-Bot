const sequelize = require('../sequelize');
const config = require('../../bot/config');

const UserAIConfig = require('./UserAIConfig');

const modelList = [
    UserAIConfig,
];

for (const model of modelList) {
    if (Object.prototype.hasOwnProperty.call(model, 'init')) {
        model.init(sequelize);
    }
}

const models = {
    UserAIConfig,
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
