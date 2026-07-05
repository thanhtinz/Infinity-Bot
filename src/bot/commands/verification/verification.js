


const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { tg } = require('../../utils/i18n');

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
    .setName('verification')
    .setDescription('Manage the member verification gate')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Set up the verification gate for this server')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel where the verify panel will be posted')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('verified_role')
            .setDescription('The role given to a member once they verify')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('unverified_role')
            .setDescription('The role given to new members before they verify')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('message')
            .setDescription('Custom text shown on the verify panel')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable the verification gate for this server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('panel')
        .setDescription('Re-post the verify button panel')
    ),

  async execute(interaction) {
    const subcommandName = interaction.options.getSubcommand();
    const subcommand = subcommands.get(subcommandName);

    if (!subcommand) {
      return interaction.reply({
        content: await tg(interaction.guildId, 'verification.dispatcher.subcommandNotFound', { name: subcommandName }),
        ephemeral: true
      });
    }

    try {
      await subcommand.execute(interaction);
    } catch (error) {
      console.error(`Error executing subcommand ${subcommandName}:`, error);
      const errorMessage = {
        content: await tg(interaction.guildId, 'verification.dispatcher.executionError'),
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
