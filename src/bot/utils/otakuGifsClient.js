


// Thin client for the OtakuGifs public API (https://otakugifs.xyz, base
// https://api.otakugifs.xyz). Two endpoints are used:
//   GET /gif/allreactions          -> { reactions: ["hug", "kiss", ...] }
//   GET /gif?reaction=X&format=gif -> { url: "https://cdn.otakugifs.xyz/gifs/hug/xxxx.gif" }
// No API key, rate limit, or attribution requirement is documented by the
// project; this client still applies a short timeout and an hourly cache on
// the reaction list so we don't hammer the endpoint unnecessarily.

const axios = require('axios');

const BASE_URL = 'https://api.otakugifs.xyz';
const REQUEST_TIMEOUT_MS = 5000;
const REACTIONS_TTL_MS = 60 * 60 * 1000; // 1 hour

// Hardcoded fallback in case the allreactions endpoint is unreachable on the
// very first call (e.g. at process startup while building autocomplete
// choices). Sourced from the project's documented reaction list.
const FALLBACK_REACTIONS = [
  'airkiss', 'angrystare', 'bite', 'bleh', 'blush', 'brofist', 'celebrate', 'cheers', 'clap',
  'confused', 'cool', 'cry', 'cuddle', 'dance', 'drool', 'evillaugh', 'facepalm', 'handhold',
  'happy', 'headbang', 'hug', 'huh', 'kiss', 'laugh', 'lick', 'love', 'mad', 'nervous', 'no',
  'nom', 'nosebleed', 'nuzzle', 'nyah', 'pat', 'peek', 'pinch', 'poke', 'pout', 'punch', 'roll',
  'run', 'sad', 'scared', 'shout', 'shrug', 'shy', 'sigh', 'sing', 'sip', 'slap', 'sleep',
  'slowclap', 'smack', 'smile', 'smug', 'sneeze', 'sorry', 'stare', 'stop', 'surprised', 'sweat',
  'thumbsup', 'tickle', 'tired', 'wave', 'wink', 'woah', 'yawn', 'yay', 'yes',
];

let reactionsCache = {
  reactions: null,
  fetchedAt: 0,
};

/**
 * Returns the full list of reaction category keys supported by the API.
 * Cached in memory for up to an hour; falls back to a stale cache (or the
 * hardcoded list) if the live request fails, so callers always get an array.
 */
async function listReactions() {
  const now = Date.now();
  if (reactionsCache.reactions && now - reactionsCache.fetchedAt < REACTIONS_TTL_MS) {
    return reactionsCache.reactions;
  }

  try {
    const response = await axios.get(`${BASE_URL}/gif/allreactions`, {
      timeout: REQUEST_TIMEOUT_MS,
    });
    const reactions = response.data && response.data.reactions;
    if (Array.isArray(reactions) && reactions.length > 0) {
      reactionsCache = { reactions, fetchedAt: now };
      return reactions;
    }
  } catch (error) {
    // Network error, timeout, or bad response - degrade gracefully below.
  }

  if (reactionsCache.reactions) return reactionsCache.reactions;
  return FALLBACK_REACTIONS;
}

/**
 * Checks whether a given reaction key is currently supported by the API.
 */
async function isValidReaction(reaction) {
  if (!reaction || typeof reaction !== 'string') return false;
  const reactions = await listReactions();
  return reactions.includes(reaction.toLowerCase());
}

/**
 * Fetches a random GIF URL for the given reaction category.
 * Returns null on any failure (network error, unknown category, rate limit)
 * so callers can degrade to a text-only reply instead of throwing.
 */
async function getGif(reaction) {
  if (!reaction || typeof reaction !== 'string') return null;

  try {
    const response = await axios.get(`${BASE_URL}/gif`, {
      params: { reaction: reaction.toLowerCase(), format: 'gif' },
      timeout: REQUEST_TIMEOUT_MS,
    });
    const url = response.data && response.data.url;
    return typeof url === 'string' && url.length > 0 ? url : null;
  } catch (error) {
    return null;
  }
}

module.exports = {
  listReactions,
  isValidReaction,
  getGif,
  FALLBACK_REACTIONS,
};
