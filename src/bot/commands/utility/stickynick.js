


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
    .setName('stickynick')
    .setDescription('Enforce a fixed nickname for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)

    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set a sticky nickname for a member')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The member to apply the sticky nickname to')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('nickname')
            .setDescription('The nickname to enforce')
            .setRequired(true)
            .setMaxLength(32)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove the sticky nickname from a member')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The member to remove the sticky nickname from')
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
        content: 'There was an error executing this stickynick command!',
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
