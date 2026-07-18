const { Expense } = require('../../../../database/models');
const ai = require('../../../utils/ai');

module.exports = {
    name: 'add',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const amount = interaction.options.getNumber('amount');
        let category = interaction.options.getString('category');
        const note = interaction.options.getString('note');

        if (!category && note) {
            // Best-effort AI category inference — never fail the command if this doesn't work.
            try {
                const { text } = await ai.chat(
                    interaction.user.id,
                    [
                        {
                            role: 'user',
                            content: `Suggest a single short lowercase category word (like "food", "transport", "entertainment", "shopping", "bills", "health") for this expense note: "${note}". Respond with ONLY the category word.`,
                        },
                    ],
                    { systemPrompt: 'You categorize personal expenses. Respond with a single lowercase word only.' }
                );
                if (text) {
                    const cleaned = text.trim().split(/\s+/)[0].replace(/[^a-z0-9_-]/gi, '').toLowerCase();
                    if (cleaned) category = cleaned;
                }
            } catch (error) {
                // No AI key configured, or the provider call failed — leave category null.
            }
        }

        const expense = await Expense.create({
            userId: interaction.user.id,
            amount,
            category: category || null,
            note: note || null,
        });

        await interaction.editReply(
            `Logged expense #${expense.id}: **$${Number(amount).toFixed(2)}**${category ? ` (${category})` : ''}${note ? ` — ${note}` : ''}`
        );
    },
};
