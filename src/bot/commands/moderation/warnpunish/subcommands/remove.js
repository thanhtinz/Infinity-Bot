const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { WarnPunishConfig } = require('../../../../../database/models');
const { tg } = require('../../../../utils/i18n');

function modReply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'remove',
  description: 'Remove a warning punishment threshold',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const warnCount = interaction.options.getInteger('warn_count');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Server' }), true);

    const deletedCount = await WarnPunishConfig.destroy({
      where: { guildId: interaction.guild.id, warnCount }
    });

    if (deletedCount === 0)
      return modReply(interaction, await tg(guildId, 'common.notFound'), await tg(guildId, 'warnpunish.remove.notFound', { warnCount }), true);

    await modReply(interaction, await tg(guildId, 'warnpunish.remove.successTitle'), await tg(guildId, 'warnpunish.remove.success', { warnCount }));
  },
};
