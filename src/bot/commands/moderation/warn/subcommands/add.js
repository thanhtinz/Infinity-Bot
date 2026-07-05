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
const { tg } = require('../../../../utils/i18n');

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
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Moderate Members' }), true);

    if (targetUser.bot)
      return modReply(interaction, await tg(guildId, 'warn.add.cannotWarnTitle'), await tg(guildId, 'warn.add.cannotWarnBot'), true);

    if (targetMember && targetMember.roles.highest.position >= interaction.member.roles.highest.position)
      return modReply(interaction, await tg(guildId, 'warn.add.cannotWarnTitle'), await tg(guildId, 'warn.add.cannotWarnHigherRole'), true);

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

      let body = await tg(guildId, 'warn.add.success', {
        caseNumber,
        user: targetUser.tag,
        moderator: interaction.user.tag,
        reason,
        warnCount,
      });
      if (punishmentResult) body += `\n\n${punishmentResult}`;

      await modReply(interaction, await tg(guildId, 'warn.add.successTitle'), body);
    } catch (error) {
      console.error('Warn add error:', error);
      await modReply(interaction, await tg(guildId, 'common.error'), await tg(guildId, 'warn.add.errorGeneric'), true);
    }
  },
};
