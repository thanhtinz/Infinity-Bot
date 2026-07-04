


const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  MessageFlags,
} = require('discord.js');
const emojis = require('../emojis.json');

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickText(value) {
  if (Array.isArray(value)) return randomItem(value);
  return value;
}

function replaceTokens(template, tokens) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (tokens[key] ?? ''));
}

function buildProgressBar(percentage) {
  const clamped = Math.max(0, Math.min(100, percentage));
  if (clamped === 0) return emojis.progressEmpty.repeat(10);
  if (clamped === 100) {
    return emojis.progressLeft + emojis.progressCenter.repeat(8) + emojis.progressRight;
  }
  const filled = Math.round((clamped / 100) * 9);
  let bar = emojis.progressLeft;
  for (let i = 1; i < 10; i++) {
    bar += i < filled ? emojis.progressCenter : emojis.progressEmpty;
  }
  return bar;
}

function simpleContainer(title, bodyLines, footer = null) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyLines.filter(Boolean).join('\n\n')));

  if (footer) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
  }

  return container;
}

function thumbnailContainer(title, bodyLines, avatarURL, footer = null) {
  const section = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyLines.filter(Boolean).join('\n\n')));

  if (avatarURL) {
    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarURL));
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addSectionComponents(section);

  if (footer) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
  }

  return container;
}

function reply(interaction, container, ephemeral = false) {
  return interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    ephemeral,
  });
}

// ---------------------------------------------------------------------------
// text transforms (used by mode: "transform")
// ---------------------------------------------------------------------------

const LEET_MAP = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', b: '8', g: '9', l: '1' };

const transformHandlers = {
  uppercase: (text) => text.toUpperCase(),
  lowercase: (text) => text.toLowerCase(),
  reverse: (text) => text.split('').reverse().join(''),
  alternatecase: (text) => text.split('').map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase())).join(''),
  mockingcase: (text) => text.split('').map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase())).join(''),
  leetspeak: (text) => text.split('').map((c) => LEET_MAP[c.toLowerCase()] ?? c).join(''),
  clapcase: (text) => text.split(/\s+/).filter(Boolean).join(' 👏 '),
  dotcase: (text) => text.split(/\s+/).filter(Boolean).join(' • '),
  spacedout: (text) => text.split('').join(' '),
  boxtext: (text) => text.split('').map((c) => (c === ' ' ? ' ' : `[${c}]`)).join(''),
  blockcaps: (text) => text.toUpperCase().split('').map((c) => (c === ' ' ? '   ' : `${c} `)).join(''),
  titlecase: (text) => text.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()),
  sentencecase: (text) => {
    const lowered = text.toLowerCase();
    return lowered.charAt(0).toUpperCase() + lowered.slice(1);
  },
  vowelspam: (text) => text.replace(/[aeiou]/gi, (m) => m.repeat(3)),
  mirrorwords: (text) => text.trim().split(/\s+/).reverse().join(' '),
  wavecase: (text) => text.split('').map((c, i) => (Math.floor(i / 2) % 2 === 0 ? c.toUpperCase() : c.toLowerCase())).join(''),
  slugtext: (text) => text.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(Boolean).join('-'),
  glitchtext: (text) => text.split('').map((c, i) => {
    if (c === ' ') return c;
    if (i % 3 === 0) return `${c.toUpperCase()}̵`;
    if (i % 3 === 1) return c.toLowerCase();
    return c;
  }).join(''),
  spoilertext: (text) => text.split('').map((c) => (c === ' ' ? ' ' : `||${c}||`)).join(''),
};

// ---------------------------------------------------------------------------
// option builders
// ---------------------------------------------------------------------------

function buildData(definition) {
  const builder = new SlashCommandBuilder()
    .setName(definition.name)
    .setDescription(definition.description.slice(0, 100));

  switch (definition.mode) {
    case 'target_action':
      builder.addUserOption((option) =>
        option
          .setName('user')
          .setDescription(definition.targetDescription || 'The user to target.')
          .setRequired(true));
      break;
    case 'rating':
      builder.addUserOption((option) =>
        option
          .setName('user')
          .setDescription('The user to rate (defaults to yourself).')
          .setRequired(false));
      break;
    case 'transform':
      builder.addStringOption((option) =>
        option
          .setName('text')
          .setDescription('The text to transform.')
          .setRequired(true)
          .setMaxLength(1000));
      break;
    case 'prompt':
    case 'randomizer':
      break;
    default:
      break;
  }

  return builder;
}

// ---------------------------------------------------------------------------
// mode executors
// ---------------------------------------------------------------------------

async function executeTargetAction(definition, interaction) {
  const author = interaction.user;
  const targetUser = interaction.options.getUser('user');

  if (!targetUser) {
    return reply(interaction, simpleContainer('Missing Target', ['Please provide a valid user.']), true);
  }

  if (definition.blockSelf !== false && targetUser.id === author.id) {
    return reply(interaction, simpleContainer(
      definition.title,
      [definition.blockSelfMessage || `You cannot use \`/${definition.name}\` on yourself.`]
    ), true);
  }

  if (definition.blockBots && targetUser.bot) {
    return reply(interaction, simpleContainer(
      definition.title,
      [definition.blockBotMessage || 'You cannot use this on bots.']
    ), true);
  }

  const line = replaceTokens(randomItem(definition.templates), {
    actor: author.username,
    target: targetUser.username,
  });

  const container = thumbnailContainer(
    definition.title,
    [line],
    targetUser.displayAvatarURL({ size: 128 }),
    definition.footer || null
  );

  return reply(interaction, container);
}

async function executeRating(definition, interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const score = Math.floor(Math.random() * 101);

  const highThreshold = definition.highThreshold ?? 85;
  const midThreshold = definition.midThreshold ?? 45;

  const verdict = score >= highThreshold
    ? pickText(definition.high)
    : score >= midThreshold
      ? pickText(definition.mid)
      : pickText(definition.low);

  const bar = buildProgressBar(score);

  const container = thumbnailContainer(
    definition.title,
    [`**${targetUser.username}** is **${score}%** ${definition.scale}!`, bar, `*${verdict}*`],
    targetUser.displayAvatarURL({ size: 128 })
  );

  return reply(interaction, container);
}

async function executePrompt(definition, interaction) {
  const container = simpleContainer(
    definition.title,
    [randomItem(definition.prompts)],
    definition.footer || null
  );
  return reply(interaction, container);
}

async function executeRandomizer(definition, interaction) {
  const result = randomItem(definition.items);
  const label = typeof result === 'string' ? result : (result.label || String(result));
  const footer = typeof result === 'object' && result.footer ? result.footer : definition.footer || null;

  const container = simpleContainer(
    definition.title,
    [definition.intro || 'Result:', `**${label}**`],
    footer
  );
  return reply(interaction, container);
}

async function executeTransform(definition, interaction) {
  const text = interaction.options.getString('text');
  const transform = transformHandlers[definition.transform];

  if (!transform) {
    return reply(interaction, simpleContainer('Error', ['This transform is currently unavailable.']), true);
  }

  const output = transform(text).slice(0, 3500);

  const container = simpleContainer(definition.title, [
    `**Input**\n${text.slice(0, 500)}`,
    `**Output**\n${output}`,
  ]);

  return reply(interaction, container);
}

// ---------------------------------------------------------------------------
// public factory
// ---------------------------------------------------------------------------

function createFunCommand(definition) {
  if (!definition || !definition.name || !definition.mode) {
    throw new Error('createFunCommand requires a definition with at least { name, mode }');
  }

  const data = buildData(definition);

  return {
    data,
    category: 'fun-extra',
    async execute(interaction) {
      switch (definition.mode) {
        case 'target_action':
          return executeTargetAction(definition, interaction);
        case 'rating':
          return executeRating(definition, interaction);
        case 'prompt':
          return executePrompt(definition, interaction);
        case 'randomizer':
          return executeRandomizer(definition, interaction);
        case 'transform':
          return executeTransform(definition, interaction);
        default:
          return reply(interaction, simpleContainer('Error', ['This command is not configured correctly.']), true);
      }
    },
  };
}

module.exports = {
  createFunCommand,
  transformHandlers,
  buildProgressBar,
  randomItem,
};
