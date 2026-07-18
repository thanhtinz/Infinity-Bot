const { Sequelize } = require('sequelize');
const config = require('../bot/config');

const sequelize = new Sequelize(config.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    define: {
        timestamps: true,
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    retry: {
        max: 5,
        match: [
            /SequelizeConnectionError/,
            /SequelizeConnectionRefusedError/,
            /SequelizeHostNotFoundError/,
            /SequelizeHostNotReachableError/,
            /SequelizeInvalidConnectionError/,
            /SequelizeConnectionTimedOutError/,
            /ECONNRESET/,
            /ECONNREFUSED/,
        ],
    }
});

module.exports = sequelize;
