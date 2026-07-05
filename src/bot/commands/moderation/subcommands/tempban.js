const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const ms = require('ms');
const { tg } = require('../../../utils/i18n');

function modReply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'tempban',
  description: 'Temporarily ban users',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || await tg(guildId, 'common.noReasonProvided');
    const deleteMessageDays = interaction.options.getInteger('delete_messages') || 0;

    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Ban Members' }), true);

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers))
      return modReply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'common.iNeedPermission', { permission: 'Ban Members' }), true);

    const time = ms(duration);
    if (!time || time < 1000 || time > 315360000000)
      return modReply(interaction, await tg(guildId, 'common.invalidDuration'), await tg(guildId, 'moderation.tempban.invalidDurationBody'), true);

    if (targetMember && targetMember.roles.highest.position >= interaction.member.roles.highest.position)
      return modReply(interaction, await tg(guildId, 'moderation.tempban.cannotBanTitle'), await tg(guildId, 'moderation.tempban.cannotBanHigherRole'), true);

    if (targetMember && !targetMember.bannable)
      return modReply(interaction, await tg(guildId, 'moderation.tempban.cannotBanTitle'), await tg(guildId, 'moderation.tempban.cannotBanUnbannable'), true);

    try {
      await interaction.guild.members.ban(targetUser, {
        deleteMessageDays,
        reason: `[TEMPBAN ${ms(time, { long: true })}] ${reason}`
      });

      setTimeout(async () => {
        try {
          await interaction.guild.members.unban(targetUser, 'Tempban expired');
        } catch {}
      }, time);

      const deletedNote = deleteMessageDays > 0 ? await tg(guildId, 'moderation.tempban.deletedNote', { days: deleteMessageDays }) : '';
      await modReply(interaction, await tg(guildId, 'moderation.tempban.successTitle'),
        await tg(guildId, 'moderation.tempban.success', {
          user: targetUser.tag,
          duration: ms(time, { long: true }),
          moderator: interaction.user.tag,
          reason,
          deletedNote,
        }));
    } catch (error) {
      const msg = error.code === 50013 ? await tg(guildId, 'moderation.tempban.errorPermission') : await tg(guildId, 'moderation.tempban.errorGeneric');
      await modReply(interaction, await tg(guildId, 'common.error'), msg, true);
    }
  },
};
