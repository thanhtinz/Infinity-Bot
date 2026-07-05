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
  name: 'view',
  description: 'View a moderation case',

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

    const noReason = await tg(guildId, 'common.noReasonProvided');
    const body = await tg(guildId, 'case.view.body', {
      action: modCase.action,
      target: modCase.targetTag,
      targetId: modCase.targetId,
      moderator: modCase.moderatorTag,
      moderatorId: modCase.moderatorId,
      reason: modCase.reason || noReason,
      source: modCase.source,
      date: `<t:${Math.floor(new Date(modCase.createdAt).getTime() / 1000)}:f>`,
    });

    await modReply(interaction, await tg(guildId, 'case.view.title', { caseNumber }), body);
  },
};
