

const VALID_TYPES = ['members', 'humans', 'bots', 'boosts', 'roleCount'];

function defaultTemplate(type) {
    switch (type) {
        case 'members': return 'Members: {count}';
        case 'humans': return 'Humans: {count}';
        case 'bots': return 'Bots: {count}';
        case 'boosts': return 'Boosts: {count}';
        case 'roleCount': return 'Role Count: {count}';
        default: return '{count}';
    }
}

async function computeCount(guild, config) {
    if (config.type === 'boosts') {
        return guild.premiumSubscriptionCount || 0;
    }

    if (config.type === 'members') {
        return guild.memberCount || guild.members.cache.size;
    }

    if (config.type === 'roleCount') {
        if (!config.roleId) return 0;
        const members = await guild.members.fetch().catch(() => guild.members.cache);
        return members.filter(m => m.roles.cache.has(config.roleId)).size;
    }

    if (config.type === 'humans' || config.type === 'bots') {
        const members = await guild.members.fetch().catch(() => guild.members.cache);
        const bots = members.filter(m => m.user.bot).size;
        return config.type === 'bots' ? bots : members.size - bots;
    }

    return 0;
}

function formatName(config, count) {
    const template = config.nameTemplate || defaultTemplate(config.type);
    return template.replace(/\{count\}/g, count.toLocaleString('en-US')).slice(0, 100);
}

async function updateStatsChannel(guild, config) {
    try {
        const channel = guild.channels.cache.get(config.channelId) || await guild.channels.fetch(config.channelId).catch(() => null);
        if (!channel) return false;

        const count = await computeCount(guild, config);
        const name = formatName(config, count);

        if (channel.name === name) return true;

        await channel.setName(name);
        return true;
    } catch (error) {
        return false;
    }
}

async function updateAllStatsChannels(guild, StatsChannelConfig) {
    const configs = await StatsChannelConfig.findAll({ where: { guildId: guild.id } });
    for (const config of configs) {
        await updateStatsChannel(guild, config);
    }
}

module.exports = {
    VALID_TYPES,
    defaultTemplate,
    computeCount,
    formatName,
    updateStatsChannel,
    updateAllStatsChannels
};
