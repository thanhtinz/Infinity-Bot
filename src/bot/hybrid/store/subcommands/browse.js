
const { tg } = require('../../../utils/i18n');
const { reply, formatAmount } = require('../../../utils/economyUtils');

module.exports = {
    async execute(interactionOrMessage, args, config) {
        const guildId = interactionOrMessage.guild.id;
        const { EconomyItem } = require('../../../../database/models');

        const items = await EconomyItem.findAll({ where: { guildId, active: true }, order: [['name', 'ASC']] });
        if (items.length === 0) {
            return reply(interactionOrMessage, await tg(guildId, 'economy.store.browseTitle'), await tg(guildId, 'economy.store.browseEmpty'));
        }

        const lines = items.map((item) => {
            const stockNote = item.stock != null ? ` · stock: ${item.stock}` : '';
            const roleNote = item.roleId ? ` · grants <@&${item.roleId}>${item.roleDurationSeconds ? ` (${item.roleDurationSeconds}s)` : ''}` : '';
            return `**${item.name}** — ${formatAmount(config, item.price)}${stockNote}${roleNote}\n${item.description || ''}`.trim();
        });

        const body = `${lines.join('\n\n')}\n\n${await tg(guildId, 'economy.store.browseFooter')}`;
        return reply(interactionOrMessage, await tg(guildId, 'economy.store.browseTitle'), body);
    }
};
