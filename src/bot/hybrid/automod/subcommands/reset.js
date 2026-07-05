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
const { AutomodConfig, AutomodWhitelist } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

module.exports = {
    name: 'reset',
    description: 'Reset automod to default settings',

    async execute(interactionOrMessage) {
        const member = interactionOrMessage.member;
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;

        if (!member.permissions.has('ManageGuild')) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'automod.noPermissionReset'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const config = await AutomodConfig.findOne({ where: { guildId: guild.id } });

        if (!config) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'automod.notConfiguredYet'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        await config.update({
            enabled: false,
            logChannelId: null,
            antiSpam: false,
            antiLink: false,
            antiInvite: false,
            antiBadWords: false,
            antiMassMention: false,
            antiCaps: false,
            antiPing: false,
            antiSpamPunishment: 'delete',
            antiLinkPunishment: 'delete',
            antiInvitePunishment: 'delete',
            antiBadWordsPunishment: 'delete',
            antiMassMentionPunishment: 'delete',
            antiCapsPunishment: 'delete',
            antiPingPunishment: 'delete'
        });

        await AutomodWhitelist.destroy({ where: { guildId: guild.id } });

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${await tg(guildId, 'automod.resetTitle')}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(await tg(guildId, 'automod.resetBody'))
            );

        return interactionOrMessage.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
