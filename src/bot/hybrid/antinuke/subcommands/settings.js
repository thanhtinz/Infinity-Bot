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
const emojis = require('../../../emojis.json');
const { tg } = require('../../../utils/i18n');

module.exports = {
    name: 'settings',
    description: 'View and edit current antinuke settings',

    async execute(interactionOrMessage) {
        const member = interactionOrMessage.member;
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;

        if (guild.ownerId !== member.id) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.ownerOnlySettings'))
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
                    new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'antinuke.notConfiguredSettingsTitle')}`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.notConfiguredSettingsBody'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const whitelistCount = await AntinukeWhitelist.count({ where: { guildId: guild.id } });

        const enabledModules = [];
        const disabledModules = [];

        const moduleNames = {
            antiBan: 'Anti-Ban',
            antiKick: 'Anti-Kick',
            antiChannelCreate: 'Anti-Channel Create',
            antiChannelDelete: 'Anti-Channel Delete',
            antiChannelEdit: 'Anti-Channel Edit',
            antiRoleCreate: 'Anti-Role Create',
            antiRoleDelete: 'Anti-Role Delete',
            antiRoleUpdate: 'Anti-Role Update',
            antiWebhook: 'Anti-Webhook',
            antiBot: 'Anti-Bot',
            antiEmoji: 'Anti-Emoji',
            antiGuildUpdate: 'Anti-Guild Update'
        };

        for (const [key, name] of Object.entries(moduleNames)) {
            if (config[key]) {
                enabledModules.push(name);
            } else {
                disabledModules.push(name);
            }
        }

        const punishmentLabels = {
            stripall: 'Strip All Roles',
            kick: 'Kick User',
            ban: 'Ban User'
        };

        const none = await tg(guildId, 'antinuke.none');
        const notSet = await tg(guildId, 'antinuke.notSet');
        const status = config.enabled
            ? `${emojis.online} ${await tg(guildId, 'antinuke.statusEnabled')}`
            : `${emojis.offline} ${await tg(guildId, 'antinuke.statusDisabled')}`;

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'antinuke.settingsTitle')}\n${await tg(guildId, 'antinuke.statusLine', { status })}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    await tg(guildId, 'antinuke.infoLines', {
                        threshold: config.threshold,
                        timeframe: config.timeframe,
                        punishment: punishmentLabels[config.punishment] || config.punishment,
                        logChannel: config.logChannelId ? `<#${config.logChannelId}>` : notSet,
                        whitelistCount,
                    })
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    await tg(guildId, 'antinuke.enabledModules', { list: enabledModules.length > 0 ? enabledModules.map(m => `${emojis.enabled} ${m}`).join('\n') : none })
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    await tg(guildId, 'antinuke.disabledModules', { list: disabledModules.length > 0 ? disabledModules.map(m => `${emojis.disabled} ${m}`).join('\n') : none })
                )
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('antinuke_toggle')
                        .setLabel(config.enabled ? 'Disable' : 'Enable')
                        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('antinuke_edit_modules')
                        .setLabel('Edit Modules')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('antinuke_edit_settings')
                        .setLabel('Edit Settings')
                        .setStyle(ButtonStyle.Secondary)
                )
            );

        return interactionOrMessage.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }
};
