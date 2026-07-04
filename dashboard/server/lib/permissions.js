'use strict';

const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

function hasManageGuildPermission(permissionBits) {
    try {
        const bits = BigInt(permissionBits ?? 0);
        return (bits & ADMINISTRATOR) === ADMINISTRATOR || (bits & MANAGE_GUILD) === MANAGE_GUILD;
    } catch {
        return false;
    }
}

function guildIconUrl(guildId, iconHash) {
    if (!iconHash) return null;
    const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=256`;
}

function userAvatarUrl(user) {
    if (user?.avatar) {
        const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`;
    }
    const fallbackIndex = user?.discriminator && user.discriminator !== '0'
        ? Number(user.discriminator) % 5
        : Number(BigInt(user?.id || '0') >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
}

module.exports = { hasManageGuildPermission, guildIconUrl, userAvatarUrl };
