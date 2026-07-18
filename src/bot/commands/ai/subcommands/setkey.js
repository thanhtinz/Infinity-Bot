const { UserAIConfig } = require('../../../../database/models');

module.exports = {
    name: 'setkey',
    async execute(interaction) {
        const provider = interaction.options.getString('provider');
        const key = interaction.options.getString('key');

        await interaction.reply({
            content: `Saved and encrypted your **${provider}** API key. It's private to you and only used for your own AI requests. Switching active provider to **${provider}**.`,
            ephemeral: true,
        });

        await UserAIConfig.setKey(interaction.user.id, provider, key);
    },
};
