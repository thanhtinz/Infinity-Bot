const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    SectionBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} = require('discord.js');
const { FarewellConfig } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

module.exports = {
    name: 'config',
    description: 'View farewell configuration',

    async execute(interactionOrMessage) {
        const member = interactionOrMessage.member;
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;

        if (!member.permissions.has('Administrator')) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'farewell.noPermission'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        try {
            const config = await FarewellConfig.findOne({ where: { guildId: guild.id } });

            if (!config) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'farewell.configTitle')}`)
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(await tg(guildId, 'farewell.configNotFound'))
                    );
                return interactionOrMessage.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const notSet = await tg(guildId, 'farewell.configNotSet');
            const channelDisplay = config.channelId ? `<#${config.channelId}>` : `\`${notSet}\``;
            const typeDisplay = config.type === 'container' ? await tg(guildId, 'farewell.typeContainer') : await tg(guildId, 'farewell.typeSimple');

            if (config.type === 'simple') {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'farewell.configTitle')}`)
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            await tg(guildId, 'farewell.configSimpleBody', {
                                type: typeDisplay,
                                channel: channelDisplay,
                                message: config.message || `\`${notSet}\``,
                            })
                        )
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(await tg(guildId, 'farewell.configHint'))
                    );

                return interactionOrMessage.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            } else {
                const container = new ContainerBuilder();
                const defaultTitle = await tg(guildId, 'farewell.defaultTitle');
                const noDescription = await tg(guildId, 'farewell.noDescriptionSet');

                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${config.title || defaultTitle}`)
                );

                container.addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                );

                const isValidUrl = (url) => url && (url.startsWith('http://') || url.startsWith('https://'));

                if (isValidUrl(config.thumbnailUrl)) {
                    const section = new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(config.description || noDescription)
                        )
                        .setThumbnailAccessory(
                            new ThumbnailBuilder().setURL(config.thumbnailUrl)
                        );
                    container.addSectionComponents(section);
                } else {
                    container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(config.description || noDescription)
                    );
                }

                if (isValidUrl(config.imageUrl)) {
                    container.addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    );
                    container.addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                            new MediaGalleryItemBuilder().setURL(config.imageUrl)
                        )
                    );
                }

                const infoContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'farewell.configTitle')}`)
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            await tg(guildId, 'farewell.configContainerBody', { type: typeDisplay, channel: channelDisplay })
                        )
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(await tg(guildId, 'farewell.configHint'))
                    );

                return interactionOrMessage.reply({
                    components: [container, infoContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }

        } catch (error) {
            console.error('Farewell config error:', error);
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'farewell.configError'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }
    }
};
