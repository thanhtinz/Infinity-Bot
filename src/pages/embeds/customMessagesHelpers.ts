import type { CustomEmbed, EmbedData, CustomFormState, ComponentButton, ActionRow, EmbedOpenState } from "./embedTypes";

export const emptyButton = (): ComponentButton => ({ type: 2, style: 2, label: "Button" });
export const emptyRow = (): ActionRow => ({ type: 1, components: [emptyButton()] });

export const emptyEmbed = (): EmbedData => ({
  title: "",
  description: "",
  color: "#5865F2",
  author: "",
  author_icon_url: "",
  footer: "",
  thumbnail_url: "",
  image_url: "",
  fields: [],
});

export const emptyCustomForm: CustomFormState = {
  name: "",
  content: "",
  webhook_username: "",
  webhook_avatar_url: "",
  thread_name: "",
  embeds: [emptyEmbed()],
  components: [],
  flags: {},
  allowed_mentions: {},
};

/** Migrate from flat fields (old DB) to embeds array */
export function migrateToEmbeds(data: CustomEmbed): EmbedData[] {
  if (data.embeds && data.embeds.length > 0) {
    return data.embeds.map((e) => ({ ...e, fields: e.fields?.map((f) => ({ ...f })) ?? [] }));
  }
  return [{
    title: data.title ?? "",
    description: data.description ?? "",
    color: data.color ?? "#5865F2",
    author: data.author ?? "",
    author_icon_url: data.author_icon_url ?? "",
    footer: data.footer ?? "",
    thumbnail_url: data.thumbnail_url ?? "",
    image_url: data.image_url ?? "",
    fields: data.fields?.map((f) => ({ ...f })) ?? [],
  }];
}

export const defaultEmbedOpen = (): EmbedOpenState => ({ main: true, author: false, images: false, fields: true });
