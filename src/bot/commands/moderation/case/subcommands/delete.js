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
  name: 'delete',
  description: 'Delete a moderation case',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const caseNumber = interaction.options.getInteger('case_number');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Moderate Members' }), true);

    const modCase = await ModLog.findOne({
      where: { guildId: interaction.guild.id, caseNumber }
    });

    if (!modCase)
      return modReply(interaction, await tg(guildId, 'case.common.caseNotFoundTitle'), await tg(guildId, 'case.common.caseNotFoundBody', { caseNumber }), true);

    await modCase.destroy();

    await modReply(interaction, await tg(guildId, 'case.delete.successTitle'), await tg(guildId, 'case.delete.success', { caseNumber }));
  },
};
