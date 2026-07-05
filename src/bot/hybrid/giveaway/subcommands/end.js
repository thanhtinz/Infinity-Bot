const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');
const Giveaway = require('../../../../database/models/Giveaway');
const { endGiveaway } = require('../../../utils/giveawayUtils');
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
        new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.end.noPermission'))
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
          new TextDisplayBuilder().setContent(`**${await tg(guildId, 'giveaway.end.noMessageTitle')}**`)
        );
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.end.noMessageBody'))
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
        ended: false
      }
    });

    if (!giveaway) {
      const container = new ContainerBuilder();
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${await tg(guildId, 'giveaway.end.notFoundTitle')}**`)
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.end.notFoundBody'))
      );

      return interactionOrMessage.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    await endGiveaway(interactionOrMessage.client, giveaway);
    await giveaway.update({ ended: true });

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${await tg(guildId, 'giveaway.end.endedTitle')}**`)
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(await tg(guildId, 'giveaway.end.endedBody'))
    );

    return interactionOrMessage.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
};
