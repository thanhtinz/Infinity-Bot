
const { SlashCommandBuilder } = require('discord.js');
const { tg } = require('../../utils/i18n');
const { reply, requireEconomy } = require('../../utils/economyUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('store')
        .setDescription('Browse and buy items from this server\'s Infinity Economy store (in-game currency, not real money)')
        .addSubcommand(sub => sub.setName('browse').setDescription('Browse available store items'))
        .addSubcommand(sub => sub.setName('buy')
            .setDescription('Buy a store item')
            .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('inventory').setDescription('View your store inventory'))
        .addSubcommandGroup(group => group.setName('item').setDescription('Manage store items (admin)')
            .addSubcommand(sub => sub.setName('add').setDescription('Add a store item')
                .addStringOption(o => o.setName('name').setDescription('Item name').setRequired(true))
                .addIntegerOption(o => o.setName('price').setDescription('Price in server currency').setRequired(true).setMinValue(0))
                .addStringOption(o => o.setName('description').setDescription('Item description'))
                .addRoleOption(o => o.setName('role').setDescription('Role to grant on purchase'))
                .addIntegerOption(o => o.setName('role_duration_seconds').setDescription('If set, the role is removed after this many seconds').setMinValue(1))
                .addIntegerOption(o => o.setName('stock').setDescription('Stock count (omit for unlimited)').setMinValue(0)))
            .addSubcommand(sub => sub.setName('edit').setDescription('Edit a store item')
                .addStringOption(o => o.setName('name').setDescription('Item name').setRequired(true).setAutocomplete(true))
                .addIntegerOption(o => o.setName('price').setDescription('New price').setMinValue(0))
                .addIntegerOption(o => o.setName('stock').setDescription('New stock count').setMinValue(0))
                .addBooleanOption(o => o.setName('active').setDescription('Whether the item is purchasable')))
            .addSubcommand(sub => sub.setName('remove').setDescription('Remove a store item')
                .addStringOption(o => o.setName('name').setDescription('Item name').setRequired(true).setAutocomplete(true)))
            .addSubcommand(sub => sub.setName('list').setDescription('List all store items (admin view, includes inactive)'))),

    name: 'store',
    category: 'economy',

    async execute(interactionOrMessage, args = []) {
        const guild = interactionOrMessage.guild;
        if (!guild) return reply(interactionOrMessage, null, await tg(null, 'economy.common.guildOnly'), true);
        const guildId = guild.id;
        const isSlash = interactionOrMessage.isChatInputCommand?.();

        const config = await requireEconomy(interactionOrMessage, guildId);
        if (!config) return;

        const group = isSlash ? interactionOrMessage.options.getSubcommandGroup(false) : null;
        const subcommand = isSlash ? interactionOrMessage.options.getSubcommand(false) : (args[0] || '').toLowerCase();

        const target = group || subcommand;
        const validTargets = ['browse', 'buy', 'inventory', 'item'];
        if (!target || !validTargets.includes(target)) {
            return reply(interactionOrMessage, null, 'Usage: `/store browse|buy|inventory` or `/store item <add|edit|remove|list>`', true);
        }

        const subcommandFile = require(`./subcommands/${target}`);
        return subcommandFile.execute(interactionOrMessage, args.slice(1), config);
    },

    async autocomplete(interaction) {
        const guildId = interaction.guildId;
        if (!guildId) return interaction.respond([]);
        try {
            const { EconomyItem } = require('../../../database/models');
            const focused = interaction.options.getFocused(true);
            // `/store buy` should only suggest purchasable items; the admin `/store item edit|remove`
            // subcommands need to be able to find inactive ones too.
            const subcommand = interaction.options.getSubcommand(false);
            const where = subcommand === 'buy' ? { guildId, active: true } : { guildId };
            const rows = await EconomyItem.findAll({ where, order: [['name', 'ASC']], limit: 50 });
            const filtered = rows.filter((r) => r.name.toLowerCase().includes(String(focused.value || '').toLowerCase()));
            return interaction.respond(filtered.slice(0, 25).map((r) => ({ name: r.name, value: r.name })));
        } catch {
            return interaction.respond([]).catch(() => {});
        }
    }
};
