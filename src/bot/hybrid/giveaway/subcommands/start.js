const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const Giveaway = require('../../../../database/models/Giveaway');
const emojis = require('../../../emojis.json');
const { tg } = require('../../../utils/i18n');

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

    let timeStr, winnersCount, prize;

    if (isSlash) {
      timeStr = interactionOrMessage.options.getString('duration');
      winnersCount = interactionOrMessage.options.getInteger('winners');
      prize = interactionOrMessage.options.getString('prize');
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

    const giveaway = await Giveaway.create({
      guildId: interactionOrMessage.guild.id,
      channelId: interactionOrMessage.channel.id,
      hostId: user.id,
      prize: prize,
      winners: winnersCount,
      endTime: endTime,
      ended: false
    });

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${emojis.gift || '🎁'} **${prize}** ${emojis.gift || '🎁'}`)
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        await tg(guildId, 'giveaway.start.embedInfo', {
          dot: emojis.dots || '',
          winners: winnersCount,
          endTime: `<t:${endTime}:R>`,
          host: `<@${user.id}>`,
        })
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    const enterButton = new ButtonBuilder()
      .setLabel(await tg(guildId, 'giveaway.start.enterButton'))
      .setStyle(ButtonStyle.Primary)
      .setCustomId(`giveaway_enter_${giveaway.id}`);

    const viewParticipantsButton = new ButtonBuilder()
      .setLabel(await tg(guildId, 'giveaway.start.viewParticipantsButton'))
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`giveaway_participants_${giveaway.id}`);

    const buttonRow = new ActionRowBuilder().addComponents(enterButton, viewParticipantsButton);
    container.addActionRowComponents(buttonRow);

    const giveawayMsg = await interactionOrMessage.channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });

    await giveaway.update({ messageId: giveawayMsg.id });

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
