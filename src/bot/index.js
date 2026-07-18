const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');
const path = require('path');
const config = require('./config');
const { loadSlashCommands, loadEvents } = require('./utils/commandLoader');

const missingEnv = config.getMissingRequiredEnv();
if (missingEnv.length > 0) {
    console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
    console.error('Create a .env file from .env.example before starting Infinity Bot.');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
});

client.commands = new Collection();

loadSlashCommands(client, path.join(__dirname, 'commands'));
loadEvents(client, path.join(__dirname, 'events'));

console.log('[db] connecting...');
const models = require('../database/models');

async function registerCommands() {
    const commands = [...client.commands.values()].map((c) => c.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);
    await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: commands });
    console.log(`[commands] registered ${commands.length} slash commands`);
}

client.once('clientReady', async () => {
    console.log(`[bot] logged in as ${client.user.tag}`);
    try {
        await registerCommands();
    } catch (error) {
        console.error('[commands] failed to register:', error.message);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[commands] error running ${interaction.commandName}:`, error);
        const payload = { content: 'Something went wrong running that command.', ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(payload).catch(() => {});
        else await interaction.reply(payload).catch(() => {});
    }
});

client.on('error', (error) => console.error('[bot] client error:', error));
process.on('unhandledRejection', (error) => console.error('[bot] unhandled rejection:', error));

async function gracefulShutdown(signal) {
    console.log(`Received ${signal}, shutting down...`);
    client.destroy();
    try { await models.sequelize.close(); } catch (_) {}
    process.exit(0);
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

models.dbReady
    .then(() => {
        console.log('[db] ready');
        return client.login(config.BOT_TOKEN);
    })
    .catch((error) => {
        console.error('[bot] startup failed:', error.message);
        process.exit(1);
    });
