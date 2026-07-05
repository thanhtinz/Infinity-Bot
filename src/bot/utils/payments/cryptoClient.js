'use strict';

/**
 * Crypto payments are inherently hard to fully automate without a specific on-chain data provider
 * (e.g. a block-explorer API with an API key we don't have credentials for in this sandbox). This
 * client intentionally does NOT attempt on-chain transaction monitoring. Instead it implements a
 * clean manual-confirmation flow:
 *   1. Generate a unique deposit reference/memo per order.
 *   2. Show the buyer the configured wallet address + amount + reference to include.
 *   3. Leave the order `pending` until an admin manually marks it paid (dashboard/admin action),
 *      or a future webhook integration (e.g. a paid block-explorer subscription) is added.
 *
 * Wallet addresses resolve in this order: `PaymentGatewayConfig` DB row (id: 1, edited from the
 * Owner Admin Panel) -> process.env (CRYPTO_WALLET_BTC / CRYPTO_WALLET_ETH / CRYPTO_WALLET_USDT).
 */

class CryptoNotConfiguredError extends Error {
    constructor(asset) {
        super(`No wallet address is configured for ${asset}.`);
        this.name = 'CryptoNotConfiguredError';
        this.code = 'CRYPTO_NOT_CONFIGURED';
    }
}

const ASSET_FIELD_MAP = {
    BTC: { envVar: 'CRYPTO_WALLET_BTC', dbField: 'cryptoWalletBtc' },
    ETH: { envVar: 'CRYPTO_WALLET_ETH', dbField: 'cryptoWalletEth' },
    USDT: { envVar: 'CRYPTO_WALLET_USDT', dbField: 'cryptoWalletUsdt' }
};

const SUPPORTED_ASSETS = Object.keys(ASSET_FIELD_MAP);

/** Returns { BTC: 'addr'|null, ETH: 'addr'|null, USDT: 'addr'|null }, DB row taking priority over env. */
async function resolveWallets() {
    const wallets = {};
    for (const asset of SUPPORTED_ASSETS) {
        wallets[asset] = process.env[ASSET_FIELD_MAP[asset].envVar] || null;
    }

    try {
        const { PaymentGatewayConfig } = require('../../../database/models');
        const row = await PaymentGatewayConfig.findByPk(1);
        if (row) {
            for (const asset of SUPPORTED_ASSETS) {
                wallets[asset] = row[ASSET_FIELD_MAP[asset].dbField] || wallets[asset];
            }
        }
    } catch {
        // DB unavailable - fall back to whatever env vars provided above.
    }

    return wallets;
}

function listConfiguredAssets(wallets) {
    return SUPPORTED_ASSETS.filter((asset) => !!wallets[asset]);
}

/**
 * Builds the deposit instructions shown to the buyer for a given order + asset. Does not touch
 * the database itself - callers are responsible for persisting `reference` onto the ShopOrder row
 * (as `paymentReference`) so an admin can look it up later.
 */
async function buildDepositInstructions({ orderId, asset, amountUsd }) {
    const normalizedAsset = String(asset || '').toUpperCase();
    if (!SUPPORTED_ASSETS.includes(normalizedAsset)) {
        throw new Error(`Unsupported crypto asset: ${asset}`);
    }

    const wallets = await resolveWallets();
    const address = wallets[normalizedAsset];
    if (!address) throw new CryptoNotConfiguredError(normalizedAsset);

    // Short, human-typeable reference the buyer includes in the transfer memo/note (some assets,
    // like BTC, have no memo field - in that case the admin reconciles by amount + rough timing).
    const reference = `INF-${orderId}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    return {
        asset: normalizedAsset,
        address,
        amountUsd,
        reference,
        note: 'This payment must be confirmed manually by a server admin after the transfer arrives.'
    };
}

module.exports = {
    CryptoNotConfiguredError,
    SUPPORTED_ASSETS,
    resolveWallets,
    listConfiguredAssets,
    buildDepositInstructions
};
