
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { tg } = require('../../utils/i18n');
const { reply, buildContainer, requireEconomy, requireGameEnabled, getOrCreateBalance, validateBet, formatAmount, resolveUserId, isSlashCtx } = require('../../utils/economyUtils');
const { MessageFlags } = require('discord.js');

const RANKS = [
    { label: 'A', value: 11 }, { label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 },
    { label: '5', value: 5 }, { label: '6', value: 6 }, { label: '7', value: 7 }, { label: '8', value: 8 },
    { label: '9', value: 9 }, { label: '10', value: 10 }, { label: 'J', value: 10 }, { label: 'Q', value: 10 }, { label: 'K', value: 10 }
];

function drawCard() {
    return RANKS[Math.floor(Math.random() * RANKS.length)];
}

function scoreHand(hand) {
    let score = hand.reduce((sum, c) => sum + c.value, 0);
    let aces = hand.filter((c) => c.label === 'A').length;
    while (score > 21 && aces > 0) {
        score -= 10;
        aces -= 1;
    }
    return score;
}

function handText(hand) {
    return hand.map((c) => c.label).join(' ');
}

function buttons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary).setDisabled(disabled),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play a round of blackjack against the house')
        .addIntegerOption(o => o.setName('bet').setDescription('How much to bet').setRequired(true).setMinValue(1)),

    name: 'blackjack',
    aliases: ['bj'],
    category: 'economy',

    async execute(interactionOrMessage, args = []) {
        const guild = interactionOrMessage.guild;
        if (!guild) return reply(interactionOrMessage, null, await tg(null, 'economy.common.guildOnly'), true);
        const guildId = guild.id;
        const isSlash = isSlashCtx(interactionOrMessage);

        const config = await requireEconomy(interactionOrMessage, guildId);
        if (!config) return;
        const settings = await requireGameEnabled(interactionOrMessage, guildId, 'blackjack');
        if (!settings) return;

        const userId = resolveUserId(interactionOrMessage);
        const balance = await getOrCreateBalance(guildId, userId, config);

        const rawBet = isSlash ? interactionOrMessage.options.getInteger('bet') : args[0];
        const check = await validateBet(guildId, settings, balance.wallet, rawBet);
        if (!check.ok) return reply(interactionOrMessage, await tg(guildId, 'common.error'), check.message, true);
        const bet = check.amount;

        balance.wallet -= bet;
        await balance.save();

        const player = [drawCard(), drawCard()];
        const dealer = [drawCard(), drawCard()];

        async function settle(resultKey, payoutMultiplier, extraVars = {}) {
            const payout = Math.round(bet * payoutMultiplier);
            if (payout > 0) {
                balance.wallet += payout;
                await balance.save();
            }
            const body = await tg(guildId, resultKey, {
                player: `${handText(player)} (${scoreHand(player)})`,
                dealer: `${handText(dealer)} (${scoreHand(dealer)})`,
                bet: formatAmount(config, bet),
                payout: formatAmount(config, payout),
                ...extraVars
            });
            return body;
        }

        const playerScore = scoreHand(player);
        const dealerScore = scoreHand(dealer);

        if (playerScore === 21) {
            let body;
            if (dealerScore === 21) {
                body = await settle('economy.blackjack.push');
            } else {
                body = await settle('economy.blackjack.naturalBlackjack', 2.5);
            }
            return reply(interactionOrMessage, await tg(guildId, 'economy.blackjack.title'), body);
        }

        const initialBody = await tg(guildId, 'economy.blackjack.inProgress', {
            player: `${handText(player)} (${playerScore})`,
            dealer: `${dealer[0].label} ?`
        });

        const payload = {
            components: [buildContainer(await tg(guildId, 'economy.blackjack.title'), initialBody), buttons()],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true
        };
        const sent = await interactionOrMessage.reply(payload);

        const collector = sent.createMessageComponentCollector({ filter: (i) => i.user.id === userId, time: 60000 });

        collector.on('collect', async (i) => {
            try {
                if (i.customId === 'bj_hit') {
                    player.push(drawCard());
                    const score = scoreHand(player);
                    if (score > 21) {
                        collector.stop('bust');
                        return;
                    }
                    await i.update({
                        components: [buildContainer(await tg(guildId, 'economy.blackjack.title'), await tg(guildId, 'economy.blackjack.inProgress', {
                            player: `${handText(player)} (${score})`,
                            dealer: `${dealer[0].label} ?`
                        })), buttons()]
                    });
                    if (score === 21) collector.stop('stand');
                    return;
                }
                if (i.customId === 'bj_stand') {
                    await i.deferUpdate();
                    collector.stop('stand');
                }
            } catch (error) {
                console.error('Blackjack collector error:', error);
            }
        });

        collector.on('end', async (_collected, reason) => {
            try {
                let body;
                if (reason === 'bust') {
                    body = await settle('economy.blackjack.bust');
                } else if (reason === 'stand') {
                    while (scoreHand(dealer) < 17) dealer.push(drawCard());
                    const finalDealer = scoreHand(dealer);
                    const finalPlayer = scoreHand(player);
                    if (finalDealer > 21 || finalPlayer > finalDealer) body = await settle('economy.blackjack.win', 2);
                    else if (finalDealer === finalPlayer) body = await settle('economy.blackjack.push');
                    else body = await settle('economy.blackjack.lose');
                } else {
                    // timed out with no action - treat as a stand-off refund
                    body = await settle('economy.blackjack.timeout', 1);
                }
                await sent.edit({ components: [buildContainer(await tg(guildId, 'economy.blackjack.title'), body), buttons(true)] });
            } catch (error) {
                console.error('Blackjack settle error:', error);
            }
        });
    }
};
