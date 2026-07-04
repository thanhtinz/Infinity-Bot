


const { VerificationConfig } = require('../../database/models');

const configCache = new Map();
const CACHE_TTL = 60000;

async function getConfig(guildId) {
    const cached = configCache.get(guildId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.val;
    const val = await VerificationConfig.findOne({ where: { guildId } });
    configCache.set(guildId, { val, ts: Date.now() });
    return val;
}

module.exports = {
    name: 'verificationEvent',

    async init(client) {
        client.on('guildMemberAdd', async (member) => {
            try {
                const config = await getConfig(member.guild.id);
                if (!config || !config.enabled) return;

                if (config.unverifiedRoleId) {
                    const role = member.guild.roles.cache.get(config.unverifiedRoleId);
                    if (role) {
                        await member.roles.add(role, 'Unverified role on join').catch(() => { });
                    }
                }

                if (config.channelId) {
                    member.send(`Welcome to **${member.guild.name}**! Please head to <#${config.channelId}> to verify yourself and gain access to the server.`).catch(() => { });
                }
            } catch (error) {
                console.error('Verification event error:', error);
            }
        });
    }
};
