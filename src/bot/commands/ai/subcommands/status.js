const { UserAIConfig } = require('../../../../database/models');

module.exports = {
    name: 'status',
    async execute(interaction) {
        const providers = await UserAIConfig.listConfiguredProviders(interaction.user.id);
        if (!providers.length) {
            return interaction.reply({
                content: 'You have no AI providers configured yet. Use `/aiconfig setkey` to add one (Gemini, OpenAI, or Claude).',
                ephemeral: true,
            });
        }
        const lines = providers.map((p) => `${p.active ? '**●**' : '○'} **${p.provider}** — key ending in \`${p.masked}\`${p.active ? ' (active)' : ''}`);
        await interaction.reply({ content: lines.join('\n'), ephemeral: true });
    },
};
