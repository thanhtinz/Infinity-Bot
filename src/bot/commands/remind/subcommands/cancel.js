const { Reminder } = require('../../../../database/models');

module.exports = {
    name: 'cancel',
    async execute(interaction) {
        const id = interaction.options.getInteger('id');
        const reminder = await Reminder.findOne({ where: { id, userId: interaction.user.id, sent: false } });
        if (!reminder) {
            return interaction.reply({ content: `No pending reminder with ID ${id} found for you.`, ephemeral: true });
        }
        await reminder.destroy();
        await interaction.reply({ content: `Cancelled reminder #${id}.`, ephemeral: true });
    },
};
