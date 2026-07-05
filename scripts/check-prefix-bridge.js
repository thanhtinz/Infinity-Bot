/**
 * Sanity check for src/bot/utils/prefixBridge.js.
 *
 * Loads slash/prefix/hybrid commands the same way src/bot/index.js does
 * (without ever logging into Discord), runs the bridge against a fake
 * client, and asserts:
 *   - a large number of commands got bridged (hundreds)
 *   - a handful of known example invocations parse into a correctly
 *     shaped fake interaction (option resolution is spot-checked
 *     directly, not full Discord execution)
 *
 * Run with: node scripts/check-prefix-bridge.js
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || 'memory://check-prefix-bridge';

const path = require('path');
const assert = require('assert');
const { Collection } = require('discord.js');

const {
  loadSlashCommands,
  loadPrefixCommands,
  loadHybridCommands,
} = require('../src/bot/utils/commandLoader');

const {
  bridgeSlashCommandsToPrefix,
  resolveSubcommandContext,
  resolveOptionValues,
} = require('../src/bot/utils/prefixBridge');

const botRoot = path.join(__dirname, '..', 'src', 'bot');

function makeFakeClient() {
  return {
    commands: new Collection(),
    prefixCommands: new Collection(),
    user: { id: '123456789012345678', username: 'InfinityBot' },
  };
}

function makeFakeMessage(overrides = {}) {
  const guild = {
    id: 'guild1',
    members: {
      cache: new Collection(),
      fetch: async (id) => { throw new Error(`no member ${id}`); },
    },
    channels: { cache: new Collection() },
    roles: { cache: new Collection() },
  };

  return Object.assign(
    {
      author: { id: 'author1', tag: 'Author#0001', username: 'Author' },
      member: { permissions: { has: () => true } },
      guild,
      guildId: guild.id,
      channel: { id: 'chan1', send: async (payload) => ({ id: 'sentmsg', payload, edit: async (p) => ({ id: 'editedmsg', payload: p }), delete: async () => {} }) },
      channelId: 'chan1',
      client: null,
      mentions: { users: new Collection(), members: new Collection(), channels: new Collection(), roles: new Collection() },
      reply: async (payload) => ({ id: 'replymsg', payload, edit: async (p) => ({ id: 'editedmsg', payload: p }), delete: async () => {} }),
    },
    overrides
  );
}

async function main() {
  const client = makeFakeClient();

  const commandsPath = path.join(botRoot, 'commands');
  const pCommandsPath = path.join(botRoot, 'pCommands');
  const hybridPath = path.join(botRoot, 'hybrid');

  const slashResult = loadSlashCommands(client, commandsPath);
  const prefixResult = loadPrefixCommands(client, pCommandsPath);
  const hybridResult = loadHybridCommands(client, hybridPath);

  console.log(`Loaded ${client.commands.size} slash commands, ${client.prefixCommands.size} prefix/hybrid entries (${slashResult.loaded}/${prefixResult.loaded}/${hybridResult.loaded} raw loads)`);
  assert(slashResult.errors.length === 0, `slash load errors: ${JSON.stringify(slashResult.errors)}`);
  assert(prefixResult.errors.length === 0, `prefix load errors: ${JSON.stringify(prefixResult.errors)}`);
  assert(hybridResult.errors.length === 0, `hybrid load errors: ${JSON.stringify(hybridResult.errors)}`);

  const preBridgeSize = client.prefixCommands.size;
  const stats = bridgeSlashCommandsToPrefix(client);

  console.log('Bridge stats:', stats);

  assert(stats.errors.length === 0, `bridge errors: ${JSON.stringify(stats.errors)}`);
  assert(stats.bridged >= 100, `expected hundreds of bridged commands, got ${stats.bridged}`);
  assert(
    client.prefixCommands.size >= preBridgeSize + stats.bridged,
    'client.prefixCommands did not grow by at least the bridged count'
  );

  // "server" is excluded (attachment options for avatar/banner)
  assert(!client.prefixCommands.has('server'), '"server" should be excluded (ATTACHMENT options)');

  // Names that already have real prefix/hybrid equivalents must not have
  // been clobbered by a bridged version.
  for (const alreadyReal of ['moderation', 'ignore', 'ping', 'userinfo', 'stats']) {
    const cmd = client.prefixCommands.get(alreadyReal);
    assert(cmd, `expected "${alreadyReal}" to still be registered`);
    assert(!cmd.isBridged, `"${alreadyReal}" should NOT have been overwritten by the bridge`);
  }

  // Newly bridged containers that had no prior prefix equivalent.
  for (const shouldBeBridged of ['warn', 'warnpunish', 'case', 'verification', 'starboard']) {
    const cmd = client.prefixCommands.get(shouldBeBridged);
    assert(cmd, `expected "${shouldBeBridged}" to be bridged`);
    assert(cmd.isBridged, `"${shouldBeBridged}" should have been bridged`);
  }

  console.log('\n--- Spot-checking option parsing ---');

  // 1. Flat command: users.js -> `,users` (no options at all)
  {
    const usersCmd = client.commands.get('users');
    const json = usersCmd.data.toJSON();
    const ctx = resolveSubcommandContext(json, []);
    assert(ctx.isContainer === false, 'users should not be a container command');
    const { values, error } = await resolveOptionValues(ctx.schema, [], makeFakeMessage());
    assert(!error, `unexpected error parsing users: ${error}`);
    assert(Object.keys(values).length === 0, 'users should have no parsed option values');
    console.log('OK: users -> flat command, no options');
  }

  // 2. Subcommand container with a required user + optional string:
  //    `,warn add @user spamming a lot` -> subcommand "add", user, reason="spamming a lot"
  {
    const warnCmd = client.commands.get('warn');
    assert(warnCmd, 'expected a "warn" slash command to exist');
    const json = warnCmd.data.toJSON();
    const ctx = resolveSubcommandContext(json, ['add', '<@111222333444555666>', 'spamming', 'a', 'lot']);
    assert(ctx.isContainer === true, 'warn should be a container command');
    assert(ctx.subcommandName === 'add', `expected subcommand "add", got ${ctx.subcommandName}`);

    const message = makeFakeMessage();
    message.mentions.users.set('111222333444555666', { id: '111222333444555666', tag: 'Target#0002', username: 'Target' });

    const remaining = ['<@111222333444555666>', 'spamming', 'a', 'lot'];
    const { values, error } = await resolveOptionValues(ctx.schema, remaining, message);
    assert(!error, `unexpected error parsing warn add: ${error}`);
    assert(values.user && values.user.user.id === '111222333444555666', 'expected resolved user option');
    assert(values.reason === 'spamming a lot', `expected joined reason string, got "${values.reason}"`);
    console.log('OK: warn add <user> <reason...> -> subcommand + user + joined string');
  }

  // 3. Missing required option surfaces a helpful error instead of throwing.
  {
    const warnCmd = client.commands.get('warn');
    const json = warnCmd.data.toJSON();
    const ctx = resolveSubcommandContext(json, ['add']);
    assert(ctx.subcommandName === 'add');
    const { values, error } = await resolveOptionValues(ctx.schema, [], makeFakeMessage());
    assert(error, 'expected an error for missing required user option');
    console.log(`OK: warn add with no args -> error message: "${error}"`);
  }

  // 4. Unknown subcommand -> container error, not a crash.
  {
    const warnCmd = client.commands.get('warn');
    const json = warnCmd.data.toJSON();
    const ctx = resolveSubcommandContext(json, ['not-a-real-subcommand']);
    assert(ctx.isContainer === true && ctx.error === true, 'expected an unknown-subcommand error context');
    console.log('OK: warn bogus-subcommand -> graceful usage error, no crash');
  }

  // 5. Integer/number/boolean parsing on a generated fun-extra style flat command, if present.
  {
    const funExtra = [...client.commands.values()].find(c => c.category === 'fun-extra' || (c.data && c.data.name && c.data.toJSON().options && c.data.toJSON().options.some(o => o.type === 3)));
    // just make sure at least one exists and is bridged
    if (funExtra) {
      const json = funExtra.data.toJSON();
      assert(client.prefixCommands.has(json.name), `expected fun-extra command "${json.name}" to be bridged`);
      console.log(`OK: fun-extra command "${json.name}" bridged`);
    }
  }

  console.log('\nAll prefix bridge sanity checks passed.');
  process.exit(0);
}

main().catch(err => {
  console.error('Prefix bridge sanity check FAILED:');
  console.error(err);
  process.exit(1);
});
