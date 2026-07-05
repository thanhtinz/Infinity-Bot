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
const emojis = require('../../../emojis.json');
const { tg } = require('../../../utils/i18n');

module.exports = {
    name: 'settings',
    description: 'View and edit current automod settings',

    async execute(interactionOrMessage) {
        const member = interactionOrMessage.member;
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;

        if (!member.permissions.has('ManageGuild')) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'automod.noPermissionSettings'))
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
                    new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'automod.notConfiguredSettingsTitle')}`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'automod.notConfiguredSettingsBody'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const whitelistCount = await AutomodWhitelist.count({ where: { guildId: guild.id } });

        const moduleNames = {
            antiSpam: 'Anti-Spam',
            antiLink: 'Anti-Link',
            antiInvite: 'Anti-Invite',
            antiBadWords: 'Anti-Bad Words',
            antiMassMention: 'Anti-Mass Mention',
            antiCaps: 'Anti-Caps'
        };

        const disabledModules = [];
        for (const [key, name] of Object.entries(moduleNames)) {
            if (!config[key]) {
                disabledModules.push(name);
            }
        }

        const punishmentLabels = {
            delete: 'Delete Message',
            warn: 'Warn User',
            mute: 'Mute User',
            kick: 'Kick User',
            ban: 'Ban User'
        };

        const badWords = config.getBadWords();


        let enabledModulesList = '';
        for (const [key, name] of Object.entries(moduleNames)) {
            if (config[key]) {
                const punishmentKey = key + 'Punishment';
                const punishment = punishmentLabels[config[punishmentKey]] || 'Delete Message';
                enabledModulesList += `${emojis.enabled} ${name} (${punishment})\n`;
            }
        }

        const none = await tg(guildId, 'automod.none');
        const notSet = await tg(guildId, 'automod.notSet');
        const status = config.enabled
            ? `${emojis.online} ${await tg(guildId, 'automod.statusEnabled')}`
            : `${emojis.offline} ${await tg(guildId, 'automod.statusDisabled')}`;

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'automod.settingsTitle')}\n${await tg(guildId, 'automod.statusLine', { status })}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    await tg(guildId, 'automod.infoLines', {
                        logChannel: config.logChannelId ? `<#${config.logChannelId}>` : notSet,
                        whitelistCount,
                        badWordCount: badWords.length,
                    })
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    await tg(guildId, 'automod.thresholdsLines', {
                        spamThreshold: config.spamThreshold,
                        spamInterval: config.spamInterval,
                        mentionLimit: config.mentionLimit,
                        capsPercentage: config.capsPercentage,
                    })
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    await tg(guildId, 'automod.activeProtections', { list: enabledModulesList || none })
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    await tg(guildId, 'automod.disabledModules', {
                        list: disabledModules.length > 0 ? disabledModules.map(m => `${emojis.disabled} ${m}`).join('\n') : none,
                    })
                )
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('automod_toggle')
                        .setLabel(config.enabled ? 'Disable' : 'Enable')
                        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('automod_edit_modules')
                        .setLabel('Edit Modules')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('automod_edit_settings')
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
