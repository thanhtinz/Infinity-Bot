


const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, ActivityType } = require('discord.js');
const Dokdo = require('dokdo');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { loadSlashCommands, loadPrefixCommands, loadHybridCommands, reloadAllCommands } = require('./utils/commandLoader');
const { colors, printHeader, printLoading, printSuccess, printError, printInfo, printSystemReady } = require('./utils/consoleLogger');
const botLogger = require('./utils/botLogger');

printHeader();

function formatStartupError(error) {
  return error?.message || error?.parent?.message || error?.original?.message || error?.code || String(error);
}

const missingEnv = config.getMissingRequiredEnv();
if (missingEnv.length > 0) {
  printError(`Missing required environment variables: ${missingEnv.join(', ')}`);
  printInfo('Create a .env file from .env.example before starting Main.');
  process.exit(1);
}

const _emitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  const msg = typeof warning === 'string' ? warning : warning?.message ?? '';
  if (msg.includes('ready event has been renamed to clientReady')) return;
  return _emitWarning.call(process, warning, ...args);
};

global.main = {
  bot: { color: '#5865F2' },
  addons: {
    ai: { geminiApiKeys: null }
  },
  db: { timezone: '+00:00' }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();
client.prefixCommands = new Collection();

if (!process.env.SHELL) process.env.SHELL = '/bin/bash';

client.dokdo = new Dokdo.Client(client, {
  prefix: config.PREFIX,
  aliases: ['dok', 'jsk'],
  owners: [config.OWNER_ID],
  secrets: [config.BOT_TOKEN]
});

client.reloadAllCommands = function () {
  try {
    return reloadAllCommands(this, __dirname);
  } catch (error) {
    return { success: false, message: 'Failed to reload commands', error: error.stack };
  }
};

const commandsPath = path.join(__dirname, 'commands');
const pCommandsPath = path.join(__dirname, 'pCommands');
const hybridPath = path.join(__dirname, 'hybrid');

loadSlashCommands(client, commandsPath);
loadPrefixCommands(client, pCommandsPath);
loadHybridCommands(client, hybridPath);

printLoading('Event handlers');
const eventsPath = path.join(__dirname, 'events');
let loadedEvents = 0;

if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if ('name' in event && 'execute' in event) {
      client.on(event.name, (...args) => event.execute(...args, client));
      loadedEvents++;
    }
  }
  const eventSubdirs = ['logging', 'antinuke', 'automod'];
  const subdirsLoaded = [];
  for (const subdir of eventSubdirs) {
    const subdirPath = path.join(eventsPath, subdir);
    if (!fs.existsSync(subdirPath)) continue;

    const files = fs.readdirSync(subdirPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const mod = require(path.join(subdirPath, file));
      if ('init' in mod && typeof mod.init === 'function') mod.init(client);
    }
    subdirsLoaded.push(subdir);
  }

  const standaloneInits = [
    { file: 'welcomeEvent.js', label: 'welcome' },
    { file: 'farewellEvent.js', label: 'farewell' },
    { file: 'snipeEvent.js',   label: 'snipe' }
  ];
  const standaloneLoaded = [];
  for (const { file, label } of standaloneInits) {
    const filePath = path.join(eventsPath, file);
    if (!fs.existsSync(filePath)) continue;
    const mod = require(filePath);
    if ('init' in mod && typeof mod.init === 'function') {
      mod.init(client);
      standaloneLoaded.push(label);
    }
  }

  const allModules = [...subdirsLoaded, ...standaloneLoaded].join(', ');
  printSuccess(`Event handlers ready - ${loadedEvents} events - ${allModules}`);
} else {
  printInfo('No events directory found, skipping event loading');
}

printLoading('Database connection');
const models = require('../database/models');

const dbModules = {
  aiChannel: require('../database/aiChannel'),
  aiHistory: require('../database/aiHistory'),
  autobump: require('../database/autobump'),
  commandLock: require('../database/commandLock'),
  feedback: require('../database/feedback'),
  userStats: require('../database/userStats'),
  vanityRoles: require('../database/vanityRoles'),
  ignoreDb: require('../database/ignoreDb'),
  mediaDb: require('../database/mediaDb'),
  reminders: require('../database/reminders'),
};

const dbInitPromise = Promise.all([
  models.dbReady,
  ...Object.values(dbModules).map(m => m.dbReady)
]).then(() => {
  printSuccess('Database initialized and all tables synced');
}).catch(err => {
  printError('Database initialization failed: ' + formatStartupError(err));
  throw err;
});

client.once('clientReady', async () => {
  printSuccess(`Authentication successful -> ${colors.PURPLE}${client.user.tag}${colors.RESET}`);

  client.user.setPresence({
    status: 'idle',
    activities: [{
      name: `${config.PREFIX}help | @Main`,
      type: ActivityType.Listening
    }]
  });

  printLoading('Synchronizing slash commands');
  try {
    await registerCommands();
    printSuccess(`Command synchronization complete (${client.commands.size} commands)`);
  } catch (error) {
    printError(`Failed to register commands: ${error.message}`);
  }

  printInfo(`Connected to ${client.guilds.cache.size} guilds`);

  try {
    const { checkGiveaways } = require('./utils/giveawayUtils');
    setInterval(() => { checkGiveaways(client); }, 10000);

    const { startBackgroundRefresh: startAnimalRefresh } = require('./utils/animalApi');
    startAnimalRefresh();

  } catch (error) {
    printError('Failed to initialize database-dependent systems: ' + error.message);
  }

  printSystemReady();
});

const COMMAND_HASH_FILE = path.join(__dirname, '.command_hash');

async function registerCommands() {
  const commands = [];

  for (const command of client.commands.values()) {
    const commandData = command.data.toJSON();
    commandData.integration_types = [0, 1];
    commandData.contexts = [0, 1, 2];
    commands.push(commandData);
  }

  const currentHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(commands))
    .digest('hex');

  let savedHash = null;
  try {
    savedHash = fs.readFileSync(COMMAND_HASH_FILE, 'utf8').trim();
  } catch (_) {}

  if (savedHash === currentHash) {
    printInfo('Slash commands unchanged - skipping registration');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);
  await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: commands });

  fs.writeFileSync(COMMAND_HASH_FILE, currentHash, 'utf8');
}

client.on('error', (error) => {
  printError(`Discord client error: ${error.message}`);
  botLogger.logError(error, 'Discord client error', client).catch(() => {});
});

process.on('unhandledRejection', (error) => {
  printError(`Unhandled rejection: ${error?.message ?? String(error)}`);
  botLogger.logError(error instanceof Error ? error : new Error(String(error)), 'Unhandled rejection', client).catch(() => {});
});

process.on('uncaughtException', (error) => {
  printError(`Uncaught exception: ${error.message}`);
  botLogger.logError(error, 'Uncaught exception', client).then(() => process.exit(1)).catch(() => process.exit(1));
});

async function gracefulShutdown(signal) {
  console.log(`\n${colors.YELLOW}Warning${colors.RESET}  Received ${signal}, shutting down gracefully...`);
  client.destroy();
  try {
    await models.sequelize.close();
  } catch (_) {}
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Dashboard status API: a small, secret-protected HTTP server the web dashboard backend calls
// server-to-server to read live guild/channel/role/member data. Purely additive - does not affect
// Discord client startup, commands, or events.
try {
  const { createDashboardApi } = require('./dashboardApi');
  const dashboardApiPort = Number(process.env.BOT_API_PORT) || 3002;
  createDashboardApi(client).listen(dashboardApiPort, () => {
    printSuccess(`Dashboard status API listening on :${dashboardApiPort}`);
  });
} catch (error) {
  printError(`Failed to start dashboard status API: ${error.message}`);
}

printLoading('Discord authentication');
dbInitPromise.then(() => {
  return client.login(config.BOT_TOKEN);
}).catch(error => {
  printError(`Startup failed: ${formatStartupError(error)}`);
  process.exit(1);
});
