'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { AdminUser } = require('../../../src/database/models');

const router = express.Router();

router.put('/', async (req, res) => {
    try {
        const { currentPassword, newUsername, newPassword } = req.body || {};

        if (!currentPassword) {
            return res.status(400).json({ error: 'current password is required' });
        }

        const user = await AdminUser.findByPk(req.user.id);
        if (!user) return res.status(401).json({ error: 'not logged in' });

        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) return res.status(403).json({ error: 'current password is incorrect' });

        if (newUsername && newUsername.trim() && newUsername.trim() !== user.username) {
            const clash = await AdminUser.findOne({ where: { username: newUsername.trim() } });
            if (clash && clash.id !== user.id) {
                return res.status(409).json({ error: 'that username is already taken' });
            }
            user.username = newUsername.trim();
        }

        if (newPassword) {
            if (newPassword.length < 8) {
                return res.status(400).json({ error: 'new password must be at least 8 characters long' });
            }
            user.passwordHash = await bcrypt.hash(newPassword, 12);
        }

        await user.save();
        res.json({ ok: true, username: user.username });
    } catch (error) {
        res.status(500).json({ error: error.message || 'failed to update account' });
    }
});

module.exports = router;
