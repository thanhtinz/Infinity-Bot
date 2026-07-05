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
  name: 'slowmode',
  description: 'Set the slowmode for a channel',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Channels' }), true);

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels))
      return modReply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'common.iNeedPermission', { permission: 'Manage Channels' }), true);

    try {
      if (channel.rateLimitPerUser > 0 && seconds > 0) {
        await channel.setRateLimitPerUser(seconds);
        return modReply(interaction, await tg(guildId, 'moderation.slowmode.updatedTitle'),
          await tg(guildId, 'moderation.slowmode.updated', { channel: `${channel}`, seconds, moderator: interaction.user.tag }));
      }

      if (channel.rateLimitPerUser > 0) {
        await channel.setRateLimitPerUser(0);
        return modReply(interaction, await tg(guildId, 'moderation.slowmode.disabledTitle'),
          await tg(guildId, 'moderation.slowmode.disabled', { channel: `${channel}`, moderator: interaction.user.tag }));
      }

      await channel.setRateLimitPerUser(seconds);
      const durationText = seconds === 0
        ? await tg(guildId, 'moderation.slowmode.durationDisabled')
        : await tg(guildId, 'moderation.slowmode.durationSeconds', { seconds });
      await modReply(interaction, await tg(guildId, seconds === 0 ? 'moderation.slowmode.disabledTitle' : 'moderation.slowmode.enabledTitle'),
        await tg(guildId, 'moderation.slowmode.changed', { channel: `${channel}`, durationText, moderator: interaction.user.tag }));
    } catch (error) {
      const msg = error.code === 50013 ? await tg(guildId, 'moderation.slowmode.errorPermission') : await tg(guildId, 'moderation.slowmode.errorGeneric');
      await modReply(interaction, await tg(guildId, 'common.error'), msg, true);
    }
  },
};
