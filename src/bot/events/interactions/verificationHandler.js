
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');
const { VerificationConfig } = require('../../../database/models');

function ephemeralReply(interaction, text) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}

async function handle(interaction) {
    if (!interaction.isButton() || interaction.customId !== 'verification_verify') return false;

    try {
        const config = await VerificationConfig.findOne({ where: { guildId: interaction.guild.id } });

        if (!config || !config.enabled || !config.verifiedRoleId) {
            await ephemeralReply(interaction, 'Verification is not enabled for this server.');
            return true;
        }

        const member = interaction.member;

        if (member.roles.cache.has(config.verifiedRoleId)) {
            await ephemeralReply(interaction, 'You are already verified.');
            return true;
        }

        const me = interaction.guild.members.me;
        if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await ephemeralReply(interaction, 'I do not have permission to assign roles right now. Please contact a server admin.');
            return true;
        }

        try {
            await member.roles.add(config.verifiedRoleId, 'Member verified');
        } catch (error) {
            console.error('Verification role add error:', error);
            await ephemeralReply(interaction, 'Failed to assign the verified role. Please contact a server admin.');
            return true;
        }

        if (config.unverifiedRoleId && member.roles.cache.has(config.unverifiedRoleId)) {
            await member.roles.remove(config.unverifiedRoleId, 'Member verified').catch(() => { });
        }

        await ephemeralReply(interaction, `You have been verified! Welcome to **${interaction.guild.name}**.`);
        return true;
    } catch (error) {
        console.error('Verification handler error:', error);
        try {
            await ephemeralReply(interaction, 'An error occurred while verifying you. Please try again.');
        } catch { }
        return true;
    }
}

module.exports = { handle };
