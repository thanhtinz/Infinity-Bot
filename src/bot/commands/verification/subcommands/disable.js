const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { VerificationConfig } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

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
    const guildId = interaction.guildId;

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Server' }), true);

    try {
      const config = await VerificationConfig.findOne({ where: { guildId: interaction.guild.id } });

      if (!config || !config.enabled)
        return reply(interaction, await tg(guildId, 'verification.disable.alreadyDisabledTitle'), await tg(guildId, 'verification.disable.alreadyDisabledBody'), true);

      config.enabled = false;
      await config.save();

      await reply(interaction, await tg(guildId, 'verification.disable.disabledTitle'), await tg(guildId, 'verification.disable.disabledBody'));
    } catch (error) {
      console.error('Verification disable error:', error);
      await reply(interaction, await tg(guildId, 'common.error'), await tg(guildId, 'verification.disable.errorGeneric'), true);
    }
  },
};
