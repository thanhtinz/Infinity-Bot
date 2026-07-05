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
const GiveawayEntry = require('../../../../database/models/GiveawayEntry');
const emojis = require('../../../emojis.json');
const { tg } = require('../../../utils/i18n');

module.exports = {
  async execute(interactionOrMessage, args = []) {
    const isSlash = interactionOrMessage.isCommand?.();
    const member = interactionOrMessage.member;
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
        new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.reroll.noPermission'))
      );

      return interactionOrMessage.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    let targetMessageId;

    if (isSlash) {
      targetMessageId = interactionOrMessage.options.getString('message_id');
    } else {
      if (interactionOrMessage.reference?.messageId) {
        targetMessageId = interactionOrMessage.reference.messageId;
      } else if (args[0]) {
        targetMessageId = args[0];
      } else {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${await tg(guildId, 'giveaway.reroll.noMessageTitle')}**`)
        );
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.reroll.noMessageBody'))
        );

        return interactionOrMessage.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
      }
    }

    const giveaway = await Giveaway.findOne({
      where: {
        messageId: targetMessageId,
        ended: true
      }
    });

    if (!giveaway) {
      const container = new ContainerBuilder();
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${await tg(guildId, 'giveaway.reroll.notFoundTitle')}**`)
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.reroll.notFoundBody'))
      );

      return interactionOrMessage.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const entries = await GiveawayEntry.findAll({
      where: { giveawayId: giveaway.id }
    });

    if (!entries || entries.length === 0) {
      const container = new ContainerBuilder();
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${await tg(guildId, 'giveaway.reroll.noEntriesTitle')}**`)
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.reroll.noEntriesBody'))
      );

      return interactionOrMessage.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const winnerCount = Math.min(giveaway.winners, entries.length);
    const winners = [];
    const availableEntries = [...entries];

    for (let i = 0; i < winnerCount; i++) {
      const randomIndex = Math.floor(Math.random() * availableEntries.length);
      winners.push(availableEntries.splice(randomIndex, 1)[0]);
    }

    const winnerLinks = [];
    for (const winner of winners) {
      try {
        const user = await interactionOrMessage.client.users.fetch(winner.userId);
        winnerLinks.push(`<@${user.id}>`);
      } catch {
        winnerLinks.push(`<@${winner.userId}>`);
      }
    }

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${emojis.gift || '🎁'} **${await tg(guildId, 'giveaway.reroll.newWinnersHeader')}** ${emojis.gift || '🎁'}`)
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        await tg(guildId, 'giveaway.reroll.newWinnersBody', {
          prize: giveaway.prize,
          winners: winnerLinks.join(', '),
          congrats: emojis.giveawayyes,
        })
      )
    );

    const giveawayMessage = await interactionOrMessage.channel.messages.fetch(targetMessageId).catch(() => null);

    if (giveawayMessage) {
      const giveawayLinkButton = new ButtonBuilder()
        .setLabel(await tg(guildId, 'giveaway.reroll.giveawayLinkButton'))
        .setStyle(ButtonStyle.Link)
        .setURL(giveawayMessage.url);

      const buttonRow = new ActionRowBuilder().addComponents(giveawayLinkButton);
      container.addActionRowComponents(buttonRow);
    }

    await interactionOrMessage.channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { users: winners.map(w => w.userId) }
    });

    await interactionOrMessage.reply({
      components: [new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${await tg(guildId, 'giveaway.reroll.rerollCompleteTitle')}**`)
      ).addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      ).addTextDisplayComponents(
        new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.reroll.rerollCompleteBody'))
      )],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });

    for (const winner of winners) {
      try {
        const user = await interactionOrMessage.client.users.fetch(winner.userId);
        const dmContainer = new ContainerBuilder();
        dmContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            await tg(guildId, 'giveaway.reroll.dmWinner', {
              icon: emojis.giveawayyes,
              prize: giveaway.prize,
              guild: interactionOrMessage.guild.name,
              heart: emojis.heart || '❤️',
            })
          )
        );

        if (giveawayMessage) {
          const jumpButton = new ButtonBuilder()
            .setLabel(await tg(guildId, 'giveaway.reroll.viewWinningMessageButton'))
            .setStyle(ButtonStyle.Link)
            .setURL(giveawayMessage.url);

          const buttonRow = new ActionRowBuilder().addComponents(jumpButton);
          dmContainer.addActionRowComponents(buttonRow);
        }

        await user.send({
          components: [dmContainer],
          flags: MessageFlags.IsComponentsV2
        });
      } catch (e) {
        console.error(`Failed to DM reroll winner ${winner.userId}:`, e);
      }
    }
  }
};
