export const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
export const GUILD_PLACEHOLDER = '/guild-placeholder.svg';

// discord.js ChannelType numeric enum values we care about
export const CHANNEL_TYPES = {
  GuildText: 0,
  GuildVoice: 2,
  GuildCategory: 4,
  GuildAnnouncement: 5,
  GuildStageVoice: 13,
  GuildForum: 15
};

export const TEXT_LIKE_TYPES = [
  CHANNEL_TYPES.GuildText,
  CHANNEL_TYPES.GuildAnnouncement,
  CHANNEL_TYPES.GuildForum
];

export const VOICE_LIKE_TYPES = [CHANNEL_TYPES.GuildVoice, CHANNEL_TYPES.GuildStageVoice];

export function textChannels(channels) {
  return (channels || []).filter((c) => TEXT_LIKE_TYPES.includes(c.type));
}

export function voiceChannels(channels) {
  return (channels || []).filter((c) => VOICE_LIKE_TYPES.includes(c.type));
}

export function categoryChannels(channels) {
  return (channels || []).filter((c) => c.type === CHANNEL_TYPES.GuildCategory);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function relativeTimeFromNow(ms) {
  if (!ms) return '—';
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  const label =
    minutes < 60
      ? `${minutes}m`
      : minutes < 1440
      ? `${Math.round(minutes / 60)}h`
      : `${Math.round(minutes / 1440)}d`;
  return diff >= 0 ? `in ${label}` : `${label} ago`;
}

export function intToHex(value) {
  if (value === null || value === undefined) return '#6366f1';
  const n = Number(value);
  if (Number.isNaN(n)) return '#6366f1';
  return `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
}

export function hexToInt(hex) {
  if (!hex) return 0;
  const cleaned = hex.replace('#', '');
  const n = parseInt(cleaned, 16);
  return Number.isNaN(n) ? 0 : n;
}

export function isMeaningfulRoleColor(color) {
  return !!color && color.toLowerCase() !== '#000000';
}

export function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const SNOWFLAKE_RE = /^[0-9]{15,22}$/;

export function isValidSnowflake(value) {
  return typeof value === 'string' && SNOWFLAKE_RE.test(value.trim());
}

export function isAccessError(err) {
  return err && (err.status === 403 || err.status === 404);
}
