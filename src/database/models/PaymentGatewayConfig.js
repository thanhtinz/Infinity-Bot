
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * Singleton-style table (always the row with id: 1) storing payment gateway credentials as edited
 * from the Owner Admin Panel (owner-admin/), instead of hand-editing the .env file + restarting.
 * Mirrors BotRuntimeConfig's pattern exactly: any field left null falls back to the equivalent
 * process.env value - see src/bot/utils/payments/*Client.js's resolveConfig() helpers.
 */
class PaymentGatewayConfig extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false, defaultValue: 1 },
                payosClientId: { type: DataTypes.STRING, allowNull: true, comment: 'Overrides PAYOS_CLIENT_ID env var when set' },
                payosApiKey: { type: DataTypes.TEXT, allowNull: true, comment: 'Overrides PAYOS_API_KEY env var when set; never returned in full to the frontend' },
                payosChecksumKey: { type: DataTypes.TEXT, allowNull: true, comment: 'Overrides PAYOS_CHECKSUM_KEY env var when set; never returned in full to the frontend' },
                paypalClientId: { type: DataTypes.STRING, allowNull: true, comment: 'Overrides PAYPAL_CLIENT_ID env var when set' },
                paypalClientSecret: { type: DataTypes.TEXT, allowNull: true, comment: 'Overrides PAYPAL_CLIENT_SECRET env var when set; never returned in full to the frontend' },
                paypalMode: { type: DataTypes.STRING, allowNull: true, comment: "Overrides PAYPAL_MODE env var when set; 'sandbox' | 'live'" },
                cryptoWalletBtc: { type: DataTypes.STRING, allowNull: true },
                cryptoWalletEth: { type: DataTypes.STRING, allowNull: true },
                cryptoWalletUsdt: { type: DataTypes.STRING, allowNull: true },
            },
            {
                sequelize,
                modelName: 'PaymentGatewayConfig',
                tableName: 'payment_gateway_config',
                timestamps: true,
            }
        );
        return this;
    }
}

module.exports = PaymentGatewayConfig;
