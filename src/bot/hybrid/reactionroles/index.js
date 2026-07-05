const { SlashCommandBuilder } = require('discord.js');
const { tg } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionroles')
    .setDescription('Setup and manage reaction roles for your server')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Start the reaction roles setup wizard')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove an existing reaction roles message')
        .addStringOption(option =>
          option
            .setName('message_id')
            .setDescription('The message ID of the reaction roles message')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (subcommand === 'setup') {
      const setupModule = require('./subcommands/setup');
      await setupModule.execute(interaction);
    } else if (subcommand === 'remove') {
      const messageId = interaction.options.getString('message_id');
      const ReactionRoles = require('../../../database/models/ReactionRoles');

      const config = await ReactionRoles.findOne({
        where: { messageId, guildId: interaction.guild.id }
      });

      if (!config) {
        return interaction.reply({
          content: await tg(guildId, 'reactionroles.notFound'),
          flags: 64
        });
      }


      try {
        const channel = interaction.guild.channels.cache.get(config.channelId);
        if (channel) {
          await channel.messages.delete(messageId);
        }
      } catch (error) {
        console.error('Error deleting reaction roles message:', error);
      }


      await ReactionRoles.destroy({
        where: { messageId, guildId: interaction.guild.id }
      });

      return interaction.reply({
        content: `✅ ${await tg(guildId, 'reactionroles.removed')}`,
        flags: 64
      });
    }
  }
};
