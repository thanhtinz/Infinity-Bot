


const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const { StarboardConfig, StarboardPost } = require('../../database/models');
const { emojiMatches } = require('../utils/starboardUtils');

const configCache = new Map();
const CACHE_TTL = 60000;

async function getConfig(guildId) {
    const cached = configCache.get(guildId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.val;
    const val = await StarboardConfig.findOne({ where: { guildId } });
    configCache.set(guildId, { val, ts: Date.now() });
    return val;
}

function buildStarboardPayload(message, count, emoji) {
    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${emoji} **${count}** | <#${message.channel.id}>`)
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    const authorTag = message.author ? message.author.tag : 'Unknown User';
    const content = message.content && message.content.length > 0 ? message.content : '*Attachment or embed only*';

    const section = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${authorTag}**\n${content}`)
        );

    const avatar = message.author ? message.author.displayAvatarURL({ size: 256 }) : null;
    if (avatar) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar));

    container.addSectionComponents(section);

    const imageAttachment = message.attachments.find(a => a.contentType?.startsWith('image/'));
    const embedImage = message.embeds.find(e => e.image)?.image?.url;
    const imageUrl = imageAttachment?.url || embedImage;

    if (imageUrl) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        );
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(imageUrl)
            )
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Jump to Message')
                .setStyle(ButtonStyle.Link)
                .setURL(message.url)
        )
    );

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2
    };
}

async function handleReactionChange(reaction, user) {
    try {
        if (user.bot) return;
        if (reaction.partial) reaction = await reaction.fetch().catch(() => null);
        if (!reaction) return;

        let message = reaction.message;
        if (message.partial) message = await message.fetch().catch(() => null);
        if (!message || !message.guild) return;

        const config = await getConfig(message.guild.id);
        if (!config || !config.enabled || !config.channelId) return;
        if (!emojiMatches(config.emoji, reaction.emoji)) return;
        if (message.channel.id === config.channelId) return;

        const starboardChannel = message.guild.channels.cache.get(config.channelId);
        if (!starboardChannel) return;

        const count = reaction.count || 0;
        const existingPost = await StarboardPost.findOne({ where: { originalMessageId: message.id } });

        if (count < config.threshold) {
            if (existingPost) {
                existingPost.starCount = count;
                await existingPost.save();
            }
            return;
        }

        const payload = buildStarboardPayload(message, count, config.emoji);

        if (existingPost) {
            try {
                const starboardMsg = await starboardChannel.messages.fetch(existingPost.starboardMessageId);
                await starboardMsg.edit(payload);
                existingPost.starCount = count;
                await existingPost.save();
            } catch (error) {
                await existingPost.destroy().catch(() => {});
            }
            return;
        }

        const posted = await starboardChannel.send(payload).catch(() => null);
        if (!posted) return;

        await StarboardPost.create({
            guildId: message.guild.id,
            originalMessageId: message.id,
            originalChannelId: message.channel.id,
            starboardMessageId: posted.id,
            starCount: count
        });
    } catch (error) {
        console.error('Starboard event error:', error);
    }
}

module.exports = {
    name: 'starboardEvent',

    init(client) {
        client.on('messageReactionAdd', (reaction, user) => handleReactionChange(reaction, user));
        client.on('messageReactionRemove', (reaction, user) => handleReactionChange(reaction, user));
    }
};
