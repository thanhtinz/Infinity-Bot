const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { tg } = require('../../../utils/i18n');

function modReply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'softban',
  description: 'Softban users from the server (ban then unban to delete messages)',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || await tg(guildId, 'common.noReasonProvided');
    const deleteMessageDays = interaction.options.getInteger('delete_messages') || 1;

    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Ban Members' }), true);

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers))
      return modReply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'common.iNeedPermission', { permission: 'Ban Members' }), true);

    if (targetMember && targetMember.roles.highest.position >= interaction.member.roles.highest.position)
      return modReply(interaction, await tg(guildId, 'moderation.softban.cannotSoftbanTitle'), await tg(guildId, 'moderation.softban.cannotSoftbanHigherRole'), true);

    if (targetMember && !targetMember.bannable)
      return modReply(interaction, await tg(guildId, 'moderation.softban.cannotSoftbanTitle'), await tg(guildId, 'moderation.softban.cannotSoftbanUnbannable'), true);

    try {
      await interaction.guild.members.ban(targetUser, { deleteMessageDays, reason: `[SOFTBAN] ${reason}` });
      await interaction.guild.members.unban(targetUser, 'Softban - Auto unban');

      await modReply(interaction, await tg(guildId, 'moderation.softban.successTitle'),
        await tg(guildId, 'moderation.softban.success', { user: targetUser.tag, moderator: interaction.user.tag, reason, days: deleteMessageDays }));
    } catch (error) {
      const msg = error.code === 50013 ? await tg(guildId, 'moderation.softban.errorPermission') : await tg(guildId, 'moderation.softban.errorGeneric');
      await modReply(interaction, await tg(guildId, 'common.error'), msg, true);
    }
  },
};
