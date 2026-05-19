export type ApiStatus = "checking" | "connected" | "error";

export interface HealthResponse {
  ok: boolean;
}

export interface SystemConfig {
  id: number;
  discord_token?: string;
  discord_client_id?: string;
  payos_client_id?: string;
  payos_api_key?: string;
  payos_checksum_key?: string;
  guild_id?: string;
  admin_role_id?: string;
  don_hang_channel_id?: string;
  feedback_channel_id?: string;
  coupon_channel_id?: string;
  bang_gia_channel_id?: string;
  welcome_channel_id?: string;
  bot_status: string;
  bot_invisible?: boolean;
  has_discord_token?: boolean;
  has_discord_client_secret?: boolean;
  has_payos_api_key?: boolean;
  has_payos_checksum_key?: boolean;
  command_prefix?: string;
  public_app_url?: string;
  support_server_url?: string;
}

export interface ProductPackage {
  name: string;
  price: number;
  active: boolean;
  use_inventory?: boolean;
  auto_buy?: boolean;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  note?: string;
  emoji?: string;
  packages: ProductPackage[];
  active: boolean;
  price: number; // legacy
}

export interface Order {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  total_price: number;
  status: string;
  payos_order_code?: string;
  checkout_url?: string;
  package_name?: string;
  created_at: string;
  user_discord_id?: string;
  user_username?: string;
  product_name?: string;
}
