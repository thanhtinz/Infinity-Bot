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
  name: 'rolegive',
  description: 'Give a role to a user',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const role = interaction.options.getRole('role');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Roles' }), true);

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
      return modReply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'common.iNeedPermission', { permission: 'Manage Roles' }), true);

    if (!targetMember)
      return modReply(interaction, await tg(guildId, 'common.userNotFound'), await tg(guildId, 'common.userNotInServer'), true);

    if (role.position >= interaction.guild.members.me.roles.highest.position)
      return modReply(interaction, await tg(guildId, 'common.roleTooHigh'), await tg(guildId, 'common.roleTooHighMe'), true);

    if (interaction.member.id !== interaction.guild.ownerId && role.position >= interaction.member.roles.highest.position)
      return modReply(interaction, await tg(guildId, 'common.roleTooHigh'), await tg(guildId, 'common.roleTooHighYou'), true);

    if (targetMember.roles.cache.has(role.id))
      return modReply(interaction, await tg(guildId, 'moderation.give.roleAlreadyAssignedTitle'), await tg(guildId, 'moderation.give.roleAlreadyAssignedBody'), true);

    try {
      await targetMember.roles.add(role, `[ROLEGIVE] By ${interaction.user.tag}`);
      await modReply(interaction, await tg(guildId, 'moderation.give.successTitle'),
        await tg(guildId, 'moderation.give.success', { user: `${targetUser}`, role: role.name, moderator: interaction.user.tag }));
    } catch (error) {
      const msg = error.code === 50013 ? await tg(guildId, 'moderation.give.errorPermission') : await tg(guildId, 'moderation.give.errorGeneric');
      await modReply(interaction, await tg(guildId, 'common.error'), msg, true);
    }
  },
};
