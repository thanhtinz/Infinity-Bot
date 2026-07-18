const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ChatChannel } = require('../../../database/models');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aichannel')
        .setDescription('Turn this channel into a 24/7 AI chat channel (no /chat needed, just talk)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((sc) => sc.setName('enable').setDescription('Enable AI auto-reply in this channel'))
        .addSubcommand((sc) => sc.setName('disable').setDescription('Disable AI auto-reply in this channel')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'enable') {
            await ChatChannel.findOrCreate({
                where: { channelId: interaction.channelId },
                defaults: { guildId: interaction.guildId, channelId: interaction.channelId, enabledBy: interaction.user.id },
            });
            return interaction.reply('This channel is now a 24/7 AI chat channel — just type normally and I\'ll reply (each person needs their own AI key set via `/aiconfig setkey`).');
        }

        if (sub === 'disable') {
            const deleted = await ChatChannel.destroy({ where: { channelId: interaction.channelId } });
            return interaction.reply(deleted ? 'AI auto-reply disabled for this channel.' : 'This channel didn\'t have AI auto-reply enabled.');
        }
    },
};
