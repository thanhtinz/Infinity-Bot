const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require('discord.js');
const { t } = require('./i18n');

/**
 * Builds the standard Components V2 container shape used across the bot
 * (title as a bold header, a small divider, then the body).
 */
function buildContainer(title, body) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    return container;
}

/**
 * Reply to an interaction (or a hybrid message) with a localized
 * title/body pair pulled from the i18n catalogs.
 *
 * @param {import('discord.js').Interaction|import('discord.js').Message} interactionOrMessage
 * @param {string} guildId
 * @param {string} titleKey - i18n key for the bold header
 * @param {string} bodyKey - i18n key for the body text
 * @param {object} [vars] - shared interpolation vars for both title & body
 * @param {object} [opts]
 * @param {boolean} [opts.ephemeral=false]
 * @param {boolean} [opts.edit=false] - use editReply instead of reply
 * @param {boolean} [opts.followUp=false] - use followUp instead of reply
 */
async function localizedReply(interactionOrMessage, guildId, titleKey, bodyKey, vars = {}, opts = {}) {
    const { ephemeral = false, edit = false, followUp = false } = opts;
    const language = await resolveLanguage(guildId);

    const title = t(language, titleKey, vars);
    const body = t(language, bodyKey, vars);
    const container = buildContainer(title, body);

    const payload = { components: [container], flags: MessageFlags.IsComponentsV2, ephemeral };

    if (edit && typeof interactionOrMessage.editReply === 'function') {
        return interactionOrMessage.editReply(payload);
    }
    if (followUp && typeof interactionOrMessage.followUp === 'function') {
        return interactionOrMessage.followUp(payload);
    }
    return interactionOrMessage.reply(payload);
}

/**
 * Like localizedReply, but takes already-resolved title/body strings
 * (useful when the caller already called tg()/t() itself, e.g. to build
 * a more complex body with conditional segments).
 */
function replyWithText(interactionOrMessage, title, body, opts = {}) {
    const { ephemeral = false, edit = false, followUp = false } = opts;
    const container = buildContainer(title, body);
    const payload = { components: [container], flags: MessageFlags.IsComponentsV2, ephemeral };

    if (edit && typeof interactionOrMessage.editReply === 'function') {
        return interactionOrMessage.editReply(payload);
    }
    if (followUp && typeof interactionOrMessage.followUp === 'function') {
        return interactionOrMessage.followUp(payload);
    }
    return interactionOrMessage.reply(payload);
}

async function resolveLanguage(guildId) {
    if (!guildId) return 'en';
    try {
        const GuildLanguage = require('../../database/models/GuildLanguage');
        return await GuildLanguage.getLanguage(guildId);
    } catch {
        return 'en';
    }
}

module.exports = { localizedReply, replyWithText, buildContainer, resolveLanguage };
