


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { ModLog } = require('../../../../../database/models');

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
    const caseNumber = interaction.options.getInteger('case_number');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, 'Permission Denied', 'You need the **Moderate Members** permission.', true);

    const modCase = await ModLog.findOne({
      where: { guildId: interaction.guild.id, caseNumber }
    });

    if (!modCase)
      return modReply(interaction, 'Case Not Found', `No case with number **#${caseNumber}** exists in this server.`, true);

    const body =
      `**Action:** ${modCase.action}\n` +
      `**Target:** ${modCase.targetTag} (${modCase.targetId})\n` +
      `**Moderator:** ${modCase.moderatorTag} (${modCase.moderatorId})\n` +
      `**Reason:** ${modCase.reason || 'No reason provided'}\n` +
      `**Source:** ${modCase.source}\n` +
      `**Date:** <t:${Math.floor(new Date(modCase.createdAt).getTime() / 1000)}:f>`;

    await modReply(interaction, `Case #${caseNumber}`, body);
  },
};
