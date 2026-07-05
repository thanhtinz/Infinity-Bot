const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { LoggingConfig } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

const LOG_CATEGORIES = [
    { value: 'messageLogs', label: 'Message Logs', description: 'Delete, edit & bulk delete' },
    { value: 'memberLogs', label: 'Member Logs', description: 'Join, leave & profile updates' },
    { value: 'moderationLogs', label: 'Moderation Logs', description: 'Ban, unban, kick & timeout' },
    { value: 'serverLogs', label: 'Server Logs', description: 'Channels, roles & server settings' },
    { value: 'voiceLogs', label: 'Voice Logs', description: 'Join, leave, switch & mute' }
];

// NOTE: kept synchronous with English labels — this is also called (with no
// args) from src/bot/events/interactions/loggingHandler.js, so changing its
// signature/behavior here would break that call site. Localizing this
// select-menu's labels is deferred (see report).
function buildCategorySelect(placeholder = 'Select a log type to configure') {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('logging_category_select')
        .setPlaceholder(placeholder)
        .setMinValues(1)
        .setMaxValues(1);
    for (const cat of LOG_CATEGORIES) {
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setValue(cat.value)
                .setLabel(cat.label)
                .setDescription(cat.description)
        );
    }
    return menu;
}

module.exports = {
    name: 'setup',
    description: 'Setup logging channels',
    LOG_CATEGORIES,
    buildCategorySelect,

    async execute(interactionOrMessage) {
        const member = interactionOrMessage.member;
        const guildId = interactionOrMessage.guild.id;

        if (!member.permissions.has('Administrator')) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'logging.noPermission'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const existing = await LoggingConfig.findOne({ where: { guildId: interactionOrMessage.guild.id } });
        if (existing) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'logging.alreadyConfiguredTitle')}`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'logging.alreadyConfiguredBody'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(await tg(guildId, 'logging.setupPrompt'))
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(buildCategorySelect())
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('logging_setup_cancel')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Danger)
                )
            );

        return interactionOrMessage.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
