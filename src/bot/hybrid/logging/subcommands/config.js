const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');
const { LoggingConfig } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

module.exports = {
    name: 'config',
    description: 'View logging configuration',

    async execute(interactionOrMessage) {
        const member = interactionOrMessage.member;
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;

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

        try {
            const config = await LoggingConfig.findOne({ where: { guildId: guild.id } });

            if (!config) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'logging.configTitle')}`)
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(await tg(guildId, 'logging.configNotFound'))
                    );
                return interactionOrMessage.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const notSet = await tg(guildId, 'logging.notSet');
            const fmt = (id) => id ? `<#${id}>` : notSet;

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'logging.configTitle')}`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        await tg(guildId, 'logging.configBody', {
                            messageLogs: fmt(config.messageLogsChannelId),
                            memberLogs: fmt(config.memberLogsChannelId),
                            moderationLogs: fmt(config.moderationLogsChannelId),
                            serverLogs: fmt(config.serverLogsChannelId),
                            voiceLogs: fmt(config.voiceLogsChannelId),
                        })
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'logging.configHint'))
                );

            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('Logging config error:', error);
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'logging.configError'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }
    }
};
