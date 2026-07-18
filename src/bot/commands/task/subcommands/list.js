const { EmbedBuilder } = require('discord.js');
const { Task } = require('../../../../database/models');

const PRIORITY_EMOJI = { low: '🟢', medium: '🟡', high: '🔴' };

module.exports = {
    name: 'list',
    async execute(interaction) {
        const status = interaction.options.getString('status');
        const where = { userId: interaction.user.id };
        if (status) where.status = status;

        const tasks = await Task.findAll({ where, order: [['createdAt', 'ASC']] });

        if (!tasks.length) {
            return interaction.reply({ content: 'No tasks found.', ephemeral: true });
        }

        const lines = tasks.map((t) => {
            const check = t.status === 'done' ? '✅' : '⬜';
            const due = t.dueDate ? ` — due <t:${Math.floor(new Date(t.dueDate).getTime() / 1000)}:R>` : '';
            const desc = t.description ? `\n> ${t.description}` : '';
            return `${check} **#${t.id}** ${PRIORITY_EMOJI[t.priority] || ''} ${t.title}${due}${desc}`;
        });

        const embed = new EmbedBuilder()
            .setTitle('Your Tasks')
            .setColor(0x5865f2)
            .setDescription(lines.join('\n\n').slice(0, 4000));

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
