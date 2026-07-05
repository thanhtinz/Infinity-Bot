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
  name: 'temprole',
  description: 'Temporarily add roles to users',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const role = interaction.options.getRole('role');
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || await tg(guildId, 'common.noReasonProvided');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Roles' }), true);

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
      return modReply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'common.iNeedPermission', { permission: 'Manage Roles' }), true);

    if (!targetMember)
      return modReply(interaction, await tg(guildId, 'common.userNotFound'), await tg(guildId, 'common.userNotInServer'), true);

    const time = ms(duration);
    if (!time || time < 1000 || time > 315360000000)
      return modReply(interaction, await tg(guildId, 'common.invalidDuration'), await tg(guildId, 'moderation.temprole.invalidDurationBody'), true);

    if (role.position >= interaction.guild.members.me.roles.highest.position)
      return modReply(interaction, await tg(guildId, 'common.roleTooHigh'), await tg(guildId, 'common.roleTooHighMe'), true);

    if (targetMember.roles.cache.has(role.id))
      return modReply(interaction, await tg(guildId, 'moderation.temprole.roleAlreadyAssignedTitle'), await tg(guildId, 'moderation.temprole.roleAlreadyAssignedBody'), true);

    try {
      await targetMember.roles.add(role, `[TEMPROLE ${ms(time, { long: true })}] ${reason}`);

      setTimeout(async () => {
        try {
          const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
          if (member?.roles.cache.has(role.id)) {
            await member.roles.remove(role, 'Temporary role expired');
          }
        } catch {}
      }, time);

      await modReply(interaction, await tg(guildId, 'moderation.temprole.successTitle'),
        await tg(guildId, 'moderation.temprole.success', {
          user: `${targetUser}`,
          role: `${role}`,
          duration: ms(time, { long: true }),
          moderator: interaction.user.tag,
          reason,
        }));
    } catch (error) {
      const msg = error.code === 50013 ? await tg(guildId, 'moderation.temprole.errorPermission') : await tg(guildId, 'moderation.temprole.errorGeneric');
      await modReply(interaction, await tg(guildId, 'common.error'), msg, true);
    }
  },
};
