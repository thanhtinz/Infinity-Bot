


const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { tg } = require('../../../utils/i18n');

const subcommands = new Map();
const subcommandsPath = path.join(__dirname, 'subcommands');

if (fs.existsSync(subcommandsPath)) {
  const subcommandFiles = fs.readdirSync(subcommandsPath).filter(file => file.endsWith('.js'));

  for (const file of subcommandFiles) {
    const filePath = path.join(subcommandsPath, file);
    const subcommand = require(filePath);
    if (subcommand.name && subcommand.execute) {
      subcommands.set(subcommand.name, subcommand);
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnpunish')
    .setDescription('Configure automatic punishments for warning thresholds')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set the punishment for a warning threshold')
        .addIntegerOption(option =>
          option.setName('warn_count')
            .setDescription('Number of warnings that trigger this punishment')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option.setName('action')
            .setDescription('The punishment to apply')
            .setRequired(true)
            .addChoices(
              { name: 'Mute', value: 'mute' },
              { name: 'Kick', value: 'kick' },
              { name: 'Ban', value: 'ban' },
            )
        )
        .addStringOption(option =>
          option.setName('duration')
            .setDescription('Mute duration (e.g., 1h, 30m, 1d) — required for mute')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List configured warning punishment thresholds')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a warning punishment threshold')
        .addIntegerOption(option =>
          option.setName('warn_count')
            .setDescription('The warning threshold to remove')
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction) {
    const subcommandName = interaction.options.getSubcommand();
    const subcommand = subcommands.get(subcommandName);

    if (!subcommand) {
      return interaction.reply({
        content: await tg(interaction.guildId, 'warnpunish.dispatcher.subcommandNotFound', { name: subcommandName }),
        ephemeral: true
      });
    }

    try {
      await subcommand.execute(interaction);
    } catch (error) {
      console.error(`Error executing subcommand ${subcommandName}:`, error);
      const errorMessage = {
        content: await tg(interaction.guildId, 'warnpunish.dispatcher.executionError'),
        ephemeral: true
      };

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply(errorMessage);
        } else if (interaction.deferred && !interaction.replied) {
          await interaction.editReply(errorMessage);
        }
      } catch (replyError) {
        console.error('Error sending error response:', replyError);
      }
    }
  },
};
