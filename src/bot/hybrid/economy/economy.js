
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { tg } = require('../../utils/i18n');
const { reply, requireEconomy, getOrCreateGameSettings, GAMES } = require('../../utils/economyUtils');

function hasPermission(ctx) {
    return ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy')
        .setDescription('Configure this server\'s Infinity Economy game system (admin)')
        .addSubcommand(sub => sub.setName('setup').setDescription('Rename the server currency')
            .addStringOption(o => o.setName('currency_name').setDescription('Currency name, e.g. "Gems"').setRequired(true))
            .addStringOption(o => o.setName('currency_symbol').setDescription('Currency symbol/emoji, e.g. "💎"').setRequired(true)))
        .addSubcommandGroup(group => group.setName('games').setDescription('Enable or disable individual economy games')
            .addSubcommand(sub => sub.setName('enable').setDescription('Enable a game')
                .addStringOption(o => o.setName('game').setDescription('Which game').setRequired(true)
                    .addChoices(...GAMES.map(g => ({ name: g, value: g })))))
            .addSubcommand(sub => sub.setName('disable').setDescription('Disable a game')
                .addStringOption(o => o.setName('game').setDescription('Which game').setRequired(true)
                    .addChoices(...GAMES.map(g => ({ name: g, value: g })))))),

    name: 'economy',
    category: 'economy',

    async execute(interactionOrMessage, args = []) {
        const guild = interactionOrMessage.guild;
        if (!guild) return reply(interactionOrMessage, null, await tg(null, 'economy.common.guildOnly'), true);
        const guildId = guild.id;
        const isSlash = interactionOrMessage.isChatInputCommand?.();

        if (!hasPermission(interactionOrMessage)) {
            return reply(interactionOrMessage, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Server' }), true);
        }

        const config = await requireEconomy(interactionOrMessage, guildId);
        if (!config) return;

        const group = isSlash ? interactionOrMessage.options.getSubcommandGroup(false) : null;
        const subcommand = isSlash ? interactionOrMessage.options.getSubcommand(false) : (args[0] || '').toLowerCase();

        if (!group && subcommand === 'setup') {
            if (!isSlash) return reply(interactionOrMessage, null, 'Please use the slash command `/economy setup` for this action.', true);
            const currencyName = interactionOrMessage.options.getString('currency_name');
            const currencySymbol = interactionOrMessage.options.getString('currency_symbol');
            config.currencyName = currencyName;
            config.currencySymbol = currencySymbol;
            await config.save();
            return reply(interactionOrMessage, await tg(guildId, 'economy.setup.title'), await tg(guildId, 'economy.setup.success', { name: currencyName, symbol: currencySymbol }), true);
        }

        if (group === 'games' && (subcommand === 'enable' || subcommand === 'disable')) {
            if (!isSlash) return reply(interactionOrMessage, null, 'Please use the slash command `/economy games enable|disable` for this action.', true);
            const game = interactionOrMessage.options.getString('game');
            if (!GAMES.includes(game)) return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.games.unknownGame'), true);

            const settings = await getOrCreateGameSettings(guildId, game);
            settings.enabled = subcommand === 'enable';
            await settings.save();

            const key = subcommand === 'enable' ? 'economy.games.enabled' : 'economy.games.disabled';
            return reply(interactionOrMessage, await tg(guildId, 'economy.games.title'), await tg(guildId, key, { game }), true);
        }

        return reply(interactionOrMessage, null, 'Usage: `/economy setup` or `/economy games enable|disable <game>`', true);
    }
};
