const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder
} = require('discord.js');
const { AntinukeWhitelist } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

const EVENTS = AntinukeWhitelist.EVENTS;

module.exports = {
    name: 'whitelist',
    description: 'Manage whitelisted users',

    async execute(interactionOrMessage, args = []) {
        const member = interactionOrMessage.member;
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;
        const isSlash = interactionOrMessage.isCommand?.();

        if (guild.ownerId !== member.id) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.ownerOnlyWhitelist'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        let action, user;

        if (isSlash) {
            action = interactionOrMessage.options.getString('action');
            user = interactionOrMessage.options.getUser('user');
        } else {
            action = args[0]?.toLowerCase();
            const userId = args[1]?.replace(/[<@!>]/g, '');
            if (userId) {
                try {
                    user = await interactionOrMessage.client.users.fetch(userId);
                } catch (e) {
                    user = null;
                }
            }
        }

        if (action === 'add') {
            if (!user) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'antinuke.whitelistAddTitle')}`)
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.whitelistAddPrompt'))
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new UserSelectMenuBuilder()
                                .setCustomId('antinuke_whitelist_add')
                                .setPlaceholder('Select user to whitelist')
                                .setMinValues(1)
                                .setMaxValues(1)
                        )
                    );

                return interactionOrMessage.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            const eventOptions = Object.entries(EVENTS).map(([value, label]) => ({
                label: label,
                value: value,
                description: `Whitelist for ${label}`
            }));

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'antinuke.whitelistForUser', { user: user.username })}`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.whitelistEventsPrompt'))
                )
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`antinuke_whitelist_events:${user.id}`)
                            .setPlaceholder('Select events to whitelist')
                            .setMinValues(1)
                            .setMaxValues(Object.keys(EVENTS).length)
                            .addOptions(eventOptions)
                    )
                )
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`antinuke_whitelist_all:${user.id}`)
                            .setLabel('Whitelist All Events')
                            .setStyle(ButtonStyle.Primary)
                    )
                );

            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        if (action === 'remove') {
            if (!user) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'antinuke.whitelistRemoveTitle')}`)
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.whitelistRemovePrompt'))
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new UserSelectMenuBuilder()
                                .setCustomId('antinuke_whitelist_remove')
                                .setPlaceholder('Select user to remove')
                                .setMinValues(1)
                                .setMaxValues(1)
                        )
                    );

                return interactionOrMessage.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            const existing = await AntinukeWhitelist.findOne({
                where: { guildId: guild.id, userId: user.id }
            });

            if (!existing) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.userNotWhitelisted', { user: user.username }))
                    );
                return interactionOrMessage.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            const userEvents = existing.events;

            if (userEvents && userEvents.length > 0) {
                const eventOptions = userEvents.map(eventKey => ({
                    label: EVENTS[eventKey] || eventKey,
                    value: eventKey,
                    description: `Remove from ${EVENTS[eventKey] || eventKey}`
                }));

                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'antinuke.removeUserWhitelistTitle', { user: user.username })}`)
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.removeEventsPrompt'))
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId(`antinuke_whitelist_remove_events:${user.id}`)
                                .setPlaceholder('Select events to remove')
                                .setMinValues(1)
                                .setMaxValues(eventOptions.length)
                                .addOptions(eventOptions)
                        )
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`antinuke_whitelist_remove_all:${user.id}`)
                                .setLabel('Remove Entirely')
                                .setStyle(ButtonStyle.Danger)
                        )
                    );

                return interactionOrMessage.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            const deleted = await AntinukeWhitelist.destroy({
                where: { guildId: guild.id, userId: user.id }
            });

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.userRemovedFromWhitelist', { user: user.username }))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        if (action === 'list') {
            return showWhitelistDetailed(interactionOrMessage, guild);
        }

        const whitelist = await AntinukeWhitelist.findAll({ where: { guildId: guild.id } });

        let listContent = '';
        if (whitelist.length === 0) {
            listContent = await tg(guildId, 'antinuke.noUsersWhitelisted');
        } else {
            const allEvents = await tg(guildId, 'antinuke.allEvents');
            const entries = await Promise.all(whitelist.map(async (w, i) => {
                const events = w.events;
                const eventDisplay = events ? await tg(guildId, 'antinuke.eventsCount', { count: events.length }) : allEvents;
                return tg(guildId, 'antinuke.whitelistEntry', { index: i + 1, user: `<@${w.userId}>`, events: eventDisplay });
            }));
            listContent = entries.join('\n');
        }

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'antinuke.whitelistTitle', { count: whitelist.length })}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(listContent)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.whitelistDetailedHint'))
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('antinuke_whitelist_add_btn')
                        .setLabel('Add User')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('antinuke_whitelist_remove_btn')
                        .setLabel('Remove User')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('antinuke_whitelist_list_btn')
                        .setLabel('Detailed List')
                        .setStyle(ButtonStyle.Secondary)
                )
            );

        return interactionOrMessage.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }
};

async function showWhitelistDetailed(interactionOrMessage, guild) {
    const guildId = guild.id;
    const whitelist = await AntinukeWhitelist.findAll({ where: { guildId: guild.id } });

    if (whitelist.length === 0) {
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'antinuke.whitelistTitle', { count: 0 })}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.noUsersWhitelisted'))
            );
        return interactionOrMessage.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }

    let detailedContent = '';
    for (const w of whitelist) {
        const events = w.events;
        let eventList;
        if (!events || events.length === 0) {
            eventList = '`All Events`';
        } else {
            eventList = events.map(e => `\`${EVENTS[e] || e}\``).join(', ');
        }
        detailedContent += `<@${w.userId}>\n${eventList}\n\n`;
    }

    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'antinuke.whitelistDetailedTitle', { count: whitelist.length })}`)
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(detailedContent.trim())
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('antinuke_whitelist_add_btn')
                    .setLabel('Add User')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('antinuke_whitelist_remove_btn')
                    .setLabel('Remove User')
                    .setStyle(ButtonStyle.Danger)
            )
        );

    return interactionOrMessage.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
}
