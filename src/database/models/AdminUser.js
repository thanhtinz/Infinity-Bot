
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * A real admin account for the Owner Admin Panel (owner-admin/). Completely separate from any
 * Discord identity - login is local username + bcrypt password hash, not Discord OAuth. There is
 * no self-registration UI; accounts are created/reset with `node scripts/create-admin.js`.
 */
class AdminUser extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                username: { type: DataTypes.STRING, allowNull: false, unique: true, comment: 'Login username for the owner admin panel' },
                passwordHash: { type: DataTypes.STRING, allowNull: false, comment: 'bcrypt hash - never store or log the plaintext password' },
            },
            {
                sequelize,
                modelName: 'AdminUser',
                tableName: 'admin_users',
                timestamps: true,
                indexes: [
                    {
                        unique: true,
                        fields: ['username'],
                    },
                ],
            }
        );
        return this;
    }
}

module.exports = AdminUser;
