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
  name: 'unban',
  description: 'Unban a previously banned user',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || await tg(guildId, 'common.noReasonProvided');

    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Ban Members' }), true);

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers))
      return modReply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'common.iNeedPermission', { permission: 'Ban Members' }), true);

    try {
      const bannedUser = await interaction.guild.bans.fetch(userId).catch(() => null);
      if (!bannedUser)
        return modReply(interaction, await tg(guildId, 'moderation.unban.notBannedTitle'), await tg(guildId, 'moderation.unban.notBannedBody'), true);

      await interaction.guild.members.unban(userId, reason);
      await modReply(interaction, await tg(guildId, 'moderation.unban.successTitle'),
        await tg(guildId, 'moderation.unban.success', { user: bannedUser.user.tag, moderator: interaction.user.tag, reason }));
    } catch (error) {
      const msg = error.code === 50013 ? await tg(guildId, 'moderation.unban.errorPermission') : await tg(guildId, 'moderation.unban.errorGeneric');
      await modReply(interaction, await tg(guildId, 'common.error'), msg, true);
    }
  },
};
