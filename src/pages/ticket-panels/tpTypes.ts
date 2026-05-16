export interface TicketButton {
  id?: number;
  label: string;
  emoji: string;
  style: string; // primary | secondary | success | danger
  category_id: string;
  form_id?: string;
}

export interface TicketPanel {
  id: number;
  guild_id?: string;
  channel_id?: string;
  message_id?: string;
  name: string;
  title?: string;
  description?: string;
  color?: string;
  created_at?: string;
  buttons: TicketButton[];
  naming_format?: string | null;
  open_message_title?: string | null;
  open_message_body?: string | null;
  close_message_title?: string | null;
  close_message_body?: string | null;
  claim_message_title?: string | null;
  claim_message_body?: string | null;
  group_id?: number | null;
}

export interface PanelForm {
  name: string;
  title: string;
  description: string;
  color: string;
  channel_id: string;
  buttons: TicketButton[];
  naming_format: string;
  open_message_title: string;
  open_message_body: string;
  close_message_title: string;
  close_message_body: string;
  claim_message_title: string;
  claim_message_body: string;
}

export interface ButtonForm {
  label: string;
  emoji: string;
  style: string;
  category_id: string;
  form_id: string;
}

export interface TicketPanelGroup {
  id: number;
  guild_id?: string;
  name: string;
  channel_id?: string;
  message_id?: string;
  title: string;
  description?: string;
  color: string;
  created_at?: string;
  is_sent: boolean;
  panel_ids: number[];
}

export interface PanelGroupForm {
  name: string;
  title: string;
  description: string;
  color: string;
  channel_id: string;
  panel_ids: number[];
}
