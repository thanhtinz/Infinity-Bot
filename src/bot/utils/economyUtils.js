'use strict';

/**
 * Shared helpers for the "Infinity Economy" in-game currency system (src/bot/hybrid/{economy,
 * store,balance,daily,deposit,withdraw,rob,blackjack,slot,coinbet,marry,divorce}). This is a
 * SEPARATE system from the real-money Shop (`/shop`) - it is unlocked per-guild via
 * ShopProduct.unlocksEconomy + shopUtils.unlockEconomy(), see src/bot/utils/shopUtils.js.
 */

const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const { tg } = require('./i18n');

const GAMES = ['blackjack', 'slot', 'coinflip', 'daily', 'rob', 'marry'];

/** Builds a simple Components V2 container reply, matching the conventions used across the bot. */
function buildContainer(title, body) {
    const container = new ContainerBuilder();
    if (title) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    }
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    return container;
}

/** Sends (or edits, if already deferred/replied) a Components V2 reply for either an interaction or a message. */
async function reply(ctx, title, body, ephemeral = false) {
    const payload = { components: [buildContainer(title, body)], flags: MessageFlags.IsComponentsV2 };
    if (ctx.deferred || ctx.replied) return ctx.editReply(payload);
    return ctx.reply({ ...payload, ephemeral });
}

/**
 * Loads the guild's EconomyConfig and, if it isn't unlocked (`enabled !== true`), replies with a
 * friendly bilingual message and returns null so the caller can bail out. Every single new economy
 * command (including the admin `/economy setup`/`/economy games` ones) must call this first.
 */
async function requireEconomy(ctx, guildId) {
    const { EconomyConfig } = require('../../database/models');
    if (!guildId) {
        await reply(ctx, null, await tg(null, 'economy.common.guildOnly'), true);
        return null;
    }

    const config = await EconomyConfig.findOne({ where: { guildId } });
    if (!config || !config.enabled) {
        await reply(ctx, await tg(guildId, 'economy.common.notUnlockedTitle'), await tg(guildId, 'economy.common.notUnlockedBody'), true);
        return null;
    }
    return config;
}

/** Finds or creates a user's balance row, seeding `wallet` from the guild's configured starting balance. */
async function getOrCreateBalance(guildId, userId, config) {
    const { EconomyBalance } = require('../../database/models');
    const [balance] = await EconomyBalance.findOrCreate({
        where: { guildId, userId },
        defaults: { guildId, userId, wallet: config?.startingBalance ?? 100, bank: 0 }
    });
    return balance;
}

/** Finds or creates a per-game settings row, defaulting to enabled with no bet limits. */
async function getOrCreateGameSettings(guildId, game) {
    const { EconomyGameSettings } = require('../../database/models');
    const [settings] = await EconomyGameSettings.findOrCreate({
        where: { guildId, game },
        defaults: { guildId, game, enabled: true }
    });
    return settings;
}

/**
 * Checks a game's enabled flag, replying with a friendly message and returning null if it's been
 * disabled by a guild admin via `/economy games disable` or the dashboard.
 */
async function requireGameEnabled(ctx, guildId, game) {
    const settings = await getOrCreateGameSettings(guildId, game);
    if (!settings.enabled) {
        await reply(ctx, await tg(guildId, 'economy.common.gameDisabledTitle'), await tg(guildId, 'economy.common.gameDisabledBody', { game }), true);
        return null;
    }
    return settings;
}

/** Validates a bet amount against a game's configured min/max and the user's wallet. Returns { ok, amount } or { ok:false, message }. */
async function validateBet(guildId, settings, wallet, rawAmount) {
    const amount = Math.floor(Number(rawAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, message: await tg(guildId, 'economy.common.invalidBet') };
    }
    if (settings.minBet != null && amount < settings.minBet) {
        return { ok: false, message: await tg(guildId, 'economy.common.betTooLow', { min: formatNumber(settings.minBet) }) };
    }
    if (settings.maxBet != null && amount > settings.maxBet) {
        return { ok: false, message: await tg(guildId, 'economy.common.betTooHigh', { max: formatNumber(settings.maxBet) }) };
    }
    if (amount > wallet) {
        return { ok: false, message: await tg(guildId, 'economy.common.insufficientFunds') };
    }
    return { ok: true, amount };
}

function formatNumber(n) {
    return Number(n).toLocaleString('en-US');
}

/** Formats an amount with the guild's configured currency name/symbol, e.g. "1,234 🪙 Coins". */
function formatAmount(config, amount) {
    const symbol = config?.currencySymbol || '🪙';
    const name = config?.currencyName || 'Coins';
    return `${formatNumber(amount)} ${symbol} ${name}`;
}

function resolveUserId(ctx) {
    return ctx.user?.id || ctx.author?.id;
}

function isSlashCtx(ctx) {
    return ctx.isChatInputCommand?.() === true;
}

module.exports = {
    GAMES,
    buildContainer,
    reply,
    requireEconomy,
    getOrCreateBalance,
    getOrCreateGameSettings,
    requireGameEnabled,
    validateBet,
    formatNumber,
    formatAmount,
    resolveUserId,
    isSlashCtx
};
