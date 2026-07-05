const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { WelcomeConfig } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

module.exports = {
    name: 'setup',
    description: 'Setup welcome message',

    async execute(interactionOrMessage) {
        const member = interactionOrMessage.member;
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;
        const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;

        const existing = await WelcomeConfig.findOne({ where: { guildId: guild.id } });
        if (existing?.channelId) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'welcome.alreadyConfiguredTitle')}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'welcome.alreadyConfiguredBody')));
            return interactionOrMessage.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        if (!member.permissions.has('Administrator')) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'welcome.noPermission'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`welcome_setup_simple_${userId}`)
                .setLabel('Simple')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`welcome_setup_container_${userId}`)
                .setLabel('Container')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`welcome_cancel_${userId}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'welcome.setupTitle')}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(await tg(guildId, 'welcome.setupPrompt'))
            )
            .addActionRowComponents(buttonRow);

        return interactionOrMessage.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
