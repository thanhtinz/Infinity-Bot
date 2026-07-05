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
const { tg } = require('../../../utils/i18n');

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
    const guildId = interaction.guildId;

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Server' }), true);

    try {
      const config = await VerificationConfig.findOne({ where: { guildId: interaction.guild.id } });

      if (!config || !config.enabled || !config.channelId)
        return reply(interaction, await tg(guildId, 'verification.panel.notConfiguredTitle'), await tg(guildId, 'verification.panel.notConfiguredBody'), true);

      const panelMsg = await postVerificationPanel(config, interaction.guild);

      if (!panelMsg)
        return reply(interaction, await tg(guildId, 'common.error'), await tg(guildId, 'verification.panel.channelGoneBody'), true);

      await reply(interaction, await tg(guildId, 'verification.panel.postedTitle'), await tg(guildId, 'verification.panel.postedBody', { channel: `<#${config.channelId}>` }));
    } catch (error) {
      console.error('Verification panel error:', error);
      await reply(interaction, await tg(guildId, 'common.error'), await tg(guildId, 'verification.panel.errorGeneric'), true);
    }
  },
};
