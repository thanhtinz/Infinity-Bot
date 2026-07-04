


const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
    .setName('case')
    .setDescription('View and manage moderation cases')

    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View a moderation case')
        .addIntegerOption(option =>
          option.setName('case_number')
            .setDescription('The case number to view')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit the reason of a moderation case')
        .addIntegerOption(option =>
          option.setName('case_number')
            .setDescription('The case number to edit')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('The new reason')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a moderation case')
        .addIntegerOption(option =>
          option.setName('case_number')
            .setDescription('The case number to delete')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('restore')
        .setDescription('Restore a deleted moderation case')
        .addIntegerOption(option =>
          option.setName('case_number')
            .setDescription('The case number to restore')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('clear')
        .setDescription('Delete all moderation cases for a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to clear cases for')
            .setRequired(true)
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
        content: 'There was an error executing this case command!',
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
