


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { ModLog } = require('../../../../../database/models');
const { applyAutoPunishment } = require('../punishExecutor');

function modReply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'add',
  description: 'Warn a user',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, 'Permission Denied', 'You need the **Moderate Members** permission.', true);

    if (targetUser.bot)
      return modReply(interaction, 'Cannot Warn User', 'You cannot warn bots.', true);

    if (targetMember && targetMember.roles.highest.position >= interaction.member.roles.highest.position)
      return modReply(interaction, 'Cannot Warn User', 'They have an equal or higher role than you.', true);

    try {
      const maxCase = await ModLog.max('caseNumber', { where: { guildId: interaction.guild.id } });
      const caseNumber = (maxCase || 0) + 1;

      await ModLog.create({
        caseNumber,
        guildId: interaction.guild.id,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        targetId: targetUser.id,
        targetTag: targetUser.tag,
        action: 'warn',
        reason,
        channelId: interaction.channel?.id || null,
        source: 'manual'
      });

      const warnCount = await ModLog.count({
        where: { guildId: interaction.guild.id, targetId: targetUser.id, action: 'warn' }
      });

      const punishmentResult = await applyAutoPunishment(interaction, targetUser, targetMember, warnCount);

      let body = `**Case:** #${caseNumber}\n**User:** ${targetUser.tag}\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}\n**Total Warnings:** ${warnCount}`;
      if (punishmentResult) body += `\n\n${punishmentResult}`;

      await modReply(interaction, 'User Warned', body);
    } catch (error) {
      console.error('Warn add error:', error);
      await modReply(interaction, 'Error', 'Failed to warn user.', true);
    }
  },
};
