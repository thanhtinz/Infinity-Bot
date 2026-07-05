
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Browse and purchase products from this server\'s shop')
        .addSubcommand(sub => sub.setName('browse').setDescription('Browse available products'))
        .addSubcommand(sub => sub.setName('buy')
            .setDescription('Purchase a product')
            .addStringOption(o => o.setName('product').setDescription('Product name').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('orders').setDescription('View your order history'))
        .addSubcommand(sub => sub.setName('redeem')
            .setDescription('Check whether a coupon code is valid')
            .addStringOption(o => o.setName('code').setDescription('Coupon code').setRequired(true)))
        .addSubcommandGroup(group => group.setName('category').setDescription('Manage shop categories (admin)')
            .addSubcommand(sub => sub.setName('add').setDescription('Add a category')
                .addStringOption(o => o.setName('name').setDescription('Category name').setRequired(true))
                .addStringOption(o => o.setName('description').setDescription('Category description'))
                .addIntegerOption(o => o.setName('position').setDescription('Sort position (lower shows first)')))
            .addSubcommand(sub => sub.setName('remove').setDescription('Remove a category')
                .addStringOption(o => o.setName('name').setDescription('Category name').setRequired(true).setAutocomplete(true)))
            .addSubcommand(sub => sub.setName('list').setDescription('List all categories')))
        .addSubcommandGroup(group => group.setName('product').setDescription('Manage shop products (admin)')
            .addSubcommand(sub => sub.setName('add').setDescription('Add a product')
                .addStringOption(o => o.setName('name').setDescription('Product name').setRequired(true))
                .addStringOption(o => o.setName('description').setDescription('Product description'))
                .addStringOption(o => o.setName('category').setDescription('Category name').setAutocomplete(true))
                .addIntegerOption(o => o.setName('price_vnd').setDescription('Price in VND (for PayOS)').setMinValue(0))
                .addNumberOption(o => o.setName('price_usd').setDescription('Price in USD (for PayPal/crypto)').setMinValue(0))
                .addRoleOption(o => o.setName('role').setDescription('Role to grant on purchase'))
                .addIntegerOption(o => o.setName('stock').setDescription('Stock count (omit for unlimited)').setMinValue(0))
                .addStringOption(o => o.setName('image_url').setDescription('Image URL shown when browsing'))
                .addBooleanOption(o => o.setName('unlocks_economy').setDescription('Purchasing this product unlocks the Infinity Economy game system for this server')))
            .addSubcommand(sub => sub.setName('edit').setDescription('Edit a product')
                .addStringOption(o => o.setName('name').setDescription('Product name').setRequired(true).setAutocomplete(true))
                .addIntegerOption(o => o.setName('price_vnd').setDescription('New price in VND').setMinValue(0))
                .addNumberOption(o => o.setName('price_usd').setDescription('New price in USD').setMinValue(0))
                .addIntegerOption(o => o.setName('stock').setDescription('New stock count').setMinValue(0))
                .addBooleanOption(o => o.setName('active').setDescription('Whether the product is purchasable'))
                .addBooleanOption(o => o.setName('unlocks_economy').setDescription('Purchasing this product unlocks the Infinity Economy game system for this server')))
            .addSubcommand(sub => sub.setName('remove').setDescription('Remove a product')
                .addStringOption(o => o.setName('name').setDescription('Product name').setRequired(true).setAutocomplete(true)))
            .addSubcommand(sub => sub.setName('list').setDescription('List all products')))
        .addSubcommandGroup(group => group.setName('coupon').setDescription('Manage shop coupons (admin)')
            .addSubcommand(sub => sub.setName('add').setDescription('Add a coupon')
                .addStringOption(o => o.setName('code').setDescription('Coupon code').setRequired(true))
                .addStringOption(o => o.setName('type').setDescription('Discount type').setRequired(true)
                    .addChoices({ name: 'Percent', value: 'percent' }, { name: 'Fixed amount', value: 'fixed' }))
                .addNumberOption(o => o.setName('value').setDescription('Discount value (percent 0-100, or fixed amount)').setRequired(true).setMinValue(0))
                .addIntegerOption(o => o.setName('max_uses').setDescription('Maximum total uses (omit for unlimited)').setMinValue(1))
                .addIntegerOption(o => o.setName('expires_days').setDescription('Expires this many days from now (omit for never)').setMinValue(1)))
            .addSubcommand(sub => sub.setName('remove').setDescription('Remove a coupon')
                .addStringOption(o => o.setName('code').setDescription('Coupon code').setRequired(true)))
            .addSubcommand(sub => sub.setName('list').setDescription('List all coupons')))
        .addSubcommandGroup(group => group.setName('flashsale').setDescription('Manage flash sales (admin)')
            .addSubcommand(sub => sub.setName('add').setDescription('Add a flash sale')
                .addStringOption(o => o.setName('product').setDescription('Product name').setRequired(true).setAutocomplete(true))
                .addNumberOption(o => o.setName('discount_percent').setDescription('Discount percent').setRequired(true).setMinValue(1).setMaxValue(100))
                .addIntegerOption(o => o.setName('duration_hours').setDescription('How many hours the sale runs for').setRequired(true).setMinValue(1)))
            .addSubcommand(sub => sub.setName('remove').setDescription('Remove a flash sale')
                .addIntegerOption(o => o.setName('id').setDescription('Flash sale ID (see /shop flashsale list)').setRequired(true)))
            .addSubcommand(sub => sub.setName('list').setDescription('List all flash sales'))),

    name: 'shop',
    category: 'economy',

    async execute(interactionOrMessage, args = []) {
        const isSlash = interactionOrMessage.isChatInputCommand?.();
        const group = isSlash ? interactionOrMessage.options.getSubcommandGroup(false) : null;
        const subcommand = isSlash ? interactionOrMessage.options.getSubcommand(false) : (args[0] || '').toLowerCase();

        const target = group || subcommand;
        const validTargets = ['browse', 'buy', 'orders', 'redeem', 'category', 'product', 'coupon', 'flashsale'];
        if (!target || !validTargets.includes(target)) {
            return interactionOrMessage.reply({ content: 'Usage: `/shop browse|buy|orders|redeem` or `/shop category|product|coupon|flashsale <add|remove|list>`', ephemeral: true });
        }

        const subcommandFile = require(`./subcommands/${target}`);
        return subcommandFile.execute(interactionOrMessage, args.slice(1));
    },

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const guildId = interaction.guildId;
        if (!guildId) return interaction.respond([]);

        try {
            const { ShopProduct, ShopCategory } = require('../../../database/models');

            if (focused.name === 'category') {
                const rows = await ShopCategory.findAll({ where: { guildId }, order: [['position', 'ASC']], limit: 25 });
                const filtered = rows.filter(r => r.name.toLowerCase().includes(String(focused.value || '').toLowerCase()));
                return interaction.respond(filtered.slice(0, 25).map(r => ({ name: r.name, value: r.name })));
            }

            // 'product' and 'name' (product add/edit/remove, buy, flashsale add) all resolve against ShopProduct
            const rows = await ShopProduct.findAll({ where: { guildId }, order: [['name', 'ASC']], limit: 50 });
            const filtered = rows.filter(r => r.name.toLowerCase().includes(String(focused.value || '').toLowerCase()));
            return interaction.respond(filtered.slice(0, 25).map(r => ({ name: r.name, value: r.name })));
        } catch {
            return interaction.respond([]).catch(() => {});
        }
    }
};
