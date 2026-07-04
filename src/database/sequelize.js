const { Sequelize } = require('sequelize');
const config = require('../bot/config.js');

const DATABASE_URL = process.env.DATABASE_URL || config.DATABASE_URL;
const useMemoryDb = DATABASE_URL.startsWith('memory://');

const memoryOptions = useMemoryDb
    ? { dialectModule: require('./memoryDb').pg }
    : {};

const sequelize = new Sequelize(useMemoryDb ? 'postgres://postgres:postgres@localhost:5432/main' : DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    ...memoryOptions,
    define: {
        timestamps: true,
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    dialectOptions: {},
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
