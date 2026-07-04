


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
  name: 'list',
  description: 'List configured stats counter channels',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.');

    const configs = await StatsChannelConfig.findAll({ where: { guildId: interaction.guild.id } });

    if (configs.length === 0)
      return reply(interaction, 'Stats Channels', 'No stats channels are configured for this server.');

    const body = configs.map(c =>
      `<#${c.channelId}> — **${c.type}**${c.roleId ? ` (<@&${c.roleId}>)` : ''}\nTemplate: \`${c.nameTemplate}\``
    ).join('\n\n');

    await reply(interaction, 'Stats Channels', body);
  },
};
