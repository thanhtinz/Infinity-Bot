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
const { AntinukeConfig, AntinukeWhitelist } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

module.exports = {
    name: 'reset',
    description: 'Reset antinuke to default settings',

    async execute(interactionOrMessage) {
        const member = interactionOrMessage.member;
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;

        if (guild.ownerId !== member.id) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.ownerOnlyReset'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const config = await AntinukeConfig.findOne({ where: { guildId: guild.id } });

        if (!config) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.notConfiguredYet'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        await config.update({
            enabled: false,
            logChannelId: null,
            punishment: 'stripall',
            threshold: 3,
            timeframe: 60,
            antiBan: true,
            antiKick: true,
            antiChannelCreate: true,
            antiChannelDelete: true,
            antiChannelEdit: false,
            antiRoleCreate: true,
            antiRoleDelete: true,
            antiRoleUpdate: true,
            antiWebhook: true,
            antiBot: true,
            antiGuildUpdate: false,
            antiEmoji: false
        });

        await AntinukeWhitelist.destroy({ where: { guildId: guild.id } });

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${await tg(guildId, 'antinuke.resetTitle')}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.resetBody'))
            );

        return interactionOrMessage.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
