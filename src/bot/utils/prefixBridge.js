/**
 * Generic bridge that auto-generates a prefix/text equivalent for every
 * slash-only command under `src/bot/commands/**` that doesn't already have
 * a hand-written prefix or hybrid equivalent.
 *
 * Call `bridgeSlashCommandsToPrefix(client)` once after
 * `loadSlashCommands` / `loadPrefixCommands` / `loadHybridCommands` have
 * populated `client.commands` and `client.prefixCommands`.
 *
 * How it works:
 *  - Every command already in `client.commands` (from `commands/**`) is a
 *    candidate.
 *  - Commands whose name is already registered in `client.prefixCommands`
 *    (a real prefix or hybrid command already exists) are skipped so we
 *    never shadow hand-written behaviour.
 *  - Commands on the exclusion list (`prefixBridgeExclusions.js`) or that
 *    are found to use an ATTACHMENT option / `autocomplete` anywhere in
 *    their option tree are skipped - those can't be safely driven by
 *    positional text args.
 *  - Everything else gets a synthetic `{ name, aliases, description,
 *    execute }` entry registered into `client.prefixCommands`. The
 *    synthetic `execute` parses positional text args against the
 *    command's `SlashCommandBuilder` schema (one level of subcommand /
 *    subcommand-group nesting), builds a fake `interaction`-shaped object,
 *    and calls the original slash command's `execute(interaction)`
 *    unmodified.
 */

const config = require('../config');
const emojis = require('../emojis.json');
const commandAliases = require('./commandAliases');
const EXCLUDED_COMMANDS = require('./prefixBridgeExclusions');

const ERROR_EMOJI = emojis.error || '❌';

// Discord application command option type constants
// https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type
const OPTION_TYPES = {
  SUB_COMMAND: 1,
  SUB_COMMAND_GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
  ROLE: 8,
  MENTIONABLE: 9,
  NUMBER: 10,
  ATTACHMENT: 11,
};

const NUMERIC_ID_RE = /^\d{15,21}$/;

function extractId(raw, wrapperRe) {
  if (typeof raw !== 'string') return null;
  const match = raw.match(wrapperRe);
  if (match) return match[1];
  if (NUMERIC_ID_RE.test(raw)) return raw;
  return null;
}

async function resolveUserArg(raw, message) {
  const id = extractId(raw, /^<@!?(\d+)>$/);
  if (!id) return null;

  let user = message.mentions.users.get(id) || null;
  if (!user) {
    try {
      user = await message.client.users.fetch(id);
    } catch (_) {
      return null;
    }
  }

  let member = null;
  if (message.guild) {
    member = message.mentions.members?.get(id) || null;
    if (!member) {
      try {
        member = await message.guild.members.fetch(id);
      } catch (_) {
        member = null;
      }
    }
  }

  return { user, member };
}

async function resolveChannelArg(raw, message) {
  const id = extractId(raw, /^<#(\d+)>$/);
  if (!id || !message.guild) return null;

  let channel = message.mentions.channels.get(id) || message.guild.channels.cache.get(id) || null;
  if (!channel) {
    try {
      channel = await message.guild.channels.fetch(id);
    } catch (_) {
      channel = null;
    }
  }
  return channel;
}

async function resolveRoleArg(raw, message) {
  const id = extractId(raw, /^<@&(\d+)>$/);
  if (!id || !message.guild) return null;

  let role = message.mentions.roles.get(id) || message.guild.roles.cache.get(id) || null;
  if (!role) {
    try {
      role = await message.guild.roles.fetch(id);
    } catch (_) {
      role = null;
    }
  }
  return role;
}

/** Recursively checks a command's option tree for anything the bridge can't safely drive from text. */
function containsUnsupportedOption(options) {
  if (!options) return false;
  for (const opt of options) {
    if (opt.type === OPTION_TYPES.ATTACHMENT || opt.autocomplete) return true;
    if (opt.type === OPTION_TYPES.SUB_COMMAND || opt.type === OPTION_TYPES.SUB_COMMAND_GROUP) {
      if (containsUnsupportedOption(opt.options)) return true;
    }
  }
  return false;
}

function listSubcommandNames(options) {
  return (options || [])
    .filter(o => o.type === OPTION_TYPES.SUB_COMMAND || o.type === OPTION_TYPES.SUB_COMMAND_GROUP)
    .map(o => o.name)
    .join(', ');
}

/**
 * Figures out whether the top-level schema is a subcommand/subcommand-group
 * container, and if so, resolves which (sub)command the first 1-2 text
 * args refer to. Handles exactly one level of subcommand-group nesting.
 */
function resolveSubcommandContext(json, args) {
  const topOptions = json.options || [];
  const isContainer = topOptions.some(
    o => o.type === OPTION_TYPES.SUB_COMMAND || o.type === OPTION_TYPES.SUB_COMMAND_GROUP
  );

  if (!isContainer) {
    return { isContainer: false, schema: topOptions };
  }

  const first = (args[0] || '').toLowerCase();
  if (!first) {
    return { isContainer: true, error: true, topOptions };
  }

  const group = topOptions.find(o => o.type === OPTION_TYPES.SUB_COMMAND_GROUP && o.name === first);
  if (group) {
    const second = (args[1] || '').toLowerCase();
    if (!second) {
      return { isContainer: true, error: true, topOptions, matchedGroup: group };
    }
    const sub = (group.options || []).find(o => o.type === OPTION_TYPES.SUB_COMMAND && o.name === second);
    if (!sub) {
      return { isContainer: true, error: true, topOptions, matchedGroup: group };
    }
    return {
      isContainer: true,
      schema: sub.options || [],
      subcommandName: sub.name,
      subcommandGroupName: group.name,
      consumed: 2,
    };
  }

  const sub = topOptions.find(o => o.type === OPTION_TYPES.SUB_COMMAND && o.name === first);
  if (!sub) {
    return { isContainer: true, error: true, topOptions };
  }

  return {
    isContainer: true,
    schema: sub.options || [],
    subcommandName: sub.name,
    consumed: 1,
  };
}

/** Maps remaining positional text args onto a (sub)command's declared option schema, in order. */
async function resolveOptionValues(schema, args, message) {
  const values = {};
  const options = schema || [];
  let idx = 0;

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const isLastOption = i === options.length - 1;

    switch (opt.type) {
      case OPTION_TYPES.STRING: {
        let raw;
        if (isLastOption) {
          raw = args.slice(idx).join(' ').trim();
          idx = args.length;
        } else {
          raw = args[idx];
          idx += 1;
        }
        if (!raw) {
          if (opt.required) return { error: `Missing required argument \`${opt.name}\` (text).` };
          break;
        }
        values[opt.name] = raw;
        break;
      }

      case OPTION_TYPES.INTEGER:
      case OPTION_TYPES.NUMBER: {
        const raw = args[idx];
        idx += 1;
        const kindLabel = opt.type === OPTION_TYPES.INTEGER ? 'whole number' : 'number';
        if (raw === undefined) {
          if (opt.required) return { error: `Missing required argument \`${opt.name}\` (${kindLabel}).` };
          break;
        }
        const parsed = opt.type === OPTION_TYPES.INTEGER ? parseInt(raw, 10) : parseFloat(raw);
        if (Number.isNaN(parsed)) {
          return { error: `\`${raw}\` is not a valid ${kindLabel} for \`${opt.name}\`.` };
        }
        values[opt.name] = parsed;
        break;
      }

      case OPTION_TYPES.BOOLEAN: {
        const raw = args[idx];
        idx += 1;
        if (raw === undefined) {
          if (opt.required) return { error: `Missing required argument \`${opt.name}\` (true/false).` };
          break;
        }
        const lower = raw.toLowerCase();
        if (['true', 'yes', 'y', 'on', '1'].includes(lower)) values[opt.name] = true;
        else if (['false', 'no', 'n', 'off', '0'].includes(lower)) values[opt.name] = false;
        else return { error: `\`${raw}\` is not valid for \`${opt.name}\` - use true or false.` };
        break;
      }

      case OPTION_TYPES.USER: {
        const raw = args[idx];
        idx += 1;
        if (raw === undefined) {
          if (opt.required) return { error: `Missing required argument \`${opt.name}\` (mention or ID of a user).` };
          break;
        }
        const resolved = await resolveUserArg(raw, message);
        if (!resolved) return { error: `Could not find a user for \`${opt.name}\` from \`${raw}\`.` };
        values[opt.name] = resolved;
        break;
      }

      case OPTION_TYPES.CHANNEL: {
        const raw = args[idx];
        idx += 1;
        if (raw === undefined) {
          if (opt.required) return { error: `Missing required argument \`${opt.name}\` (mention or ID of a channel).` };
          break;
        }
        const resolved = await resolveChannelArg(raw, message);
        if (!resolved) return { error: `Could not find a channel for \`${opt.name}\` from \`${raw}\`.` };
        values[opt.name] = resolved;
        break;
      }

      case OPTION_TYPES.ROLE: {
        const raw = args[idx];
        idx += 1;
        if (raw === undefined) {
          if (opt.required) return { error: `Missing required argument \`${opt.name}\` (mention or ID of a role).` };
          break;
        }
        const resolved = await resolveRoleArg(raw, message);
        if (!resolved) return { error: `Could not find a role for \`${opt.name}\` from \`${raw}\`.` };
        values[opt.name] = resolved;
        break;
      }

      case OPTION_TYPES.MENTIONABLE: {
        const raw = args[idx];
        idx += 1;
        if (raw === undefined) {
          if (opt.required) return { error: `Missing required argument \`${opt.name}\`.` };
          break;
        }
        const user = await resolveUserArg(raw, message);
        if (user) {
          values[opt.name] = user;
          break;
        }
        const role = await resolveRoleArg(raw, message);
        if (role) {
          values[opt.name] = { role };
          break;
        }
        return { error: `Could not find a user or role for \`${opt.name}\` from \`${raw}\`.` };
      }

      default:
        // ATTACHMENT / unrecognised types should never reach here for a
        // bridged command (see containsUnsupportedOption) - skip defensively.
        idx += 1;
        break;
    }
  }

  return { values };
}

function stripEphemeral(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && !Buffer.isBuffer(payload)) {
    if ('ephemeral' in payload) {
      const clone = { ...payload };
      delete clone.ephemeral;
      return clone;
    }
  }
  return payload;
}

/** Builds a fake CommandInteractionOptionResolver-shaped object backed by parsed values. */
function buildOptionsInterface(values, subcommandName, subcommandGroupName) {
  const getRaw = (name) => (Object.prototype.hasOwnProperty.call(values, name) ? values[name] : null);

  return {
    getString(name, required = false) {
      const v = getRaw(name);
      if (v === null && required) throw new Error(`Required option "${name}" is missing`);
      return v === null ? null : String(v);
    },
    getInteger(name, required = false) {
      const v = getRaw(name);
      if (v === null && required) throw new Error(`Required option "${name}" is missing`);
      return v === null ? null : v;
    },
    getNumber(name, required = false) {
      const v = getRaw(name);
      if (v === null && required) throw new Error(`Required option "${name}" is missing`);
      return v === null ? null : v;
    },
    getBoolean(name, required = false) {
      const v = getRaw(name);
      if (v === null && required) throw new Error(`Required option "${name}" is missing`);
      return v === null ? null : v;
    },
    getUser(name, required = false) {
      const v = getRaw(name);
      if (v === null && required) throw new Error(`Required option "${name}" is missing`);
      return v === null ? null : (v.user || null);
    },
    getMember(name) {
      const v = getRaw(name);
      return v === null ? null : (v.member || null);
    },
    getChannel(name, required = false) {
      const v = getRaw(name);
      if (v === null && required) throw new Error(`Required option "${name}" is missing`);
      return v === null ? null : v;
    },
    getRole(name, required = false) {
      const v = getRaw(name);
      if (v === null && required) throw new Error(`Required option "${name}" is missing`);
      if (v === null) return null;
      return v.role || v;
    },
    getMentionable(name, required = false) {
      const v = getRaw(name);
      if (v === null && required) throw new Error(`Required option "${name}" is missing`);
      if (v === null) return null;
      return v.user || v.role || null;
    },
    getAttachment() {
      return null;
    },
    getSubcommand(required = false) {
      if (!subcommandName && required) throw new Error('No subcommand specified');
      return subcommandName || null;
    },
    getSubcommandGroup(required = false) {
      if (!subcommandGroupName && required) throw new Error('No subcommand group specified');
      return subcommandGroupName || null;
    },
  };
}

/** Builds a fake interaction-shaped object that a slash command's execute(interaction) can consume transparently. */
function buildFakeInteraction(message, values, subcommandName, subcommandGroupName, commandName) {
  let lastReply = null;
  let deferred = false;
  let replied = false;

  return {
    isCommand: () => true,
    isChatInputCommand: () => true,
    commandName,
    user: message.author,
    member: message.member,
    guild: message.guild,
    guildId: message.guildId,
    channel: message.channel,
    channelId: message.channelId,
    client: message.client,
    locale: 'en-US',
    options: buildOptionsInterface(values, subcommandName, subcommandGroupName),

    get deferred() {
      return deferred;
    },
    get replied() {
      return replied;
    },

    async deferReply() {
      deferred = true;
      return undefined;
    },

    async reply(payload) {
      const sent = await message.reply(stripEphemeral(payload));
      lastReply = sent;
      replied = true;
      return sent;
    },

    async editReply(payload) {
      const cleaned = stripEphemeral(payload);
      if (lastReply) {
        try {
          lastReply = await lastReply.edit(cleaned);
          replied = true;
          return lastReply;
        } catch (_) {
          // message may have been deleted - fall through to sending a new one
        }
      }
      lastReply = await message.channel.send(cleaned);
      replied = true;
      return lastReply;
    },

    async followUp(payload) {
      return message.channel.send(stripEphemeral(payload));
    },

    async deleteReply() {
      if (lastReply) {
        try {
          await lastReply.delete();
        } catch (_) {
          // already gone - ignore
        }
      }
    },

    async fetchReply() {
      return lastReply || message;
    },

    isRepliable() {
      return true;
    },
  };
}

/** Wraps a slash command's execute(interaction) into a prefix-style execute(message, args). */
function createBridgedExecute(command, json) {
  return async function execute(message, args = []) {
    try {
      const ctx = resolveSubcommandContext(json, args);

      if (ctx.isContainer && ctx.error) {
        const container = ctx.matchedGroup || null;
        const subs = listSubcommandNames(container ? container.options : ctx.topOptions);
        const label = container ? `${json.name} ${container.name}` : json.name;
        await message.reply(
          `${ERROR_EMOJI} Usage: \`${config.PREFIX}${label} <subcommand>\`` +
            (subs ? `\nAvailable subcommands: ${subs}` : '')
        );
        return;
      }

      const remainingArgs = ctx.isContainer ? args.slice(ctx.consumed) : args;
      const { values, error } = await resolveOptionValues(ctx.schema, remainingArgs, message);

      if (error) {
        await message.reply(`${ERROR_EMOJI} ${error}`);
        return;
      }

      const fakeInteraction = buildFakeInteraction(
        message,
        values,
        ctx.subcommandName || null,
        ctx.subcommandGroupName || null,
        json.name
      );

      await command.execute(fakeInteraction);
    } catch (err) {
      console.error(`[PREFIX BRIDGE] Error executing bridged command "${json.name}":`, err);
      try {
        await message.reply(`${ERROR_EMOJI} Something went wrong while running this command.`);
      } catch (_) {
        // channel may no longer be reachable - nothing more we can do
      }
    }
  };
}

/**
 * Iterates every slash-only command in `client.commands` and registers a
 * synthetic prefix command for it in `client.prefixCommands`, unless it
 * already has a real prefix/hybrid equivalent, is on the exclusion list,
 * or uses an option type the bridge can't safely drive from text.
 */
function bridgeSlashCommandsToPrefix(client) {
  const stats = {
    bridged: 0,
    skippedExisting: 0,
    skippedExcluded: 0,
    skippedUnsupported: 0,
    aliasesRegistered: 0,
    errors: [],
  };

  if (!client.commands || !client.prefixCommands) {
    return stats;
  }

  for (const [name, command] of client.commands) {
    if (!command || !command.data || typeof command.execute !== 'function') continue;

    let json;
    try {
      json = command.data.toJSON();
    } catch (err) {
      stats.errors.push(`${name}: ${err.message}`);
      continue;
    }

    if (client.prefixCommands.has(json.name)) {
      stats.skippedExisting += 1;
      continue;
    }

    if (EXCLUDED_COMMANDS.has(json.name)) {
      stats.skippedExcluded += 1;
      continue;
    }

    if (containsUnsupportedOption(json.options)) {
      stats.skippedUnsupported += 1;
      continue;
    }

    const aliases = (commandAliases[json.name] || []).filter(
      alias => alias !== json.name && !client.prefixCommands.has(alias)
    );

    const bridgedCommand = {
      name: json.name,
      aliases,
      description: json.description || '',
      isBridged: true,
      execute: createBridgedExecute(command, json),
    };

    client.prefixCommands.set(json.name, bridgedCommand);
    stats.bridged += 1;

    for (const alias of aliases) {
      if (!client.prefixCommands.has(alias)) {
        client.prefixCommands.set(alias, bridgedCommand);
        stats.aliasesRegistered += 1;
      }
    }
  }

  return stats;
}

module.exports = {
  bridgeSlashCommandsToPrefix,
  // exported for tests / introspection
  containsUnsupportedOption,
  resolveSubcommandContext,
  resolveOptionValues,
  buildFakeInteraction,
  OPTION_TYPES,
};
