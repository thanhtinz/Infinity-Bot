


const { Birthday, BirthdayConfig } = require('../../database/models');
const { replacePlaceholders } = require('../utils/birthdayUtils');

const CHECK_INTERVAL = 60 * 60 * 1000;
const ROLE_REMOVAL_DELAY = 24 * 60 * 60 * 1000;

async function announceBirthday(client, birthday, guild) {
    try {
        const config = await BirthdayConfig.findOne({ where: { guildId: guild.id } });
        if (!config || !config.channelId) return;

        const member = await guild.members.fetch(birthday.userId).catch(() => null);
        if (!member) return;

        const channel = guild.channels.cache.get(config.channelId);
        if (!channel) return;

        const message = replacePlaceholders(config.message || 'Happy Birthday, {user}! 🎉', member);
        await channel.send({ content: message }).catch(() => {});

        if (config.roleId) {
            const role = guild.roles.cache.get(config.roleId);
            if (role) {
                await member.roles.add(role).catch(() => {});
                setTimeout(async () => {
                    try {
                        const freshMember = await guild.members.fetch(birthday.userId).catch(() => null);
                        if (freshMember && freshMember.roles.cache.has(role.id)) {
                            await freshMember.roles.remove(role).catch(() => {});
                        }
                    } catch (error) {
                        console.error('Birthday role removal error:', error);
                    }
                }, ROLE_REMOVAL_DELAY);
            }
        }

        birthday.lastAnnouncedYear = new Date().getUTCFullYear();
        await birthday.save();
    } catch (error) {
        console.error('Birthday announce error:', error);
    }
}

async function checkBirthdays(client) {
    try {
        const now = new Date();
        const day = now.getUTCDate();
        const month = now.getUTCMonth() + 1;
        const year = now.getUTCFullYear();

        const birthdays = await Birthday.findAll({ where: { day, month } });

        for (const birthday of birthdays) {
            if (birthday.lastAnnouncedYear === year) continue;

            const guild = client.guilds.cache.get(birthday.guildId);
            if (!guild) continue;

            await announceBirthday(client, birthday, guild);
        }
    } catch (error) {
        console.error('Birthday check error:', error);
    }
}

module.exports = {
    name: 'birthdayEvent',

    init(client) {
        client.once('clientReady', () => {
            checkBirthdays(client);
            setInterval(() => checkBirthdays(client), CHECK_INTERVAL);
        });
    }
};
