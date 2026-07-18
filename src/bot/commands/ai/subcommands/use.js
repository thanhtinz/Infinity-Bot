const { UserAIConfig } = require('../../../../database/models');

module.exports = {
    name: 'use',
    async execute(interaction) {
        const provider = interaction.options.getString('provider');
        const ok = await UserAIConfig.setActiveProvider(interaction.user.id, provider);
        if (!ok) {
            return interaction.reply({
                content: `You haven't configured a key for **${provider}** yet. Use \`/aiconfig setkey\` first.`,
                ephemeral: true,
            });
        }
        await interaction.reply({ content: `Active AI provider switched to **${provider}**.`, ephemeral: true });
    },
};
