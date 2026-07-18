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
        .setName('task')
        .setDescription('Manage your personal task list')
        .addSubcommand((sc) =>
            sc.setName('add')
                .setDescription('Add a task')
                .addStringOption((o) => o.setName('title').setDescription('Task title').setRequired(true))
                .addStringOption((o) => o.setName('description').setDescription('Extra details').setRequired(false))
                .addStringOption((o) => o.setName('due_date').setDescription('e.g. "2d", "1w", or "2026-08-01"').setRequired(false))
                .addStringOption((o) =>
                    o.setName('priority').setDescription('Priority').setRequired(false)
                        .addChoices({ name: 'Low', value: 'low' }, { name: 'Medium', value: 'medium' }, { name: 'High', value: 'high' })))
        .addSubcommand((sc) =>
            sc.setName('list')
                .setDescription('List your tasks')
                .addStringOption((o) =>
                    o.setName('status').setDescription('Filter by status').setRequired(false)
                        .addChoices({ name: 'Pending', value: 'pending' }, { name: 'Done', value: 'done' })))
        .addSubcommand((sc) =>
            sc.setName('complete')
                .setDescription('Mark a task as done')
                .addIntegerOption((o) => o.setName('id').setDescription('Task ID').setRequired(true)))
        .addSubcommand((sc) =>
            sc.setName('remove')
                .setDescription('Remove a task')
                .addIntegerOption((o) => o.setName('id').setDescription('Task ID').setRequired(true))),

    async execute(interaction) {
        const subcommand = subcommands.get(interaction.options.getSubcommand());
        if (!subcommand) return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        try {
            await subcommand.execute(interaction);
        } catch (error) {
            console.error('task error:', error);
            const payload = { content: 'Something went wrong running that command.', ephemeral: true };
            if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
            else await interaction.reply(payload);
        }
    },
};
