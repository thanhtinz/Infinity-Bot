


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { VerificationConfig } = require('../../../../database/models');
const { postVerificationPanel } = require('../../../utils/verificationPanel');

function reply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'panel',
  description: 'Re-post the verify button panel',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.', true);

    try {
      const config = await VerificationConfig.findOne({ where: { guildId: interaction.guild.id } });

      if (!config || !config.enabled || !config.channelId)
        return reply(interaction, 'Not Configured', 'Verification is not set up. Use `/verification setup` first.', true);

      const panelMsg = await postVerificationPanel(config, interaction.guild);

      if (!panelMsg)
        return reply(interaction, 'Error', 'The configured verification channel no longer exists.', true);

      await reply(interaction, 'Panel Posted', `The verify panel has been posted in <#${config.channelId}>.`);
    } catch (error) {
      console.error('Verification panel error:', error);
      await reply(interaction, 'Error', 'Failed to post the verify panel. Please check my permissions and try again.', true);
    }
  },
};
