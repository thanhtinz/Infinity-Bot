const { UserAIConfig } = require('../../../../database/models');

module.exports = {
    name: 'remove',
    async execute(interaction) {
        const provider = interaction.options.getString('provider');
        const ok = await UserAIConfig.removeKey(interaction.user.id, provider);
        await interaction.reply({
            content: ok ? `Removed your **${provider}** API key.` : `You don't have a key saved for **${provider}**.`,
            ephemeral: true,
        });
    },
};
