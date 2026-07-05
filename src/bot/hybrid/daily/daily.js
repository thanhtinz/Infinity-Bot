
const { SlashCommandBuilder } = require('discord.js');
const { tg } = require('../../utils/i18n');
const { reply, requireEconomy, requireGameEnabled, getOrCreateBalance, formatAmount, resolveUserId } = require('../../utils/economyUtils');

const DAY_MS = 24 * 60 * 60 * 1000;
const RESET_MS = 48 * 60 * 60 * 1000;
const STREAK_CAP = 10;

function formatDuration(ms) {
    const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily Infinity Economy reward'),

    name: 'daily',
    category: 'economy',

    async execute(interactionOrMessage) {
        const guild = interactionOrMessage.guild;
        if (!guild) return reply(interactionOrMessage, null, await tg(null, 'economy.common.guildOnly'), true);
        const guildId = guild.id;

        const config = await requireEconomy(interactionOrMessage, guildId);
        if (!config) return;

        const settings = await requireGameEnabled(interactionOrMessage, guildId, 'daily');
        if (!settings) return;

        const userId = resolveUserId(interactionOrMessage);
        const balance = await getOrCreateBalance(guildId, userId, config);

        const now = Date.now();
        const lastDaily = balance.lastDaily ? new Date(balance.lastDaily).getTime() : null;

        if (lastDaily !== null) {
            const elapsed = now - lastDaily;
            if (elapsed < DAY_MS) {
                const remaining = DAY_MS - elapsed;
                return reply(interactionOrMessage, await tg(guildId, 'economy.daily.cooldownTitle'), await tg(guildId, 'economy.daily.cooldownBody', { time: formatDuration(remaining) }), true);
            }
            balance.dailyStreak = elapsed > RESET_MS ? 1 : balance.dailyStreak + 1;
        } else {
            balance.dailyStreak = 1;
        }

        const bonus = config.dailyStreakBonus * Math.min(balance.dailyStreak, STREAK_CAP);
        const amount = config.dailyAmount + bonus;

        balance.wallet += amount;
        balance.lastDaily = new Date(now);
        await balance.save();

        const body = await tg(guildId, 'economy.daily.success', {
            amount: formatAmount(config, amount),
            streak: balance.dailyStreak,
            bonus: formatAmount(config, bonus)
        });
        return reply(interactionOrMessage, await tg(guildId, 'economy.daily.title'), body);
    }
};
