const { Op } = require('sequelize');
const { Expense } = require('../../../../database/models');

module.exports = {
    name: 'list',
    async execute(interaction) {
        const category = interaction.options.getString('category');
        const days = interaction.options.getInteger('days') || 30;

        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const where = { userId: interaction.user.id, spentAt: { [Op.gte]: since } };
        if (category) where.category = category;

        const expenses = await Expense.findAll({ where, order: [['spentAt', 'DESC']], limit: 25 });

        if (!expenses.length) {
            return interaction.reply({
                content: `No expenses found in the last ${days} day(s)${category ? ` for category "${category}"` : ''}.`,
                ephemeral: true,
            });
        }

        const lines = expenses.map((e) => {
            const ts = Math.floor(new Date(e.spentAt).getTime() / 1000);
            return `#${e.id} — $${Number(e.amount).toFixed(2)}${e.category ? ` [${e.category}]` : ''}${e.note ? ` — ${e.note}` : ''} (<t:${ts}:d>)`;
        });

        await interaction.reply({ content: lines.join('\n'), ephemeral: true });
    },
};
