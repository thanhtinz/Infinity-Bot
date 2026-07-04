


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { BirthdayConfig } = require('../../../../database/models');

function reply(interaction, title, body, ephemeral = true) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'config',
  description: 'Configure birthday announcements for this server',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.');

    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');
    const message = interaction.options.getString('message');

    if (message && !message.includes('{user}'))
      return reply(interaction, 'Invalid Message', 'Your message must contain a `{user}` placeholder.');

    const [config, created] = await BirthdayConfig.findOrCreate({
      where: { guildId: interaction.guild.id },
      defaults: {
        guildId: interaction.guild.id,
        channelId: channel.id,
        roleId: role ? role.id : null,
        message: message || undefined
      }
    });

    if (!created) {
      config.channelId = channel.id;
      if (role) config.roleId = role.id;
      if (message) config.message = message;
      await config.save();
    }

    await reply(interaction, 'Birthday Config Updated',
      `**Channel:** ${channel}\n**Role:** ${config.roleId ? `<@&${config.roleId}>` : 'None'}\n**Message:** ${config.message}`);
  },
};
