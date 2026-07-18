const { SlashCommandBuilder } = require('discord.js');
const ai = require('../../utils/ai');

function buildSystemPrompt(language) {
    const base =
        'You are Infinity, a senior web developer. Given a description of something the user wants to build, produce ' +
        'working, modern, idiomatic code that accomplishes it. The code is the main deliverable, so prioritize a ' +
        'complete, correct, copy-pasteable snippet over lengthy prose. Wrap all code in proper Markdown fenced code ' +
        'blocks with the correct language tag (for example ```html, ```css, ```javascript, or ```jsx) so Discord ' +
        'syntax highlighting works. Follow the code with a brief explanation (a few sentences or short bullet points) ' +
        'covering how it works and any setup notes — keep the explanation concise.';

    if (language && language.trim()) {
        return `${base} The user specified the language/framework as "${language.trim()}" — write the solution in that language/framework and tag the code block accordingly.`;
    }

    return `${base} The user did not specify a language/framework — infer the most appropriate one from the description and tag the code block accordingly.`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('webhelp')
        .setDescription('Get AI-generated web development code and a brief explanation')
        .addStringOption((o) => o.setName('description').setDescription('Describe what you want to build').setRequired(true))
        .addStringOption((o) =>
            o.setName('language').setDescription('Language/framework to use (default: let the AI infer)').setRequired(false)
                .addChoices(
                    { name: 'HTML', value: 'html' },
                    { name: 'CSS', value: 'css' },
                    { name: 'JavaScript', value: 'javascript' },
                    { name: 'React', value: 'react' },
                )),

    buildSystemPrompt,

    async execute(interaction) {
        await interaction.deferReply();
        const description = interaction.options.getString('description');
        const language = interaction.options.getString('language');

        try {
            const { text } = await ai.chat(interaction.user.id, [{ role: 'user', content: description }], {
                systemPrompt: buildSystemPrompt(language),
            });
            const chunks = text.match(/[\s\S]{1,1900}/g) || ['(empty response)'];
            await interaction.editReply(chunks[0]);
            for (const chunk of chunks.slice(1)) await interaction.followUp(chunk);
        } catch (error) {
            if (error instanceof ai.NoActiveKeyError) {
                return interaction.editReply('You need to configure an AI API key first — run `/aiconfig setkey` with your Gemini, OpenAI, or Claude key.');
            }
            console.error('webhelp command error:', error);
            await interaction.editReply('Something went wrong talking to the AI provider. Double-check your API key with `/aiconfig status`.');
        }
    },
};
