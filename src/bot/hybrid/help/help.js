const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    MessageFlags,
    ComponentType,
    ThumbnailBuilder
} = require('discord.js');
const emojis = require('../../emojis.json');
const config = require('../../config');
const { isHttpUrl } = require('../../utils/url');
const { tg } = require('../../utils/i18n');

const categories = {
    general: {
        name: 'General',
        emoji: emojis.cat_general,
        commands: ['status', 'avatar', 'banner', 'servericon', 'membercount', 'hash', 'snipe', 'editsnipe', 'purge', 'steal', 'remind']
    },
    information: {
        name: 'Information',
        emoji: emojis.cat_information,
        commands: ['userinfo', 'serverinfo', 'invite', 'users', 'botinfo', 'ping', 'avgping', 'uptime', 'help']
    },
    moderation: {
        name: 'Moderation',
        emoji: emojis.cat_moderation,
        commands: ['kick', 'ban', 'softban', 'unban', 'slowmode', 'lock', 'unlock', 'tempban', 'mute', 'unmute', 'temprole', 'rolegive', 'roleremove', 'nick', 'warn add', 'warn list', 'case view', 'case edit', 'case delete', 'case restore', 'case clear', 'warnpunish set', 'warnpunish list', 'warnpunish remove', 'verification setup', 'verification disable', 'verification panel', 'stickynick set', 'stickynick remove']
    },
    antinuke: {
        name: 'Antinuke',
        emoji: emojis.cat_antinuke,
        commands: ['antinuke setup', 'antinuke settings', 'antinuke enable', 'antinuke disable', 'antinuke whitelist']
    },
    automod: {
        name: 'AutoMod',
        emoji: emojis.cat_automod,
        commands: ['automod setup', 'automod settings', 'automod enable', 'automod disable', 'automod whitelist']
    },
    tickets: {
        name: 'Tickets',
        emoji: emojis.cat_tickets,
        commands: ['ticket setup', 'ticket panel', 'ticket addcategory', 'ticket removecategory', 'ticket addrole', 'ticket removerole', 'ticket close', 'ticket open', 'ticket delete', 'ticket add', 'ticket remove', 'ticket rename', 'ticket claim', 'ticket transfer', 'ticket transcript', 'ticket reset']
    },
    welcome: {
        name: 'Welcome',
        emoji: emojis.cat_welcome,
        commands: ['welcome setup', 'welcome config', 'welcome test', 'welcome reset', 'farewell setup', 'farewell config', 'farewell test', 'farewell reset']
    },
    logging: {
        name: 'Logging',
        emoji: emojis.cat_logging,
        commands: ['logging setup', 'logging config', 'logging reset']
    },
    fun: {
        name: 'Fun',
        emoji: emojis.cat_fun,
        commands: ['howdumb', 'howgay', 'dare', 'truth', 'simprate', 'pickup', 'rickroll', 'meme', 'nitro', 'token', 'texttoemoji', 'wizz', 'hack']
    },
    funextra: {
        name: 'Fun Extra',
        emoji: emojis.cat_fun,
        commands: ['geniusrate', 'trollrate', 'cursedrate', 'basedrate', 'villainrate', 'uppercase', 'leetspeak', 'reversetext', 'fortune', 'magic8', 'coinflip', 'chaosquestion', 'admire', 'roast', '150+ more - use tab-complete on / to browse']
    },
    otakureactions: {
        name: 'Reactions',
        emoji: emojis.cat_roleplay,
        commands: ['happy', 'sad', 'cry', 'dance', 'blush', 'smug', 'hug', 'kiss', 'pat', 'slap', 'tickle', 'poke', 'cuddle', 'wave', '70+ reaction commands - use /help or tab-complete to browse']
    },
    roleplay: {
        name: 'Roleplay',
        emoji: emojis.cat_roleplay,
        commands: ['hug', 'kiss', 'lick', 'pat', 'slap', 'tickle', 'poke', 'deathstare', 'dance', 'cry', 'laugh', 'smile', 'blush', 'wink', 'thumbsup', 'clap', 'bow', 'salute', 'facepalm', 'shrug', 'sleep', 'eat', 'kill', 'run']
    },
    social: {
        name: 'Social',
        emoji: emojis.cat_social,
        commands: ['youtube', 'pinterest', 'github', 'wikipedia', 'news', 'google']
    },
    utility: {
        name: 'Utility',
        emoji: emojis.cat_utility,
        commands: ['calc', 'define', 'matrix', 'size', 'afk', 'todo add', 'todo list', 'todo remove', 'todo clear', 'ignore', 'lb', 'kg', 'ft', 'cm', 'hexdec', 'dechex', 'encode', 'ascii85', 'rot13', 'base32']
    },
    animals: {
        name: 'Animals',
        emoji: emojis.cat_animals,
        commands: ['cat', 'dog', 'fox', 'duck', 'panda', 'redpanda', 'bird', 'bunny', 'bear', 'pig', 'possum', 'sheep', 'snake', 'squirrel', 'animalfact']
    },
    giveaway: {
        name: 'Giveaway',
        emoji: emojis.cat_giveaway,
        commands: ['giveaway start', 'giveaway end', 'giveaway reroll']
    },
    vanityroles: {
        name: 'Vanity Roles',
        emoji: emojis.cat_vanityroles,
        commands: ['vanity setup', 'vanity config', 'vanity reset']
    },
    feedback: {
        name: 'Feedback',
        emoji: emojis.cat_feedback,
        commands: ['feedback setup', 'feedback panel', 'feedback config', 'feedback reset']
    },
    join2create: {
        name: 'Join2Create',
        emoji: emojis.cat_join2create,
        commands: ['j2c setup', 'j2c config', 'j2c reset']
    },
    automation: {
        name: 'Automation',
        emoji: emojis.cat_automation,
        commands: ['autoreact add', 'autoreact remove', 'autoreact list', 'autoreact reset', 'autobump setup', 'autobump config', 'autobump enable', 'autobump disable', 'autobump reset']
    },
    profiles: {
        name: 'Profiles',
        emoji: emojis.cat_profiles,
        commands: ['profile view', 'profile description', 'profile social', 'profile background', 'profile reset', 'profile card', 'serveravatar', 'serverbanner', 'serverbio', 'servername', 'serverresetprofile']
    },
    media: {
        name: 'Media',
        emoji: emojis.cat_media,
        commands: ['media setup', 'media remove', 'media config', 'media bypass add', 'media bypass remove', 'media bypass show']
    },
    misc: {
        name: 'Misc',
        emoji: emojis.cat_misc,
        commands: ['dumpsettings', 'dumproles', 'dumpchannels', 'dumpvoicechannels', 'dumpcategories', 'dumpemotes', 'dumpmessages', 'dumphumans', 'dumpbots', 'dumpusers', 'dumpbans', 'dumpwarns']
    },
    tracking: {
        name: 'Tracking',
        emoji: emojis.cat_tracking,
        commands: ['leaderboard messages', 'leaderboard invites', 'messages', 'invites']
    },
    voice: {
        name: 'Voice',
        emoji: emojis.cat_voice,
        commands: ['voice kick', 'voice kickall', 'voice mute', 'voice muteall', 'voice unmute', 'voice unmuteall', 'voice deafen', 'voice deafenall', 'voice undeafen', 'voice undeafenall', 'voice move', 'voice moveall', 'voice pull', 'voice pullall', 'voice lock', 'voice unlock', 'voice private', 'voice unprivate']
    },
    ai: {
        name: 'Artificial Intelligence',
        emoji: emojis.cat_ai,
        commands: ['ai enable', 'ai disable', 'ai analyse', 'ai ask']
    },
    reactionroles: {
        name: 'Reaction Roles',
        emoji: emojis.cat_reactionroles,
        commands: ['reactionroles setup', 'reactionroles remove']
    },
    community: {
        name: 'Community',
        emoji: emojis.dots,
        commands: ['statschannel add', 'statschannel remove', 'statschannel list', 'birthday set', 'birthday remove', 'birthday view', 'birthday config', 'starboard setup', 'starboard disable']
    },
    economy: {
        name: 'Economy',
        emoji: emojis.dots,
        commands: ['balance', 'daily', 'deposit', 'withdraw', 'rob', 'blackjack', 'slot', 'coinbet', 'marry', 'divorce', 'store browse', 'store buy', 'store inventory', 'economy setup', 'economy games enable', 'economy games disable', '(premium - unlock via /shop)']
    }
};

const mainCategoryKeys = [
    'general',
    'information',
    'moderation',
    'antinuke',
    'automod',
    'tickets',
    'welcome',
    'logging',
    'fun',
    'roleplay',
    'social',
    'utility',
    'animals',
    'giveaway'
];
const extraCategoryKeys = Object.keys(categories).filter((key) => !mainCategoryKeys.includes(key));
const categoryEntries = Object.entries(categories);
const mainCategoryEntries = mainCategoryKeys.map((key) => [key, categories[key]]);
const extraCategoryEntries = extraCategoryKeys.map((key) => [key, categories[key]]);

async function categoryListText(guildId) {
    const lines = await Promise.all(categoryEntries.map(async ([key, category]) => {
        const name = await tg(guildId, `help.categories.${key}`) || category.name;
        return `${category.emoji || emojis.dots} » **${name}**`;
    }));
    return lines.join('\n');
}

async function getGuildPrefix(guildId) {
    if (!guildId) return config.PREFIX;
    const { GuildPrefix } = require('../../../database/models');
    const customPrefix = await GuildPrefix.getPrefix(guildId);
    return customPrefix || config.PREFIX;
}

async function createHomeContainer({ client, user, guildId }) {
    const guildPrefix = await getGuildPrefix(guildId);
    const supportLine = isHttpUrl(config.SUPPORT_SERVER)
        ? `${emojis.arrow} ${await tg(guildId, 'help.supportServerLine', { url: config.SUPPORT_SERVER })}`
        : `${emojis.arrow} ${await tg(guildId, 'help.categoryHelpLine', { prefix: guildPrefix })}`;

    const intro = [
        await tg(guildId, 'help.helloLine', { bot: client.user.username || 'Infinity Bot' }),
        `${emojis.arrow} ${await tg(guildId, 'help.prefixLine', { prefix: guildPrefix })}`,
        `${emojis.arrow} ${await tg(guildId, 'help.setPrefixLine')}`,
        supportLine,
        '',
        await categoryListText(guildId)
    ].join('\n');

    const section = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(intro));

    const avatar = client.user.displayAvatarURL({ size: 256 });
    if (avatar) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar));

    return new ContainerBuilder()
        .addSectionComponents(section)
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
}

async function createCategoryContainer(categoryKey, client, guildId) {
    const category = categories[categoryKey];
    const name = await tg(guildId, `help.categories.${categoryKey}`) || category.name;
    const commandText = category.commands.map((cmd) => `\`${cmd}\``).join(', ');
    const section = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `${category.emoji || emojis.dots} **${name}**\n\n${commandText}`
        ));

    const avatar = client.user.displayAvatarURL({ size: 256 });
    if (avatar) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar));

    return new ContainerBuilder()
        .addSectionComponents(section)
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
}

async function createSelectMenu(kind, currentCategory, guildId) {
    const entries = kind === 'main' ? mainCategoryEntries : extraCategoryEntries;
    const placeholder = kind === 'main'
        ? await tg(guildId, 'help.mainCommandsPlaceholder')
        : await tg(guildId, 'help.extraCommandsPlaceholder');
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`help_${kind}_category_select`)
        .setPlaceholder(placeholder);

    for (const [key, category] of entries) {
        const name = await tg(guildId, `help.categories.${key}`) || category.name;
        selectMenu.addOptions({
            label: name,
            description: await tg(guildId, 'help.commandsCountDescription', { count: category.commands.length }),
            value: key,
            default: currentCategory === key
        });
    }

    return new ActionRowBuilder().addComponents(selectMenu);
}

async function buildHelpPayload({ categoryKey = null, client, user, guildId }) {
    const container = categoryKey
        ? await createCategoryContainer(categoryKey, client, guildId)
        : await createHomeContainer({ client, user, guildId });
    container.addActionRowComponents(await createSelectMenu('main', categoryKey, guildId));
    container.addActionRowComponents(await createSelectMenu('extra', categoryKey, guildId));
    return {
        components: [container],
        flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Category to view')
                .setRequired(false)
        ),

    name: 'help',
    description: 'Show all available commands',
    aliases: ['h'],
    category: 'information',

    async execute(interactionOrMessage, args = []) {
        const isSlash = interactionOrMessage.isChatInputCommand?.();
        const client = interactionOrMessage.client;
        const user = isSlash ? interactionOrMessage.user : interactionOrMessage.author;
        const guildId = interactionOrMessage.guildId;
        const rawArg = isSlash
            ? interactionOrMessage.options.getString('category')
            : (args[0] || null);
        const categoryKey = rawArg ? Object.keys(categories).find((key) => {
            const normalized = rawArg.toLowerCase().replace(/\s+/g, '');
            return key === normalized || categories[key].name.toLowerCase().replace(/\s+/g, '') === normalized;
        }) : null;

        const payload = await buildHelpPayload({ categoryKey, client, user, guildId });
        payload.fetchReply = true;

        const reply = await interactionOrMessage.reply(payload);
        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 240000
        });

        collector.on('collect', async (selectInteraction) => {
            if (selectInteraction.user.id !== user.id) {
                const errorContainer = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'help.onlyUserCanUse')));
                return selectInteraction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }

            const selectedCategory = selectInteraction.values[0];
            const nextPayload = await buildHelpPayload({
                categoryKey: selectedCategory,
                client,
                user,
                guildId
            });

            await selectInteraction.update(nextPayload);
        });
    }
};
