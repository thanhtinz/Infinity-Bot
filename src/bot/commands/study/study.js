const { SlashCommandBuilder } = require('discord.js');
const ai = require('../../utils/ai');

function buildSystemPrompt(subject) {
    const base =
        'You are Infinity, a patient and encouraging tutor. When a student asks a question, do not just give the ' +
        'bare final answer. Instead: break the concept down step by step, explain the reasoning behind each step, ' +
        'use a concrete example to illustrate the idea, and check the student\'s understanding along the way (for ' +
        'example, by posing a small follow-up question or suggesting how they could verify the answer themselves). ' +
        'Keep a warm, Socratic, pedagogical tone — you are teaching, not just answering. Use clear Discord-friendly ' +
        'formatting (headers, numbered steps, bullet points) to make the explanation easy to follow.';

    if (subject && subject.trim()) {
        return `${base} The student says this question is about "${subject.trim()}" — tailor your explanation, terminology, and examples to that subject.`;
    }

    return base;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('study')
        .setDescription('Get a step-by-step tutoring explanation for a question')
        .addStringOption((o) => o.setName('question').setDescription('What do you need help understanding?').setRequired(true))
        .addStringOption((o) => o.setName('subject').setDescription('Subject area (e.g. math, history, chemistry)').setRequired(false)),

    buildSystemPrompt,

    async execute(interaction) {
        await interaction.deferReply();
        const question = interaction.options.getString('question');
        const subject = interaction.options.getString('subject');

        try {
            const { text } = await ai.chat(interaction.user.id, [{ role: 'user', content: question }], {
                systemPrompt: buildSystemPrompt(subject),
            });
            const chunks = text.match(/[\s\S]{1,1900}/g) || ['(empty response)'];
            await interaction.editReply(chunks[0]);
            for (const chunk of chunks.slice(1)) await interaction.followUp(chunk);
        } catch (error) {
            if (error instanceof ai.NoActiveKeyError) {
                return interaction.editReply('You need to configure an AI API key first — run `/aiconfig setkey` with your Gemini, OpenAI, or Claude key.');
            }
            console.error('study command error:', error);
            await interaction.editReply('Something went wrong talking to the AI provider. Double-check your API key with `/aiconfig status`.');
        }
    },
};
