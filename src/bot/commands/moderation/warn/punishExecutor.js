


const ms = require('ms');
const { ModLog, WarnPunishConfig } = require('../../../../database/models');

async function applyAutoPunishment(interaction, targetUser, targetMember, warnCount) {
  const config = await WarnPunishConfig.findOne({
    where: { guildId: interaction.guild.id, warnCount }
  });

  if (!config) return null;

  const reason = `Auto-punishment: reached ${warnCount} warning(s)`;

  try {
    if (config.action === 'mute') {
      if (!targetMember) return 'Auto-punishment (mute) skipped: user is not in this server.';
      if (!targetMember.moderatable) return 'Auto-punishment (mute) failed: I cannot moderate this user.';

      const time = config.duration ? ms(config.duration) : null;
      if (!time || time < 1000 || time > 2419200000) return 'Auto-punishment (mute) failed: invalid configured duration.';

      await targetMember.timeout(time, reason);
    } else if (config.action === 'kick') {
      if (!targetMember) return 'Auto-punishment (kick) skipped: user is not in this server.';
      if (!targetMember.kickable) return 'Auto-punishment (kick) failed: I cannot kick this user.';

      await targetMember.kick(reason);
    } else if (config.action === 'ban') {
      if (targetMember && !targetMember.bannable) return 'Auto-punishment (ban) failed: I cannot ban this user.';

      await interaction.guild.members.ban(targetUser, { reason });
    } else {
      return null;
    }
  } catch (error) {
    return `Auto-punishment (${config.action}) failed: ${error.message}`;
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

  return `Auto-punishment triggered: **${config.action}** (reached ${warnCount} warning(s)).`;
}

module.exports = { applyAutoPunishment };
