const { Task } = require('../../../../database/models');

module.exports = {
    name: 'remove',
    async execute(interaction) {
        const id = interaction.options.getInteger('id');
        const task = await Task.findOne({ where: { id, userId: interaction.user.id } });
        if (!task) return interaction.reply({ content: `No task with ID ${id} found for you.`, ephemeral: true });
        await task.destroy();
        await interaction.reply({ content: `Removed task #${id}.`, ephemeral: true });
    },
};
