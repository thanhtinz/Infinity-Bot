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
  name: 'unmute',
  description: 'Unmute muted users',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Moderate Members' }), true);

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'common.iNeedPermission', { permission: 'Moderate Members' }), true);

    if (!targetMember)
      return modReply(interaction, await tg(guildId, 'common.userNotFound'), await tg(guildId, 'common.userNotInServer'), true);

    if (targetMember.roles.highest.position >= interaction.member.roles.highest.position)
      return modReply(interaction, await tg(guildId, 'moderation.unmute.cannotUnmuteTitle'), await tg(guildId, 'moderation.unmute.cannotUnmuteHigherRole'), true);

    if (!targetMember.isCommunicationDisabled())
      return modReply(interaction, await tg(guildId, 'moderation.unmute.notMutedTitle'), await tg(guildId, 'moderation.unmute.notMutedBody'), true);

    if (!targetMember.moderatable)
      return modReply(interaction, await tg(guildId, 'moderation.unmute.cannotUnmuteTitle'), await tg(guildId, 'moderation.unmute.cannotUnmuteUnmoderatable'), true);

    try {
      await targetMember.timeout(null);
      await modReply(interaction, await tg(guildId, 'moderation.unmute.successTitle'),
        await tg(guildId, 'moderation.unmute.success', { user: `${targetUser}`, moderator: interaction.user.tag }));
    } catch (error) {
      const msg = error.code === 50013 ? await tg(guildId, 'moderation.unmute.errorPermission') : await tg(guildId, 'moderation.unmute.errorGeneric');
      await modReply(interaction, await tg(guildId, 'common.error'), msg, true);
    }
  },
};
