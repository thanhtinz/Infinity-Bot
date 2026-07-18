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
        .setName('expense')
        .setDescription('Track your personal expenses')
        .addSubcommand((sc) =>
            sc.setName('add')
                .setDescription('Log an expense')
                .addNumberOption((o) => o.setName('amount').setDescription('Amount spent').setRequired(true).setMinValue(0))
                .addStringOption((o) =>
                    o.setName('category').setDescription('e.g. "food", "transport" — auto-suggested from note if you have an AI key and omit this').setRequired(false))
                .addStringOption((o) => o.setName('note').setDescription('Optional note').setRequired(false)))
        .addSubcommand((sc) =>
            sc.setName('list')
                .setDescription('List recent expenses')
                .addStringOption((o) => o.setName('category').setDescription('Filter by category').setRequired(false))
                .addIntegerOption((o) => o.setName('days').setDescription('Look back this many days (default 30)').setRequired(false).setMinValue(1)))
        .addSubcommand((sc) =>
            sc.setName('summary')
                .setDescription('Total + per-category breakdown')
                .addIntegerOption((o) => o.setName('days').setDescription('Look back this many days (default 30)').setRequired(false).setMinValue(1))),

    async execute(interaction) {
        const subcommand = subcommands.get(interaction.options.getSubcommand());
        if (!subcommand) return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        try {
            await subcommand.execute(interaction);
        } catch (error) {
            console.error('expense error:', error);
            const payload = { content: 'Something went wrong running that command.', ephemeral: true };
            if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
            else await interaction.reply(payload);
        }
    },
};
