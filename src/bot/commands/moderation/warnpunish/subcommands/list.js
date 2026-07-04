


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { WarnPunishConfig } = require('../../../../../database/models');

function modReply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'list',
  description: 'List configured warning punishment thresholds',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return modReply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.', true);

    const configs = await WarnPunishConfig.findAll({
      where: { guildId: interaction.guild.id },
      order: [['warnCount', 'ASC']]
    });

    if (configs.length === 0)
      return modReply(interaction, 'Warn Punishments', 'No warning punishment thresholds are configured for this server.');

    const body = configs.map(c =>
      `**${c.warnCount}** warning(s) → **${c.action}**${c.action === 'mute' && c.duration ? ` (${c.duration})` : ''}`
    ).join('\n');

    await modReply(interaction, 'Warn Punishments', body);
  },
};
