const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const subcommands = new Map();
const subcommandsPath = path.join(__dirname, 'subcommands');
for (const file of fs.readdirSync(subcommandsPath).filter((f) => f.endsWith('.js'))) {
    const subcommand = require(path.join(subcommandsPath, file));
    if (subcommand.name && subcommand.execute) subcommands.set(subcommand.name, subcommand);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aiconfig')
        .setDescription('Configure your own AI provider API key (Gemini, OpenAI, Claude)')
        .addSubcommand((sc) =>
            sc.setName('setkey')
                .setDescription('Save an API key for a provider (only you can see/use it)')
                .addStringOption((o) =>
                    o.setName('provider').setDescription('AI provider').setRequired(true)
                        .addChoices({ name: 'Gemini', value: 'gemini' }, { name: 'OpenAI', value: 'openai' }, { name: 'Claude', value: 'claude' }))
                .addStringOption((o) => o.setName('key').setDescription('Your API key').setRequired(true)))
        .addSubcommand((sc) =>
            sc.setName('use')
                .setDescription('Switch which configured provider is active for you')
                .addStringOption((o) =>
                    o.setName('provider').setDescription('AI provider').setRequired(true)
                        .addChoices({ name: 'Gemini', value: 'gemini' }, { name: 'OpenAI', value: 'openai' }, { name: 'Claude', value: 'claude' })))
        .addSubcommand((sc) =>
            sc.setName('remove')
                .setDescription('Remove a saved API key')
                .addStringOption((o) =>
                    o.setName('provider').setDescription('AI provider').setRequired(true)
                        .addChoices({ name: 'Gemini', value: 'gemini' }, { name: 'OpenAI', value: 'openai' }, { name: 'Claude', value: 'claude' })))
        .addSubcommand((sc) => sc.setName('status').setDescription('Show your configured providers')),

    async execute(interaction) {
        const subcommand = subcommands.get(interaction.options.getSubcommand());
        if (!subcommand) return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        try {
            await subcommand.execute(interaction);
        } catch (error) {
            console.error('aiconfig error:', error);
            const payload = { content: 'Something went wrong running that command.', ephemeral: true };
            if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
            else await interaction.reply(payload);
        }
    },
};
