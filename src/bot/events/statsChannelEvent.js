


const { StatsChannelConfig } = require('../../database/models');
const { updateAllStatsChannels } = require('../utils/statsChannelUtils');

const UPDATE_INTERVAL = 10 * 60 * 1000;
const DEBOUNCE_DELAY = 5000;

const debounceTimers = new Map();

function scheduleUpdate(guild) {
    if (!guild) return;
    if (debounceTimers.has(guild.id)) return;

    const timer = setTimeout(async () => {
        debounceTimers.delete(guild.id);
        try {
            await updateAllStatsChannels(guild, StatsChannelConfig);
        } catch (error) {
            console.error('Stats channel debounce update error:', error);
        }
    }, DEBOUNCE_DELAY);

    debounceTimers.set(guild.id, timer);
}

module.exports = {
    name: 'statsChannelEvent',

    init(client) {
        client.on('guildMemberAdd', (member) => scheduleUpdate(member.guild));
        client.on('guildMemberRemove', (member) => scheduleUpdate(member.guild));
        client.on('guildUpdate', (oldGuild, newGuild) => scheduleUpdate(newGuild));

        client.once('clientReady', () => {
            setInterval(async () => {
                try {
                    const configs = await StatsChannelConfig.findAll();
                    const guildIds = [...new Set(configs.map(c => c.guildId))];

                    for (const guildId of guildIds) {
                        const guild = client.guilds.cache.get(guildId);
                        if (!guild) continue;
                        await updateAllStatsChannels(guild, StatsChannelConfig);
                    }
                } catch (error) {
                    console.error('Stats channel interval update error:', error);
                }
            }, UPDATE_INTERVAL);
        });
    }
};
