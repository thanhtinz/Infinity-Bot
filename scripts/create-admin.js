'use strict';

/**
 * One-off bootstrap script for the Owner Admin Panel (owner-admin/). There is no self-registration
 * UI on purpose - this is how the bot owner creates (or resets the password of) their own admin
 * login, by upserting an AdminUser row with a bcrypt password hash.
 *
 * Usage:
 *   node scripts/create-admin.js <username> <password>
 */

require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');

async function main() {
    const [username, password] = process.argv.slice(2);

    if (!username || !password) {
        console.error('Usage: node scripts/create-admin.js <username> <password>');
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('Password must be at least 8 characters long.');
        process.exit(1);
    }

    const { AdminUser, dbReady, sequelize } = require('../src/database/models');

    try {
        await dbReady;
    } catch (error) {
        console.error('Database initialization failed:', error.message || error);
        process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await AdminUser.findOne({ where: { username } });
    if (existing) {
        existing.passwordHash = passwordHash;
        await existing.save();
        console.log(`Updated password for existing admin user "${username}".`);
    } else {
        await AdminUser.create({ username, passwordHash });
        console.log(`Created admin user "${username}".`);
    }

    await sequelize.close();
    process.exit(0);
}

main().catch((error) => {
    console.error('Failed to create/reset admin user:', error.message || error);
    process.exit(1);
});
