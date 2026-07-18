const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const subcommands = new Map();
const subcommandsPath = path.join(__dirname, 'subcommands');
for (const file of fs.readdirSync(subcommandsPath).filter((f) => f.endsWith('.js'))) {
    const subcommand = require(path.join(subcommandsPath, file));
    if (subcommand.name && subcommand.execute) subcommands.set(subcommand.name, subcommand);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Set and manage personal reminders')
        .addSubcommand((sc) =>
            sc.setName('add')
                .setDescription('Add a reminder')
                .addStringOption((o) =>
                    o.setName('when')
                        .setDescription('e.g. "30m", "2h", "1d" — or natural text like "tomorrow at 9am" if you have an AI key set')
                        .setRequired(true))
                .addStringOption((o) => o.setName('message').setDescription('What to remind you about').setRequired(true)))
        .addSubcommand((sc) => sc.setName('list').setDescription('List your pending reminders'))
        .addSubcommand((sc) =>
            sc.setName('cancel')
                .setDescription('Cancel a pending reminder')
                .addIntegerOption((o) => o.setName('id').setDescription('Reminder ID').setRequired(true))),

    async execute(interaction) {
        const subcommand = subcommands.get(interaction.options.getSubcommand());
        if (!subcommand) return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        try {
            await subcommand.execute(interaction);
        } catch (error) {
            console.error('remind error:', error);
            const payload = { content: 'Something went wrong running that command.', ephemeral: true };
            if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
            else await interaction.reply(payload);
        }
    },
};
