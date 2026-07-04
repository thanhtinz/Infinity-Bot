


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { StarboardConfig } = require('../../../../database/models');

function reply(interaction, title, body, ephemeral = true) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'setup',
  description: 'Enable and configure the starboard',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.');

    const channel = interaction.options.getChannel('channel');
    const emoji = interaction.options.getString('emoji') || '⭐';
    const threshold = interaction.options.getInteger('threshold') || 3;

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.SendMessages))
      return reply(interaction, 'Missing Permissions', 'I need permission to send messages in the starboard channel.');

    const [config, created] = await StarboardConfig.findOrCreate({
      where: { guildId: interaction.guild.id },
      defaults: { guildId: interaction.guild.id, channelId: channel.id, emoji, threshold, enabled: true }
    });

    if (!created) {
      config.channelId = channel.id;
      config.emoji = emoji;
      config.threshold = threshold;
      config.enabled = true;
      await config.save();
    }

    await reply(interaction, 'Starboard Enabled',
      `**Channel:** ${channel}\n**Emoji:** ${emoji}\n**Threshold:** ${threshold} reaction(s)`);
  },
};
