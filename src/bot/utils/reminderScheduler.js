const { Op } = require('sequelize');
const { Reminder } = require('../../database/models');

const CHECK_INTERVAL_MS = 20000;

/**
 * Finds all pending reminders that are due (remindAt <= now, sent = false).
 * Extracted as a standalone function so it can be tested without a live Discord client.
 */
async function findDueReminders(now = new Date()) {
    return Reminder.findAll({
        where: {
            sent: false,
            remindAt: { [Op.lte]: now },
        },
        order: [['remindAt', 'ASC']],
    });
}

async function deliverReminder(client, reminder) {
    const content = `⏰ Reminder: ${reminder.message}`;
    let delivered = false;

    try {
        const user = await client.users.fetch(reminder.userId);
        await user.send(content);
        delivered = true;
    } catch (dmError) {
        // DMs closed or user unreachable — fall back to the original channel.
        try {
            const channel = await client.channels.fetch(reminder.channelId);
            if (channel && channel.isTextBased()) {
                await channel.send(`<@${reminder.userId}> ${content}`);
                delivered = true;
            }
        } catch (channelError) {
            console.error(`[reminders] failed to deliver reminder ${reminder.id}:`, channelError.message || channelError);
        }
    }

    reminder.sent = true;
    await reminder.save();
    return delivered;
}

async function checkAndDeliverDueReminders(client) {
    const due = await findDueReminders();
    for (const reminder of due) {
        await deliverReminder(client, reminder);
    }
    return due.length;
}

function init(client) {
    const timer = setInterval(() => {
        checkAndDeliverDueReminders(client).catch((error) => {
            console.error('[reminders] scheduler error:', error.message || error);
        });
    }, CHECK_INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
    console.log('[reminders] scheduler started (checking every 20s)');
    return timer;
}

module.exports = {
    init,
    findDueReminders,
    checkAndDeliverDueReminders,
    deliverReminder,
};
