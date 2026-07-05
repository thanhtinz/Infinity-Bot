const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { tg } = require('../../../../utils/i18n');

function modReply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'restore',
  description: 'Restore a deleted moderation case',

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Moderate Members' }), true);

    await modReply(interaction, await tg(guildId, 'case.restore.unavailableTitle'), await tg(guildId, 'case.restore.unavailableBody'), true);
  },
};
