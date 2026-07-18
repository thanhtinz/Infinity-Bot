const { SlashCommandBuilder } = require('discord.js');
const ai = require('../../utils/ai');

function buildSystemPrompt(depth) {
    const disclaimer =
        'Always include a short disclaimer noting that this summary is based on your training knowledge, ' +
        'not live web access, and may not reflect very recent events or developments.';

    if (depth === 'deep') {
        return (
            'You are Infinity, a meticulous research assistant. Given a topic, produce a thorough, well-structured ' +
            'research breakdown using clear Discord-friendly formatting (headers with "**Bold Text**", bullet points, ' +
            'and sub-sections). Cover: key facts, important context and nuance, different perspectives or debates if ' +
            'relevant, and practical implications. Organize the response into logical sub-sections with headers. ' +
            `${disclaimer}`
        );
    }

    return (
        'You are Infinity, a research assistant. Given a topic, produce a tight, well-structured summary using ' +
        'clear Discord-friendly formatting (a short header followed by 3-5 concise bullet points covering the key ' +
        'facts and any important nuance). Keep it brief and focused — this is a quick overview, not a deep dive. ' +
        `${disclaimer}`
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('research')
        .setDescription('Get an AI-generated research summary on a topic')
        .addStringOption((o) => o.setName('topic').setDescription('What do you want to research?').setRequired(true))
        .addStringOption((o) =>
            o.setName('depth').setDescription('How thorough should the summary be?').setRequired(false)
                .addChoices({ name: 'Quick summary', value: 'quick' }, { name: 'Deep dive', value: 'deep' })),

    buildSystemPrompt,

    async execute(interaction) {
        await interaction.deferReply();
        const topic = interaction.options.getString('topic');
        const depth = interaction.options.getString('depth') || 'quick';

        try {
            const { text } = await ai.chat(interaction.user.id, [{ role: 'user', content: topic }], {
                systemPrompt: buildSystemPrompt(depth),
            });
            const chunks = text.match(/[\s\S]{1,1900}/g) || ['(empty response)'];
            await interaction.editReply(chunks[0]);
            for (const chunk of chunks.slice(1)) await interaction.followUp(chunk);
        } catch (error) {
            if (error instanceof ai.NoActiveKeyError) {
                return interaction.editReply('You need to configure an AI API key first — run `/aiconfig setkey` with your Gemini, OpenAI, or Claude key.');
            }
            console.error('research command error:', error);
            await interaction.editReply('Something went wrong talking to the AI provider. Double-check your API key with `/aiconfig status`.');
        }
    },
};
