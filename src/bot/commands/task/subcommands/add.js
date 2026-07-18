const ms = require('ms');
const { Task } = require('../../../../database/models');

function parseDueDate(input) {
    if (!input) return null;
    const relative = ms(input.trim());
    if (typeof relative === 'number' && relative > 0) {
        return new Date(Date.now() + relative);
    }
    const date = new Date(input);
    if (!Number.isNaN(date.getTime())) return date;
    return undefined; // signals unparseable
}

module.exports = {
    name: 'add',
    async execute(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const dueDateInput = interaction.options.getString('due_date');
        const priority = interaction.options.getString('priority') || 'medium';

        let dueDate = null;
        if (dueDateInput) {
            dueDate = parseDueDate(dueDateInput);
            if (dueDate === undefined) {
                return interaction.reply({
                    content: `I couldn't parse due date "${dueDateInput}". Try a duration like \`2d\` or a date like \`2026-08-01\`.`,
                    ephemeral: true,
                });
            }
        }

        const task = await Task.create({
            userId: interaction.user.id,
            title,
            description: description || null,
            dueDate,
            priority,
        });

        const dueSuffix = dueDate ? ` (due <t:${Math.floor(dueDate.getTime() / 1000)}:R>)` : '';
        await interaction.reply({ content: `Task #${task.id} created: **${title}**${dueSuffix}`, ephemeral: true });
    },
};
