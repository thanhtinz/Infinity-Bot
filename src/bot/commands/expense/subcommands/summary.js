const { fn, col, Op } = require('sequelize');
const { Expense } = require('../../../../database/models');

module.exports = {
    name: 'summary',
    async execute(interaction) {
        const days = interaction.options.getInteger('days') || 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const rows = await Expense.findAll({
            attributes: ['category', [fn('SUM', col('amount')), 'total'], [fn('COUNT', col('id')), 'count']],
            where: { userId: interaction.user.id, spentAt: { [Op.gte]: since } },
            group: ['category'],
            order: [[fn('SUM', col('amount')), 'DESC']],
            raw: true,
        });

        if (!rows.length) {
            return interaction.reply({ content: `No expenses in the last ${days} day(s).`, ephemeral: true });
        }

        const grandTotal = rows.reduce((sum, r) => sum + Number(r.total), 0);
        const lines = rows.map((r) => {
            const label = r.category || '(uncategorized)';
            const pct = grandTotal ? ((Number(r.total) / grandTotal) * 100).toFixed(1) : '0.0';
            const count = Number(r.count);
            return `**${label}**: $${Number(r.total).toFixed(2)} (${count} item${count === 1 ? '' : 's'}, ${pct}%)`;
        });

        await interaction.reply({
            content: `**Expense summary — last ${days} day(s)**\nTotal: **$${grandTotal.toFixed(2)}**\n\n${lines.join('\n')}`,
            ephemeral: true,
        });
    },
};
