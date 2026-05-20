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
  language?: string;
  // Currency & Payment
  currency?: string;
  currency_symbol?: string;
  payment_methods?: string[];
  has_paypal_client_id?: boolean;
  has_paypal_client_secret?: boolean;
  paypal_mode?: string;
  has_crypto_api_key?: boolean;
  crypto_provider?: string;
  manual_qr_image_id?: string;
  manual_bank_name?: string;
  manual_account_holder?: string;
  manual_account_number?: string;
  manual_instructions?: string;
  // Flash Sale + Leaderboard + Inventory
  flash_sale_channel_id?: string;
  spending_leaderboard_channel_id?: string;
  spending_leaderboard_schedule?: string;
  spending_leaderboard_time?: string;
  inventory_low_stock_threshold?: number;
}

export interface ProductPackage {
  name: string;
  price: number;
  active: boolean;
  use_inventory?: boolean;
  auto_buy?: boolean;
}

export interface ProductCategory {
  id: number;
  guild_id: string;
  name: string;
  emoji?: string;
  sort_order: number;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  note?: string;
  emoji?: string;
  category_id?: number;
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
