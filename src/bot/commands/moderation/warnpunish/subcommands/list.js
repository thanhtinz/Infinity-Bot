const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { WarnPunishConfig } = require('../../../../../database/models');
const { tg } = require('../../../../utils/i18n');

function modReply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'list',
  description: 'List configured warning punishment thresholds',

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Server' }), true);

    const configs = await WarnPunishConfig.findAll({
      where: { guildId: interaction.guild.id },
      order: [['warnCount', 'ASC']]
    });

    const title = await tg(guildId, 'warnpunish.list.title');

    if (configs.length === 0)
      return modReply(interaction, title, await tg(guildId, 'warnpunish.list.empty'));

    const entries = await Promise.all(configs.map(async c => {
      const durationNote = c.action === 'mute' && c.duration ? await tg(guildId, 'warnpunish.list.durationNote', { duration: c.duration }) : '';
      return tg(guildId, 'warnpunish.list.entry', { warnCount: c.warnCount, action: c.action, durationNote });
    }));

    await modReply(interaction, title, entries.join('\n'));
  },
};
