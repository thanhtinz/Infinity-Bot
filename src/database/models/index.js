const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const config = require('../../bot/config');

const NoPrefix = require('./NoPrefix');
const AFK = require('./AFK');
const J2CConfig = require('./J2CConfig');
const TempChannel = require('./TempChannel');
const Todo = require('./Todo');
const GuildPrefix = require('./GuildPrefix');
const GuildLanguage = require('./GuildLanguage');
const Blacklist = require('./Blacklist');
const LoggingConfig = require('./LoggingConfig');
const WelcomeConfig = require('./WelcomeConfig');
const FarewellConfig = require('./FarewellConfig');
const Profile = require('./Profile');
const AutoReact = require('./AutoReact');
const AntinukeConfig = require('./AntinukeConfig');
const AntinukeWhitelist = require('./AntinukeWhitelist');
const AutomodConfig = require('./AutomodConfig');
const AutomodWhitelist = require('./AutomodWhitelist');
const GuildConfig = require('./GuildConfig');
const ModLog = require('./ModLog');
const WarnPunishConfig = require('./WarnPunishConfig');
const Giveaway = require('./Giveaway');
const GiveawayEntry = require('./GiveawayEntry');
const ReactionRoles = require('./ReactionRoles');
const TicketConfig = require('./TicketConfig');
const TicketCategory = require('./TicketCategory');
const Ticket = require('./Ticket');
const StatsChannelConfig = require('./StatsChannelConfig');
const Birthday = require('./Birthday');
const BirthdayConfig = require('./BirthdayConfig');
const StarboardConfig = require('./StarboardConfig');
const StarboardPost = require('./StarboardPost');
const VerificationConfig = require('./VerificationConfig');
const StickyNickname = require('./StickyNickname');
const AdminUser = require('./AdminUser');
const BotRuntimeConfig = require('./BotRuntimeConfig');
const MessageOverride = require('./MessageOverride');

const modelList = [
    NoPrefix,
    AFK,
    J2CConfig,
    TempChannel,
    Todo,
    GuildPrefix,
    GuildLanguage,
    Blacklist,
    LoggingConfig,
    WelcomeConfig,
    FarewellConfig,
    Profile,
    AutoReact,
    AntinukeConfig,
    AntinukeWhitelist,
    AutomodConfig,
    AutomodWhitelist,
    GuildConfig,
    ModLog,
    WarnPunishConfig,
    Giveaway,
    GiveawayEntry,
    ReactionRoles,
    TicketConfig,
    TicketCategory,
    Ticket,
    StatsChannelConfig,
    Birthday,
    BirthdayConfig,
    StarboardConfig,
    StarboardPost,
    VerificationConfig,
    StickyNickname,
    AdminUser,
    BotRuntimeConfig,
    MessageOverride
];

for (const model of modelList) {
    if (Object.prototype.hasOwnProperty.call(model, 'init')) {
        model.init(sequelize);
    }
}

const models = {
    NoPrefix,
    AFK,
    J2CConfig,
    TempChannel,
    Todo,
    GuildPrefix,
    GuildLanguage,
    Blacklist,
    LoggingConfig,
    WelcomeConfig,
    FarewellConfig,
    Profile,
    AutoReact,
    AntinukeConfig,
    AntinukeWhitelist,
    AutomodConfig,
    AutomodWhitelist,
    GuildConfig,
    ModLog,
    WarnPunishConfig,
    Giveaway,
    GiveawayEntry,
    ReactionRoles,
    TicketConfig,
    TicketCategory,
    Ticket,
    StatsChannelConfig,
    Birthday,
    BirthdayConfig,
    StarboardConfig,
    StarboardPost,
    VerificationConfig,
    StickyNickname,
    AdminUser,
    BotRuntimeConfig,
    MessageOverride,
    sequelize
};

for (const model of Object.values(models)) {
    if (typeof model.associate === 'function') {
        model.associate(models);
    }
}

async function safeAddIndex(qi, table, fields, options = {}) {
    try {
        await qi.addIndex(table, fields, options);
    } catch (error) {
        const msg = error.message || '';
        if (msg.includes('already exists') || error.original?.code === '42P07' || error.original?.code === '42701') return;
        throw error;
    }
}

async function applyCompatibilitySchemaUpdates() {
    const qi = sequelize.getQueryInterface();

    const ticketConfigCols = await qi.describeTable('ticket_config').catch(() => null);
    if (ticketConfigCols && !ticketConfigCols.additionalRoleIds) {
        await qi.addColumn('ticket_config', 'additionalRoleIds', {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: '[]'
        });
    }
    if (ticketConfigCols && !ticketConfigCols.panelMessageId) {
        await qi.addColumn('ticket_config', 'panelMessageId', {
            type: DataTypes.STRING,
            allowNull: true
        });
    }

    await Promise.all([
        safeAddIndex(qi, 'giveaways', ['ended', 'endTime'], { name: 'giveaways_ended_endtime' }),
        safeAddIndex(qi, 'giveaways', ['guildId'], { name: 'giveaways_guild_id' }),
        safeAddIndex(qi, 'giveaway_entries', ['giveawayId'], { name: 'giveaway_entries_giveaway_id' }),
        safeAddIndex(qi, 'giveaway_entries', ['giveawayId', 'userId'], { name: 'giveaway_entries_giveaway_user', unique: true }),
        safeAddIndex(qi, 'auto_react', ['guildId'], { name: 'auto_react_guild_id' }),
        safeAddIndex(qi, 'ticket_categories', ['guildId'], { name: 'ticket_categories_guild_id' }),
        safeAddIndex(qi, 'ticket_categories', ['guildId', 'categoryName'], { name: 'ticket_categories_guild_category' })
    ]);
}

const dbReady = sequelize.authenticate()
    .then(async () => {
        if (!config.DB_SYNC) return true;

        await sequelize.sync();
        await applyCompatibilitySchemaUpdates();
        return true;
    })
    .catch((err) => {
        console.error('Database initialization error:', err.message || err.parent?.message || err.original?.message || err.code || String(err));
        throw err;
    });

models.dbReady = dbReady;

module.exports = models;
