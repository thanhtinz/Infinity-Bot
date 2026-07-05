const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const ms = require('ms');
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
  name: 'set',
  description: 'Set the punishment for a warning threshold',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const warnCount = interaction.options.getInteger('warn_count');
    const action = interaction.options.getString('action');
    const duration = interaction.options.getString('duration');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Server' }), true);

    if (action === 'mute') {
      const time = duration ? ms(duration) : null;
      if (!time || time < 1000 || time > 2419200000)
        return modReply(interaction, await tg(guildId, 'common.invalidDuration'), await tg(guildId, 'warnpunish.set.invalidDurationBody'), true);
    }

    const [config, created] = await WarnPunishConfig.findOrCreate({
      where: { guildId: interaction.guild.id, warnCount },
      defaults: {
        guildId: interaction.guild.id,
        warnCount,
        action,
        duration: action === 'mute' ? duration : null
      }
    });

    if (!created) {
      config.action = action;
      config.duration = action === 'mute' ? duration : null;
      await config.save();
    }

    const body = action === 'mute'
      ? await tg(guildId, 'warnpunish.set.successMute', { warnCount, action, duration })
      : await tg(guildId, 'warnpunish.set.success', { warnCount, action });

    await modReply(interaction, await tg(guildId, 'warnpunish.set.successTitle'), body);
  },
};
