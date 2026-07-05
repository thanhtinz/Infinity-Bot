
const { tg } = require('../../../utils/i18n');
const { reply, resolveUserId } = require('../../../utils/economyUtils');

function formatRemaining(expiresAt) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'expiring soon';
    const minutes = Math.ceil(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m left`;
    return `${minutes}m left`;
}

module.exports = {
    async execute(interactionOrMessage) {
        const guildId = interactionOrMessage.guild.id;
        const { EconomyInventory, EconomyItem } = require('../../../../database/models');

        const userId = resolveUserId(interactionOrMessage);
        const rows = await EconomyInventory.findAll({
            where: { guildId, userId },
            include: [{ model: EconomyItem, as: 'item' }],
            order: [['createdAt', 'DESC']]
        });

        const active = rows.filter((r) => r.item && (r.quantity > 0 || (r.expiresAt && !r.roleRevoked)));
        if (active.length === 0) {
            return reply(interactionOrMessage, await tg(guildId, 'economy.store.inventoryTitle'), await tg(guildId, 'economy.store.inventoryEmpty'));
        }

        const lines = active.map((r) => {
            const expiryNote = r.expiresAt && !r.roleRevoked ? ` (${formatRemaining(r.expiresAt)})` : '';
            const qtyNote = r.item.roleId ? '' : ` x${r.quantity}`;
            return `**${r.item.name}**${qtyNote}${expiryNote}`;
        });

        return reply(interactionOrMessage, await tg(guildId, 'economy.store.inventoryTitle'), lines.join('\n'));
    }
};
