const { Reminder } = require('../../../../database/models');
const { parseWhen } = require('../../../utils/parseReminderTime');

module.exports = {
    name: 'add',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const when = interaction.options.getString('when');
        const message = interaction.options.getString('message');

        const result = await parseWhen(interaction.user.id, when);

        if (!result.date) {
            if (result.error === 'no_ai_key') {
                return interaction.editReply(
                    `I couldn't parse "${when}" as a duration like \`30m\`, \`2h\`, or \`1d\`. Configure an AI key with \`/aiconfig setkey\` to also use natural phrases like "tomorrow at 9am".`
                );
            }
            return interaction.editReply(`I couldn't figure out when "${when}" means. Try a duration like \`30m\`, \`2h\`, \`1d\`, or a clearer phrase.`);
        }

        const reminder = await Reminder.create({
            userId: interaction.user.id,
            channelId: interaction.channelId,
            message,
            remindAt: result.date,
        });

        const ts = Math.floor(result.date.getTime() / 1000);
        await interaction.editReply(`Reminder #${reminder.id} set for <t:${ts}:F> (<t:${ts}:R>): ${message}`);
    },
};
