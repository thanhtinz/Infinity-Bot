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
  name: 'kick',
  description: 'Kick users from the server',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || await tg(guildId, 'common.noReasonProvided');

    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Kick Members' }), true);

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers))
      return modReply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'common.iNeedPermission', { permission: 'Kick Members' }), true);

    if (!targetMember)
      return modReply(interaction, await tg(guildId, 'common.userNotFound'), await tg(guildId, 'common.userNotInServer'), true);

    if (targetMember.roles.highest.position >= interaction.member.roles.highest.position)
      return modReply(interaction, await tg(guildId, 'moderation.kick.cannotKickTitle'), await tg(guildId, 'moderation.kick.cannotKickHigherRole'), true);

    if (!targetMember.kickable)
      return modReply(interaction, await tg(guildId, 'moderation.kick.cannotKickTitle'), await tg(guildId, 'moderation.kick.cannotKickUnkickable'), true);

    try {
      await targetMember.kick(reason);
      await modReply(interaction, await tg(guildId, 'moderation.kick.successTitle'),
        await tg(guildId, 'moderation.kick.success', { user: targetUser.tag, moderator: interaction.user.tag, reason }));
    } catch (error) {
      const msg = error.code === 50013 ? await tg(guildId, 'moderation.kick.errorPermission') : await tg(guildId, 'moderation.kick.errorGeneric');
      await modReply(interaction, await tg(guildId, 'common.error'), msg, true);
    }
  },
};
