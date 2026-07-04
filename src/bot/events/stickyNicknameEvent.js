


const { PermissionFlagsBits } = require('discord.js');
const { StickyNickname } = require('../../database/models');

const recentlySetByBot = new Map();

module.exports = {
    name: 'stickyNicknameEvent',

    async init(client) {
        client.on('guildMemberUpdate', async (oldMember, newMember) => {
            try {
                if (oldMember.nickname === newMember.nickname) return;

                const guildId = newMember.guild.id;
                const userId = newMember.id;
                const key = `${guildId}:${userId}`;

                if (recentlySetByBot.has(key) && recentlySetByBot.get(key) === newMember.nickname) {
                    recentlySetByBot.delete(key);
                    return;
                }

                const record = await StickyNickname.findOne({ where: { guildId, userId } });
                if (!record) return;
                if (newMember.nickname === record.nickname) return;

                if (newMember.id === newMember.guild.ownerId) return;

                const me = newMember.guild.members.me;
                if (!me.permissions.has(PermissionFlagsBits.ManageNicknames)) return;
                if (newMember.roles.highest.position >= me.roles.highest.position) return;

                recentlySetByBot.set(key, record.nickname);
                setTimeout(() => recentlySetByBot.delete(key), 15000);

                await newMember.setNickname(record.nickname, 'Sticky nickname reapplied').catch(() => {
                    recentlySetByBot.delete(key);
                });
            } catch (error) {
                console.error('Sticky nickname event error:', error);
            }
        });
    }
};
