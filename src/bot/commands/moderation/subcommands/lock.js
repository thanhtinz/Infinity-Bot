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
  name: 'lock',
  description: 'Prevent messages in a channel',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || await tg(guildId, 'common.noReasonProvided');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Channels' }), true);

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels))
      return modReply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'common.iNeedPermission', { permission: 'Manage Channels' }), true);

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, { reason });
      await modReply(interaction, await tg(guildId, 'moderation.lock.successTitle'),
        await tg(guildId, 'moderation.lock.success', { channel: `${channel}`, moderator: interaction.user.tag, reason }));
    } catch (error) {
      const msg = error.code === 50013 ? await tg(guildId, 'moderation.lock.errorPermission') : await tg(guildId, 'moderation.lock.errorGeneric');
      await modReply(interaction, await tg(guildId, 'common.error'), msg, true);
    }
  },
};
