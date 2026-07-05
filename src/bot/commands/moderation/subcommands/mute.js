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
  name: 'mute',
  description: 'Mute users for a duration',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || await tg(guildId, 'common.noReasonProvided');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Moderate Members' }), true);

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'common.iNeedPermission', { permission: 'Moderate Members' }), true);

    if (!targetMember)
      return modReply(interaction, await tg(guildId, 'common.userNotFound'), await tg(guildId, 'common.userNotInServer'), true);

    const time = ms(duration);
    if (!time || time < 1000 || time > 2419200000)
      return modReply(interaction, await tg(guildId, 'common.invalidDuration'), await tg(guildId, 'moderation.mute.invalidDurationBody'), true);

    if (targetMember.roles.highest.position >= interaction.member.roles.highest.position)
      return modReply(interaction, await tg(guildId, 'moderation.mute.cannotMuteTitle'), await tg(guildId, 'moderation.mute.cannotMuteHigherRole'), true);

    if (!targetMember.moderatable)
      return modReply(interaction, await tg(guildId, 'moderation.mute.cannotMuteTitle'), await tg(guildId, 'moderation.mute.cannotMuteUnmoderatable'), true);

    try {
      await targetMember.timeout(time, reason);
      await modReply(interaction, await tg(guildId, 'moderation.mute.successTitle'),
        await tg(guildId, 'moderation.mute.success', { user: `${targetUser}`, duration: ms(time, { long: true }), moderator: interaction.user.tag, reason }));
    } catch (error) {
      const msg = error.code === 50013 ? await tg(guildId, 'moderation.mute.errorPermission') : await tg(guildId, 'moderation.mute.errorGeneric');
      await modReply(interaction, await tg(guildId, 'common.error'), msg, true);
    }
  },
};
