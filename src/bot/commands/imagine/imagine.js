const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const ai = require('../../utils/ai');

const MIME_TO_EXT = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('imagine')
        .setDescription('Generate an image with AI from a text prompt')
        .addStringOption((o) => o.setName('prompt').setDescription('Describe the image you want').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const prompt = interaction.options.getString('prompt');

        try {
            const { buffer, mime } = await ai.generateImage(interaction.user.id, prompt);
            const ext = MIME_TO_EXT[mime] || 'png';
            const attachment = new AttachmentBuilder(buffer, { name: `imagine.${ext}` });
            await interaction.editReply({ content: `**Prompt:** ${prompt}`, files: [attachment] });
        } catch (error) {
            if (error instanceof ai.NoActiveKeyError) {
                return interaction.editReply('You need to configure an AI API key first — run `/aiconfig setkey` with your Gemini, OpenAI, or Claude key.');
            }
            if (error.code === 'NO_IMAGE_SUPPORT') {
                return interaction.editReply(
                    "Your active provider doesn't support image generation (Claude has no image API). Switch providers with `/aiconfig use gemini` or `/aiconfig use openai`, then try again."
                );
            }
            console.error('imagine command error:', error);
            const providerMessage = error.response?.data?.error?.message
                || error.response?.data?.error?.[0]?.message
                || error.message;
            const safeMessage = typeof providerMessage === 'string' && providerMessage.length < 500
                ? providerMessage
                : 'an unknown error occurred';
            await interaction.editReply(`Image generation failed: ${safeMessage}. Double-check your API key with \`/aiconfig status\` or try a different prompt.`);
        }
    },
};
