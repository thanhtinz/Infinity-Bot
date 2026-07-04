


const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
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
    .setName('statschannel')
    .setDescription('Manage voice channels that auto-update to show live server stats')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a stats counter channel')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('What to count')
            .setRequired(true)
            .addChoices(
              { name: 'Members', value: 'members' },
              { name: 'Humans', value: 'humans' },
              { name: 'Bots', value: 'bots' },
              { name: 'Boosts', value: 'boosts' },
              { name: 'Role Count', value: 'roleCount' },
            )
        )
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The voice channel to rename with the live count')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        )
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to count (required for Role Count type)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('template')
            .setDescription('Channel name template with a {count} placeholder')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a stats counter channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The stats channel to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List configured stats counter channels')
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
        content: 'There was an error executing this statschannel command!',
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
