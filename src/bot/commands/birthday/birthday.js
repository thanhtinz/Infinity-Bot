


const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

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
    .setName('birthday')
    .setDescription('Manage birthdays and birthday announcements')

    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set your birthday')
        .addIntegerOption(option =>
          option.setName('day')
            .setDescription('Day of the month (1-31)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(31)
        )
        .addIntegerOption(option =>
          option.setName('month')
            .setDescription('Month (1-12)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(12)
        )
        .addIntegerOption(option =>
          option.setName('year')
            .setDescription('Birth year (optional)')
            .setRequired(false)
            .setMinValue(1900)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove your saved birthday')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View a birthday')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to view (defaults to you)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Configure birthday announcements for this server')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to post birthday announcements in')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to give the user on their birthday (removed after 24h)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('message')
            .setDescription('Announcement message with a {user} placeholder')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommandName = interaction.options.getSubcommand();
    const subcommand = subcommands.get(subcommandName);

    if (!subcommand) {
      return interaction.reply({
        content: `Subcommand '${subcommandName}' not found.`,
        ephemeral: true
      });
    }

    try {
      await subcommand.execute(interaction);
    } catch (error) {
      console.error(`Error executing subcommand ${subcommandName}:`, error);
      const errorMessage = {
        content: 'There was an error executing this birthday command!',
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
