const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');
const Giveaway = require('../../../../database/models/Giveaway');
const { tg } = require('../../../utils/i18n');
const { buildGiveawayComponents } = require('../../../utils/giveawayUtils');

const DEFAULT_EMOJI = '🎉';

function parseTime(timeStr) {
  const units = { s: 1, m: 60, h: 3600, d: 86400 };
  try {
    const unit = timeStr.slice(-1).toLowerCase();
    const value = parseInt(timeStr.slice(0, -1));
    return value * (units[unit] || 0);
  } catch {
    return 0;
  }
}

function isValidImageUrl(url) {
  if (!url || !url.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = {
  async execute(interactionOrMessage, args = []) {
    const isSlash = interactionOrMessage.isCommand?.();
    const member = interactionOrMessage.member;
    const user = isSlash ? interactionOrMessage.user : interactionOrMessage.author;
    const guildId = interactionOrMessage.guild.id;

    if (!member.permissions.has('ManageGuild')) {
      const container = new ContainerBuilder();
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${await tg(guildId, 'common.permissionDenied')}**`)
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.start.noPermission'))
      );

      return interactionOrMessage.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    let timeStr, winnersCount, prize, emojiOption, bannerOption;

    if (isSlash) {
      timeStr = interactionOrMessage.options.getString('duration');
      winnersCount = interactionOrMessage.options.getInteger('winners');
      prize = interactionOrMessage.options.getString('prize');
      emojiOption = interactionOrMessage.options.getString('emoji');
      bannerOption = interactionOrMessage.options.getString('banner');
    } else {
      if (args.length < 3) {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${await tg(guildId, 'giveaway.start.invalidUsageTitle')}**`)
        );
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.start.invalidUsageBody'))
        );

        return interactionOrMessage.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
      }

      timeStr = args[0];
      winnersCount = parseInt(args[1]);
      prize = args.slice(2).join(' ');
      emojiOption = null;
      bannerOption = null;
    }

    const seconds = parseTime(timeStr);
    if (seconds <= 0) {
      const container = new ContainerBuilder();
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${await tg(guildId, 'giveaway.start.invalidTimeTitle')}**`)
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.start.invalidTimeBody'))
      );

      return interactionOrMessage.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    if (!isSlash && (isNaN(winnersCount) || winnersCount < 1)) {
      const container = new ContainerBuilder();
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${await tg(guildId, 'giveaway.start.invalidWinnersTitle')}**`)
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.start.invalidWinnersBody'))
      );

      return interactionOrMessage.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const endTime = Math.floor(Date.now() / 1000) + seconds;
    const emoji = (emojiOption && emojiOption.trim()) ? emojiOption.trim() : DEFAULT_EMOJI;
    const bannerUrl = isValidImageUrl(bannerOption) ? bannerOption.trim() : null;

    const giveaway = await Giveaway.create({
      guildId: interactionOrMessage.guild.id,
      channelId: interactionOrMessage.channel.id,
      hostId: user.id,
      prize: prize,
      winners: winnersCount,
      endTime: endTime,
      ended: false,
      emoji,
      bannerUrl
    });

    const components = await buildGiveawayComponents({
      guildId,
      guild: interactionOrMessage.guild,
      giveaway,
      ended: false
    });

    const giveawayMsg = await interactionOrMessage.channel.send({
      components,
      flags: MessageFlags.IsComponentsV2
    });

    await giveaway.update({ messageId: giveawayMsg.id });

    try {
      await giveawayMsg.react(emoji);
    } catch (e) {
      // Custom/invalid emoji the bot can't use - fall back to the default.
      if (emoji !== DEFAULT_EMOJI) {
        await giveaway.update({ emoji: DEFAULT_EMOJI });
        await giveawayMsg.react(DEFAULT_EMOJI).catch(() => {});
      }
    }

    const confirmContainer = new ContainerBuilder();
    confirmContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${await tg(guildId, 'giveaway.start.startedTitle')}**`)
    );
    confirmContainer.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    confirmContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.start.startedBody'))
    );

    const confirmMsg = await interactionOrMessage.reply({
      components: [confirmContainer],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });

    if (!isSlash && confirmMsg) {
      setTimeout(() => {
        confirmMsg.delete().catch(() => {});
      }, 5000);
    }
  }
};
