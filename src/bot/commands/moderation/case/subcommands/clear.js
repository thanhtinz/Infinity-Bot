const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { ModLog } = require('../../../../../database/models');
const { tg } = require('../../../../utils/i18n');

function modReply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'clear',
  description: 'Delete all moderation cases for a user',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Moderate Members' }), true);

    const deletedCount = await ModLog.destroy({
      where: { guildId: interaction.guild.id, targetId: targetUser.id }
    });

    await modReply(interaction, await tg(guildId, 'case.clear.successTitle'), await tg(guildId, 'case.clear.success', { count: deletedCount, user: targetUser.tag }));
  },
};
