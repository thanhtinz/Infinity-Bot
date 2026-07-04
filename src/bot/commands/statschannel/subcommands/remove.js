


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { StatsChannelConfig } = require('../../../../database/models');

function reply(interaction, title, body, ephemeral = true) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'remove',
  description: 'Remove a stats counter channel',

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.');

    const config = await StatsChannelConfig.findOne({ where: { guildId: interaction.guild.id, channelId: channel.id } });
    if (!config)
      return reply(interaction, 'Not Found', 'That channel is not configured as a stats channel.');

    await config.destroy();

    await reply(interaction, 'Stats Channel Removed', `${channel} is no longer a stats channel.`);
  },
};
