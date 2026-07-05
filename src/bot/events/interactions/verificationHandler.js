
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');
const { VerificationConfig } = require('../../../database/models');
const { tg } = require('../../utils/i18n');

function ephemeralReply(interaction, text) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}

async function handle(interaction) {
    if (!interaction.isButton() || interaction.customId !== 'verification_verify') return false;
    const guildId = interaction.guild.id;

    try {
        const config = await VerificationConfig.findOne({ where: { guildId: interaction.guild.id } });

        if (!config || !config.enabled || !config.verifiedRoleId) {
            await ephemeralReply(interaction, await tg(guildId, 'verification.verifyButton.notEnabled'));
            return true;
        }

        const member = interaction.member;

        if (member.roles.cache.has(config.verifiedRoleId)) {
            await ephemeralReply(interaction, await tg(guildId, 'verification.verifyButton.alreadyVerified'));
            return true;
        }

        const me = interaction.guild.members.me;
        if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await ephemeralReply(interaction, await tg(guildId, 'verification.verifyButton.missingPermission'));
            return true;
        }

        try {
            await member.roles.add(config.verifiedRoleId, 'Member verified');
        } catch (error) {
            console.error('Verification role add error:', error);
            await ephemeralReply(interaction, await tg(guildId, 'verification.verifyButton.roleAddFailed'));
            return true;
        }

        if (config.unverifiedRoleId && member.roles.cache.has(config.unverifiedRoleId)) {
            await member.roles.remove(config.unverifiedRoleId, 'Member verified').catch(() => { });
        }

        await ephemeralReply(interaction, await tg(guildId, 'verification.verifyButton.success', { guild: interaction.guild.name }));
        return true;
    } catch (error) {
        console.error('Verification handler error:', error);
        try {
            await ephemeralReply(interaction, await tg(guildId, 'verification.verifyButton.genericError'));
        } catch { }
        return true;
    }
}

module.exports = { handle };
