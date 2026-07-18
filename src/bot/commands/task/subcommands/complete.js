const { Task } = require('../../../../database/models');

module.exports = {
    name: 'complete',
    async execute(interaction) {
        const id = interaction.options.getInteger('id');
        const task = await Task.findOne({ where: { id, userId: interaction.user.id } });
        if (!task) return interaction.reply({ content: `No task with ID ${id} found for you.`, ephemeral: true });
        task.status = 'done';
        await task.save();
        await interaction.reply({ content: `Marked task #${id} as done: **${task.title}**`, ephemeral: true });
    },
};
