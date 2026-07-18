const { Reminder } = require('../../../../database/models');

module.exports = {
    name: 'list',
    async execute(interaction) {
        const reminders = await Reminder.findAll({
            where: { userId: interaction.user.id, sent: false },
            order: [['remindAt', 'ASC']],
        });

        if (!reminders.length) {
            return interaction.reply({ content: 'You have no pending reminders.', ephemeral: true });
        }

        const lines = reminders.map((r) => {
            const ts = Math.floor(new Date(r.remindAt).getTime() / 1000);
            return `#${r.id} — <t:${ts}:F> (<t:${ts}:R>): ${r.message}`;
        });

        await interaction.reply({ content: lines.join('\n'), ephemeral: true });
    },
};
