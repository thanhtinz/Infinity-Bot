const ms = require('ms');
const { ModLog, WarnPunishConfig } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

async function applyAutoPunishment(interaction, targetUser, targetMember, warnCount) {
  const guildId = interaction.guild.id;
  const config = await WarnPunishConfig.findOne({
    where: { guildId: interaction.guild.id, warnCount }
  });

  if (!config) return null;

  const reason = await tg(guildId, 'warn.autoPunish.reason', { warnCount });

  try {
    if (config.action === 'mute') {
      if (!targetMember) return tg(guildId, 'warn.autoPunish.muteSkipped');
      if (!targetMember.moderatable) return tg(guildId, 'warn.autoPunish.muteFailedModeratable');

      const time = config.duration ? ms(config.duration) : null;
      if (!time || time < 1000 || time > 2419200000) return tg(guildId, 'warn.autoPunish.muteFailedDuration');

      await targetMember.timeout(time, reason);
    } else if (config.action === 'kick') {
      if (!targetMember) return tg(guildId, 'warn.autoPunish.kickSkipped');
      if (!targetMember.kickable) return tg(guildId, 'warn.autoPunish.kickFailedKickable');

      await targetMember.kick(reason);
    } else if (config.action === 'ban') {
      if (targetMember && !targetMember.bannable) return tg(guildId, 'warn.autoPunish.banFailedBannable');

      await interaction.guild.members.ban(targetUser, { reason });
    } else {
      return null;
    }
  } catch (error) {
    return tg(guildId, 'warn.autoPunish.actionFailed', { action: config.action, error: error.message });
  }

  try {
    const maxCase = await ModLog.max('caseNumber', { where: { guildId: interaction.guild.id } });
    await ModLog.create({
      caseNumber: (maxCase || 0) + 1,
      guildId: interaction.guild.id,
      moderatorId: interaction.client.user.id,
      moderatorTag: interaction.client.user.tag,
      targetId: targetUser.id,
      targetTag: targetUser.tag,
      action: config.action,
      reason,
      channelId: interaction.channel?.id || null,
      source: 'warnpunish'
    });
  } catch (dbError) {
    console.error('ModLog save error:', dbError.message);
  }

  return tg(guildId, 'warn.autoPunish.triggered', { action: config.action, warnCount });
}

module.exports = { applyAutoPunishment };
