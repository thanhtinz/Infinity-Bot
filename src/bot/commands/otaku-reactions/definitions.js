// ---------------------------------------------------------------------------
// Static snapshot of the OtakuGifs (https://otakugifs.xyz) reaction category
// list, classified into hybrid (slash + prefix) commands.
//
// Snapshot taken from a live call to listReactions() (src/bot/utils/
// otakuGifsClient.js) on 2026-07-04 - 70 categories. Command *registration*
// is intentionally static (this file) so the bot doesn't depend on a live
// API call at startup; only the actual GIF fetch at runtime
// (otakuGifsClient.getGif) hits the network. If OtakuGifs adds/removes
// categories, re-run `node scripts/generate-otaku-reactions.js` after
// refreshing this list from listReactions().
//
// mode:
//   'self'   - an expression/action not inherently done TO someone
//              (e.g. "happy", "cry", "dance").
//   'target' - an action naturally directed at another (optional) user
//              (e.g. "hug", "kiss", "pat"). The user option is always
//              optional; omitting it falls back to a "sent into the void"
//              style message (see src/bot/utils/otakuReactionFactory.js).
//
// Name-collision note: none of these 70 categories collide with an existing
// *important* top-level command (moderation commands like kick/ban/mute/warn
// were checked specifically - none appear in the live category list, so
// nothing was skipped or renamed for that reason).
//
// One incidental overlap exists: src/bot/pCommands/roleplay/*.js (the
// nekos.best-backed prefix half of `!roleplay <sub>`) happens to also
// register bare top-level prefix triggers for 19 of these names (hug, kiss,
// pat, slap, tickle, poke, dance, cry, laugh, smile, blush, wink, thumbsup,
// facepalm, shrug, sleep, run, lick, clap) due to a loader quirk unrelated to
// this change. That's exactly the behavior requested here (see the task's
// own `/kiss` + `!kiss` example) - the new hybrid commands below load after
// pCommands and take over those bare prefix triggers, while
// `/roleplay <sub>` (slash) and its nekos.best GIFs are untouched.
// ---------------------------------------------------------------------------

const definitions = [
  { name: 'airkiss', mode: 'target', description: 'Blow an air kiss at someone', aliases: [] },
  { name: 'angrystare', mode: 'target', description: 'Give someone an angry stare', aliases: [] },
  { name: 'bite', mode: 'target', description: 'Bite someone', aliases: [] },
  { name: 'bleh', mode: 'self', description: 'Stick your tongue out, bleh!', aliases: [] },
  { name: 'blush', mode: 'self', description: 'Blush', aliases: [] },
  { name: 'brofist', mode: 'target', description: 'Bro-fist someone', aliases: [] },
  { name: 'celebrate', mode: 'self', description: 'Celebrate!', aliases: [] },
  { name: 'cheers', mode: 'target', description: 'Cheers to someone', aliases: [] },
  { name: 'clap', mode: 'self', description: 'Clap', aliases: [] },
  { name: 'confused', mode: 'self', description: 'Look confused', aliases: [] },
  { name: 'cool', mode: 'self', description: 'Act cool', aliases: [] },
  { name: 'cry', mode: 'self', description: 'Cry', aliases: [] },
  { name: 'cuddle', mode: 'target', description: 'Cuddle with someone', aliases: [] },
  { name: 'dance', mode: 'self', description: 'Dance!', aliases: [] },
  { name: 'drool', mode: 'self', description: 'Drool', aliases: [] },
  { name: 'evillaugh', mode: 'self', description: 'Laugh evilly', aliases: [] },
  { name: 'facepalm', mode: 'self', description: 'Facepalm', aliases: [] },
  { name: 'handhold', mode: 'target', description: 'Hold hands with someone', aliases: [] },
  { name: 'happy', mode: 'self', description: 'Feel happy', aliases: [] },
  { name: 'headbang', mode: 'self', description: 'Headbang', aliases: [] },
  { name: 'hug', mode: 'target', description: 'Give someone a warm hug', aliases: [] },
  { name: 'huh', mode: 'self', description: 'Look puzzled, huh?', aliases: [] },
  { name: 'kiss', mode: 'target', description: 'Kiss someone', aliases: [] },
  { name: 'laugh', mode: 'self', description: 'Laugh out loud', aliases: [] },
  { name: 'lick', mode: 'target', description: 'Lick someone', aliases: [] },
  { name: 'love', mode: 'target', description: 'Send some love to someone', aliases: [] },
  { name: 'mad', mode: 'self', description: 'Get mad', aliases: [] },
  { name: 'nervous', mode: 'self', description: 'Feel nervous', aliases: [] },
  { name: 'no', mode: 'self', description: 'Say no', aliases: [] },
  { name: 'nom', mode: 'target', description: 'Nom on someone', aliases: [] },
  { name: 'nosebleed', mode: 'self', description: 'Get a nosebleed', aliases: [] },
  { name: 'nuzzle', mode: 'target', description: 'Nuzzle someone', aliases: [] },
  { name: 'nyah', mode: 'self', description: 'Nyah~', aliases: [] },
  { name: 'pat', mode: 'target', description: 'Pat someone', aliases: [] },
  { name: 'peek', mode: 'self', description: 'Peek', aliases: [] },
  { name: 'pinch', mode: 'target', description: 'Pinch someone', aliases: [] },
  { name: 'poke', mode: 'target', description: 'Poke someone', aliases: [] },
  { name: 'pout', mode: 'self', description: 'Pout', aliases: [] },
  { name: 'punch', mode: 'target', description: 'Punch someone', aliases: [] },
  { name: 'roll', mode: 'self', description: 'Roll your eyes', aliases: [] },
  { name: 'run', mode: 'self', description: 'Run!', aliases: [] },
  { name: 'sad', mode: 'self', description: 'Feel sad', aliases: [] },
  { name: 'scared', mode: 'self', description: 'Feel scared', aliases: [] },
  { name: 'shout', mode: 'target', description: 'Shout at someone', aliases: [] },
  { name: 'shrug', mode: 'self', description: 'Shrug', aliases: [] },
  { name: 'shy', mode: 'self', description: 'Feel shy', aliases: [] },
  { name: 'sigh', mode: 'self', description: 'Sigh', aliases: [] },
  { name: 'sing', mode: 'self', description: 'Sing', aliases: [] },
  { name: 'sip', mode: 'self', description: 'Sip your tea', aliases: [] },
  { name: 'slap', mode: 'target', description: 'Slap someone', aliases: [] },
  { name: 'sleep', mode: 'self', description: 'Go to sleep', aliases: [] },
  { name: 'slowclap', mode: 'self', description: 'Give a slow clap', aliases: [] },
  { name: 'smack', mode: 'target', description: 'Smack someone', aliases: [] },
  { name: 'smile', mode: 'self', description: 'Smile', aliases: [] },
  { name: 'smug', mode: 'self', description: 'Look smug', aliases: [] },
  { name: 'sneeze', mode: 'self', description: 'Sneeze', aliases: [] },
  { name: 'sorry', mode: 'target', description: 'Apologize to someone', aliases: [] },
  { name: 'stare', mode: 'target', description: 'Stare at someone', aliases: [] },
  { name: 'stop', mode: 'target', description: 'Tell someone to stop', aliases: [] },
  { name: 'surprised', mode: 'self', description: 'Look surprised', aliases: [] },
  { name: 'sweat', mode: 'self', description: 'Sweat nervously', aliases: [] },
  { name: 'thumbsup', mode: 'self', description: 'Give a thumbs up', aliases: [] },
  { name: 'tickle', mode: 'target', description: 'Tickle someone', aliases: [] },
  { name: 'tired', mode: 'self', description: 'Feel tired', aliases: [] },
  { name: 'wave', mode: 'target', description: 'Wave at someone', aliases: [] },
  { name: 'wink', mode: 'self', description: 'Wink', aliases: [] },
  { name: 'woah', mode: 'self', description: 'Woah!', aliases: [] },
  { name: 'yawn', mode: 'self', description: 'Yawn', aliases: [] },
  { name: 'yay', mode: 'self', description: 'Yay!', aliases: [] },
  { name: 'yes', mode: 'self', description: 'Say yes', aliases: [] },
];

module.exports = definitions;
