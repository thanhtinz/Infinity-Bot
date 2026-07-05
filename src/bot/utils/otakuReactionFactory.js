// Shared factory for the OtakuGifs-backed reaction commands.
//
// Each reaction (hug, kiss, happy, ...) gets its own standalone command that
// works BOTH as a slash command and as a native prefix command from a single
// definition, following this codebase's existing hybrid convention (see
// src/bot/hybrid/setprefix/setprefix.js and src/bot/hybrid/nick/nick.js):
// one object exporting { data, execute } for the slash side and
// { name, aliases, execute } for the prefix side, with `execute` branching
// on whether it was called with an Interaction or a Message.
//
// The presentation (Components V2 container + media gallery + graceful
// degrade-to-text on GIF fetch failure) mirrors the now-removed generic
// src/bot/commands/gif/gif.js command this factory supersedes.
const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} = require('discord.js');
const { getGif } = require('./otakuGifsClient');

function capitalize(word) {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function errorContainer(title, body) {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
}

function reactionContainer(label, line, gifUrl) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${label}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

  if (gifUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems([
        new MediaGalleryItemBuilder().setURL(gifUrl),
      ])
    );
  }

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(line));

  if (!gifUrl) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# GIF service is unavailable right now, showing text only.'));
  }

  return container;
}

// Extracts a plain user id (no <@...> wrapper) from a raw prefix-command
// argument, e.g. "<@123>" / "<@!123>" / "123" -> "123".
function extractUserId(rawArg) {
  if (!rawArg) return null;
  const match = rawArg.match(/^<@!?(\d+)>$/);
  if (match) return match[1];
  if (/^\d{17,20}$/.test(rawArg)) return rawArg;
  return null;
}

async function resolveTargetUser(interactionOrMessage, isSlash, args) {
  if (isSlash) {
    return interactionOrMessage.options.getUser('user');
  }

  const mentioned = interactionOrMessage.mentions?.users?.first();
  if (mentioned) return mentioned;

  const userId = extractUserId(args[0]);
  if (!userId) return null;

  try {
    return await interactionOrMessage.client.users.fetch(userId);
  } catch {
    return null;
  }
}

/**
 * Builds a hybrid (slash + prefix) command object for a single OtakuGifs
 * reaction category.
 *
 * @param {object} config
 * @param {string} config.name - the reaction/category key, e.g. "hug".
 * @param {'self'|'target'} config.mode - whether the reaction can be
 *   directed at another user.
 * @param {string} config.description - slash command description.
 * @param {string[]} [config.aliases] - prefix command aliases.
 */
function createOtakuReactionCommand({ name, mode, description, aliases = [] }) {
  if (!name || !mode) {
    throw new Error('createOtakuReactionCommand requires at least { name, mode }');
  }

  const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description.slice(0, 100));

  if (mode === 'target') {
    data.addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Optional user to direct the reaction at')
        .setRequired(false));
  }

  const label = capitalize(name);

  async function execute(interactionOrMessage, args = []) {
    const isSlash = interactionOrMessage.isChatInputCommand?.() ?? false;
    const author = isSlash ? interactionOrMessage.user : interactionOrMessage.author;

    function reply(container, ephemeral = false) {
      if (isSlash) {
        return interactionOrMessage.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          ephemeral,
        });
      }
      return interactionOrMessage.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    let targetUser = null;
    if (mode === 'target') {
      targetUser = await resolveTargetUser(interactionOrMessage, isSlash, args);

      if (targetUser && targetUser.id === author.id) {
        return reply(errorContainer(
          'Invalid Target',
          'You cannot target yourself with this command.'
        ), true);
      }
    }

    if (isSlash) {
      await interactionOrMessage.deferReply({ flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
    }

    const gifUrl = await getGif(name);

    const line = mode === 'target'
      ? (targetUser
        ? `**${author.username}** sends a **${name}** to **${targetUser.username}**!`
        : `**${author.username}** sends a **${name}** out into the void, looking for someone to share it with!`)
      : `**${author.username}** is feeling **${name}**!`;

    const container = reactionContainer(label, line, gifUrl);

    if (isSlash) {
      return interactionOrMessage.editReply({
        components: [container],
        flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
      });
    }

    return interactionOrMessage.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  return {
    data,
    category: 'otaku-reactions',
    name,
    aliases,
    description,
    execute,
  };
}

module.exports = {
  createOtakuReactionCommand,
};
