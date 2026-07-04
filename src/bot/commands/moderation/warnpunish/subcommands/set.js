


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const ms = require('ms');
const { WarnPunishConfig } = require('../../../../../database/models');

function modReply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'set',
  description: 'Set the punishment for a warning threshold',

  async execute(interaction) {
    const warnCount = interaction.options.getInteger('warn_count');
    const action = interaction.options.getString('action');
    const duration = interaction.options.getString('duration');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return modReply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.', true);

    if (action === 'mute') {
      const time = duration ? ms(duration) : null;
      if (!time || time < 1000 || time > 2419200000)
        return modReply(interaction, 'Invalid Duration', 'Provide a valid duration for mute (e.g., 1h, 30m, 1d). Maximum is 28 days.', true);
    }

    const [config, created] = await WarnPunishConfig.findOrCreate({
      where: { guildId: interaction.guild.id, warnCount },
      defaults: {
        guildId: interaction.guild.id,
        warnCount,
        action,
        duration: action === 'mute' ? duration : null
      }
    });

    if (!created) {
      config.action = action;
      config.duration = action === 'mute' ? duration : null;
      await config.save();
    }

    await modReply(interaction, 'Threshold Saved',
      `Reaching **${warnCount}** warning(s) will now trigger **${action}**` +
      (action === 'mute' ? ` for **${duration}**.` : '.'));
  },
};
