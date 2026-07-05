


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const Giveaway = require('../../database/models/Giveaway');
const GiveawayEntry = require('../../database/models/GiveawayEntry');
const emojis = require('../emojis.json');
const { tg } = require('./i18n');
const { emojiMatches } = require('./starboardUtils');

let isChecking = false;

const GIVEAWAY_ACCENT_COLOR = 0x9B59B6;

/**
 * Builds the two top-level components used for a giveaway message
 * (a bold/underlined title line followed by an info container),
 * matching the "classic reaction giveaway" visual style.
 *
 * @param {object} opts
 * @param {string} opts.guildId
 * @param {import('discord.js').Guild} opts.guild
 * @param {import('../../database/models/Giveaway')} opts.giveaway
 * @param {boolean} opts.ended
 * @param {string[]} [opts.winnerIds] - only used when ended=true
 */
async function buildGiveawayComponents({ guildId, guild, giveaway, ended, winnerIds }) {
  const titleKey = ended ? 'giveaway.embed.endedTitle' : 'giveaway.embed.startedTitle';
  const title = await tg(guildId, titleKey);

  const header = new TextDisplayBuilder().setContent(`**__🕊️ ${title} 🕊️__**`);

  const container = new ContainerBuilder();
  if (typeof container.setAccentColor === 'function') {
    container.setAccentColor(GIVEAWAY_ACCENT_COLOR);
  }

  const guildSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${guild.name}**`)
    );

  const guildIcon = guild.iconURL({ size: 128 });
  if (guildIcon) {
    guildSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(guildIcon));
  }

  container.addSectionComponents(guildSection);

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${giveaway.prize}**`)
  );

  const timeLine = ended
    ? `🔮 ${await tg(guildId, 'giveaway.embed.endedLabel')}`
    : `🔮 ${await tg(guildId, 'giveaway.embed.timeLabel')}: <t:${giveaway.endTime}:R>`;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(timeLine)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `🔮 ${await tg(guildId, 'giveaway.embed.hostedByLabel')}: <@${giveaway.hostId}>`
    )
  );

  if (ended) {
    const winnersLabel = await tg(guildId, 'giveaway.embed.winnersLabel');
    const winnersValue = winnerIds && winnerIds.length > 0
      ? winnerIds.map(id => `<@${id}>`).join(', ')
      : await tg(guildId, 'giveaway.embed.noValidEntries');

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`🏆 ${winnersLabel}: ${winnersValue}`)
    );
  }

  if (giveaway.bannerUrl) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(giveaway.bannerUrl)
      )
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  const footerCountKey = ended ? (winnerIds ? winnerIds.length : 0) : giveaway.winners;
  const winnerCountText = await tg(guildId, 'giveaway.embed.winnerCount', { count: footerCountKey });
  const timeLabel = await tg(guildId, ended ? 'giveaway.embed.endedAtLabel' : 'giveaway.embed.startedAtLabel');
  const timestamp = ended ? Math.floor(Date.now() / 1000) : (giveaway.createdAt ? Math.floor(new Date(giveaway.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${winnerCountText} | ${timeLabel} | <t:${timestamp}:f>`)
  );

  return [header, container];
}

/**
 * Collects the current set of valid entrants for a giveaway by reading the
 * live reactions on the giveaway message (the authoritative source of truth),
 * falling back to whatever has been recorded in GiveawayEntry if the message
 * can no longer be fetched (e.g. deleted).
 *
 * @returns {Promise<{ userIds: string[]|null, message: import('discord.js').Message|null }>}
 */
async function collectEntrantIds(channel, giveaway) {
  try {
    let message = await channel.messages.fetch(giveaway.messageId);

    let reaction = message.reactions.cache.find(r => emojiMatches(giveaway.emoji, r.emoji));
    if (!reaction) {
      message = await message.fetch();
      reaction = message.reactions.cache.find(r => emojiMatches(giveaway.emoji, r.emoji));
    }

    if (!reaction) return { userIds: [], message };

    const userIds = new Set();
    let after;
    // Paginate through all reactors (100 per request).
    for (;;) {
      const batch = await reaction.users.fetch({ limit: 100, after });
      if (batch.size === 0) break;
      for (const user of batch.values()) {
        if (!user.bot) userIds.add(user.id);
      }
      if (batch.size < 100) break;
      after = batch.lastKey();
    }

    return { userIds: Array.from(userIds), message };
  } catch (e) {
    return { userIds: null, message: null };
  }
}

async function syncEntries(giveawayId, userIds) {
  await GiveawayEntry.destroy({ where: { giveawayId } });
  if (userIds.length > 0) {
    await GiveawayEntry.bulkCreate(userIds.map(userId => ({ giveawayId, userId })));
  }
}

async function endGiveaway(client, giveaway) {
  try {
    const guild = client.guilds.cache.get(giveaway.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(giveaway.channelId);
    if (!channel) return;

    const guildId = giveaway.guildId;

    const { userIds, message: giveawayMsg } = await collectEntrantIds(channel, giveaway);

    let entrantIds;
    if (userIds === null) {
      // Message/reactions could not be fetched (deleted?) - fall back to
      // whatever entries were already recorded via the reaction listener.
      const existing = await GiveawayEntry.findAll({ where: { giveawayId: giveaway.id } });
      entrantIds = existing.map(e => e.userId);
    } else {
      entrantIds = userIds;
      await syncEntries(giveaway.id, entrantIds);
    }

    const winnerCount = Math.min(giveaway.winners, entrantIds.length);
    const pool = [...entrantIds];
    const winnerIds = [];

    for (let i = 0; i < winnerCount; i++) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      winnerIds.push(pool.splice(randomIndex, 1)[0]);
    }

    const components = await buildGiveawayComponents({ guildId, guild, giveaway, ended: true, winnerIds });

    if (giveawayMsg) {
      try {
        await giveawayMsg.edit({ components, flags: MessageFlags.IsComponentsV2 });
      } catch (e) {
        console.error('Failed to update giveaway message:', e);
      }
    }

    if (winnerIds.length === 0) return;

    const winnerMentions = winnerIds.map(id => `<@${id}>`);
    const followupContainer = new ContainerBuilder();
    followupContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        await tg(guildId, 'giveaway.followup.congrats', {
          winners: winnerMentions.join(', '),
          prize: giveaway.prize,
          host: `<@${giveaway.hostId}>`,
        })
      )
    );

    const followupPayload = {
      components: [followupContainer],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { users: winnerIds }
    };

    try {
      if (giveawayMsg) {
        await giveawayMsg.reply(followupPayload);
      } else {
        await channel.send(followupPayload);
      }
    } catch (e) {
      console.error('Failed to send giveaway winner announcement:', e);
    }

    await Promise.all(winnerIds.map(async (winnerId) => {
      try {
        const user = await client.users.fetch(winnerId);
        const dmContainer = new ContainerBuilder();
        dmContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            await tg(guildId, 'giveaway.dm.won', {
              icon: emojis.giveawayyes || '🎉',
              prize: giveaway.prize,
              guild: guild.name,
              heart: emojis.heart || '❤️',
            })
          )
        );

        if (giveawayMsg) {
          dmContainer.addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel(await tg(guildId, 'giveaway.reroll.viewWinningMessageButton'))
                .setStyle(ButtonStyle.Link)
                .setURL(giveawayMsg.url)
            )
          );
        }

        await user.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2 });
      } catch (e) {
        console.error(`Failed to DM winner ${winnerId}:`, e);
      }
    }));
  } catch (e) {
    console.error('Error ending giveaway:', e);
  }
}

async function checkGiveaways(client) {
  if (isChecking) return;
  isChecking = true;
  try {
    const now = Math.floor(Date.now() / 1000);
    const expiredGiveaways = await Giveaway.findAll({
      where: {
        ended: false,
        endTime: { [require('sequelize').Op.lte]: now }
      }
    });

    if (expiredGiveaways.length === 0) return;

    await Promise.all(expiredGiveaways.map(async (giveaway) => {
      await endGiveaway(client, giveaway);
      await giveaway.update({ ended: true });
    }));
  } finally {
    isChecking = false;
  }
}

module.exports = {
  endGiveaway,
  checkGiveaways,
  buildGiveawayComponents,
  collectEntrantIds,
};
