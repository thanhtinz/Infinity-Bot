


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
  name: 'remove',
  description: 'Remove a warning punishment threshold',

  async execute(interaction) {
    const warnCount = interaction.options.getInteger('warn_count');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return modReply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.', true);

    const deletedCount = await WarnPunishConfig.destroy({
      where: { guildId: interaction.guild.id, warnCount }
    });

    if (deletedCount === 0)
      return modReply(interaction, 'Not Found', `No punishment threshold configured for **${warnCount}** warning(s).`, true);

    await modReply(interaction, 'Threshold Removed', `Removed the punishment threshold for **${warnCount}** warning(s).`);
  },
};
