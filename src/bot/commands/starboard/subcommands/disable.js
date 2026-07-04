


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
  name: 'disable',
  description: 'Disable the starboard',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.');

    const config = await StarboardConfig.findOne({ where: { guildId: interaction.guild.id } });

    if (!config || !config.enabled)
      return reply(interaction, 'Not Enabled', 'The starboard is not currently enabled for this server.');

    config.enabled = false;
    await config.save();

    await reply(interaction, 'Starboard Disabled', 'The starboard has been disabled.');
  },
};
