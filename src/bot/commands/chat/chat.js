const { SlashCommandBuilder } = require('discord.js');
const ai = require('../../utils/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Ask the AI assistant something')
        .addStringOption((o) => o.setName('message').setDescription('What do you want to ask?').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const message = interaction.options.getString('message');

        try {
            const { text } = await ai.chat(interaction.user.id, [{ role: 'user', content: message }], {
                systemPrompt: 'You are Infinity, a helpful, concise Discord AI assistant.',
            });
            const chunks = text.match(/[\s\S]{1,1900}/g) || ['(empty response)'];
            await interaction.editReply(chunks[0]);
            for (const chunk of chunks.slice(1)) await interaction.followUp(chunk);
        } catch (error) {
            if (error instanceof ai.NoActiveKeyError) {
                return interaction.editReply('You need to configure an AI API key first — run `/aiconfig setkey` with your Gemini, OpenAI, or Claude key.');
            }
            console.error('chat command error:', error);
            await interaction.editReply('Something went wrong talking to the AI provider. Double-check your API key with `/aiconfig status`.');
        }
    },
};
