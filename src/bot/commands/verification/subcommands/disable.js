


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { VerificationConfig } = require('../../../../database/models');

function reply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'disable',
  description: 'Disable the verification gate for this server',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.', true);

    try {
      const config = await VerificationConfig.findOne({ where: { guildId: interaction.guild.id } });

      if (!config || !config.enabled)
        return reply(interaction, 'Already Disabled', 'Verification is already disabled for this server.', true);

      config.enabled = false;
      await config.save();

      await reply(interaction, 'Verification Disabled', 'The verification gate has been disabled for this server.');
    } catch (error) {
      console.error('Verification disable error:', error);
      await reply(interaction, 'Error', 'Failed to disable verification. Please try again.', true);
    }
  },
};
