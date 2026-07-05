
const { SlashCommandBuilder } = require('discord.js');
const { tg } = require('../../utils/i18n');
const { reply, requireEconomy, requireGameEnabled, getOrCreateBalance, formatAmount, resolveUserId } = require('../../utils/economyUtils');

const MIN_VICTIM_WALLET = 10;

function formatDuration(ms) {
    const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to rob coins from someone else\'s WALLET (never their bank)')
        .addUserOption(o => o.setName('user').setDescription('Who to rob').setRequired(true)),

    name: 'rob',
    category: 'economy',

    async execute(interactionOrMessage) {
        const guild = interactionOrMessage.guild;
        if (!guild) return reply(interactionOrMessage, null, await tg(null, 'economy.common.guildOnly'), true);
        const guildId = guild.id;
        const isSlash = interactionOrMessage.isChatInputCommand?.();

        const config = await requireEconomy(interactionOrMessage, guildId);
        if (!config) return;

        const settings = await requireGameEnabled(interactionOrMessage, guildId, 'rob');
        if (!settings) return;

        const robberId = resolveUserId(interactionOrMessage);
        const targetUser = isSlash ? interactionOrMessage.options.getUser('user') : interactionOrMessage.mentions?.users?.first();
        if (!targetUser) return reply(interactionOrMessage, await tg(guildId, 'common.userNotFound'), await tg(guildId, 'economy.rob.noTarget'), true);

        if (targetUser.id === robberId) {
            return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.rob.cannotRobSelf'), true);
        }
        if (targetUser.bot) {
            return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.rob.cannotRobBot'), true);
        }

        const robber = await getOrCreateBalance(guildId, robberId, config);

        const now = Date.now();
        if (robber.lastRob) {
            const elapsed = now - new Date(robber.lastRob).getTime();
            const cooldownMs = config.robCooldownMinutes * 60000;
            if (elapsed < cooldownMs) {
                return reply(interactionOrMessage, await tg(guildId, 'economy.rob.cooldownTitle'), await tg(guildId, 'economy.rob.cooldownBody', { time: formatDuration(cooldownMs - elapsed) }), true);
            }
        }

        const victim = await getOrCreateBalance(guildId, targetUser.id, config);
        if (victim.wallet < MIN_VICTIM_WALLET) {
            return reply(interactionOrMessage, await tg(guildId, 'economy.rob.title'), await tg(guildId, 'economy.rob.targetTooPoor', { user: targetUser.username || targetUser.tag }), true);
        }

        robber.lastRob = new Date(now);

        const roll = Math.random() * 100;
        const success = roll < config.robSuccessRate;

        if (!success) {
            await robber.save();
            return reply(interactionOrMessage, await tg(guildId, 'economy.rob.title'), await tg(guildId, 'economy.rob.failed', { user: targetUser.username || targetUser.tag }));
        }

        const pct = 1 + Math.random() * Math.max(1, config.robMaxPercent - 1);
        const stolen = Math.max(1, Math.floor(victim.wallet * (pct / 100)));

        victim.wallet -= stolen;
        robber.wallet += stolen;
        await Promise.all([robber.save(), victim.save()]);

        return reply(interactionOrMessage, await tg(guildId, 'economy.rob.title'), await tg(guildId, 'economy.rob.success', {
            user: targetUser.username || targetUser.tag,
            amount: formatAmount(config, stolen)
        }));
    }
};
