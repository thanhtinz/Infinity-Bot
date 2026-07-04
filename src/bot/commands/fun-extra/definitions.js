


// ---------------------------------------------------------------------------
// Fun Extra command definitions
//
// A large batch of small flavor-text "fun" commands, ported and reimagined
// from Pogy-Bot's Fun/ command set (used with permission). None of these
// duplicate the hand-built roleplay (/roleplay hug|slap|...) or fun
// (/fun dare|truth|meme|rizz|simprate|howgay|howdumb|pickup|...) commands
// already present in this codebase - this batch focuses on the "-rate"
// percentage generators, text transforms, and random prompt/randomizer
// commands that were NOT already covered.
//
// Each entry is consumed by createFunCommand() (see ../../utils/funCommandFactory.js)
// and turned into a real slash command by scripts/generate-fun-commands.js.
// ---------------------------------------------------------------------------

const definitions = [];

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Register a "rating" command: /<name> [user] -> random 1-100% + themed verdict.
 */
function rate(name, title, description, theme, custom = {}) {
  definitions.push({
    name,
    mode: 'rating',
    title,
    description,
    scale: theme,
    high: custom.high || [
      `Certified ${theme} icon, no notes.`,
      `Peak ${theme} energy achieved.`,
      `They wrote the entire textbook on being ${theme}.`,
    ],
    mid: custom.mid || [
      `Solid ${theme} vibes, a respectable showing.`,
      `Dabbling in ${theme} territory, not bad at all.`,
      `A believable, if unremarkable, amount of ${theme}.`,
    ],
    low: custom.low || [
      `Barely any ${theme} detected.`,
      `${capitalize(theme)}? Never heard of them.`,
      `Practically allergic to being ${theme}.`,
    ],
  });
}

/**
 * Register a "target_action" command: /<name> <user> -> random flavor line.
 */
function targetAction(name, title, description, templates, opts = {}) {
  definitions.push({
    name,
    mode: 'target_action',
    title,
    description,
    templates,
    ...opts,
  });
}

/**
 * Register a "prompt" command: /<name> -> random single line of text.
 */
function prompt(name, title, description, prompts, opts = {}) {
  definitions.push({
    name,
    mode: 'prompt',
    title,
    description,
    prompts,
    ...opts,
  });
}

/**
 * Register a "randomizer" command: /<name> -> pick one item from a list.
 */
function randomizer(name, title, description, items, opts = {}) {
  definitions.push({
    name,
    mode: 'randomizer',
    title,
    description,
    items,
    ...opts,
  });
}

/**
 * Register a "transform" command: /<name> <text> -> manipulated text.
 */
function transform(name, title, description, key) {
  definitions.push({
    name,
    mode: 'transform',
    title,
    description,
    transform: key,
  });
}

// ===========================================================================
// RATING commands ("-rate" percentage generators)
// ===========================================================================

rate('geniusrate', 'Genius Rate', 'Check someone\'s genius level.', 'genius', {
  high: ['Certified once-in-a-generation big brain.', 'Out here solving problems nobody asked about.', 'Basically a walking encyclopedia at this point.'],
  mid: ['Smart enough to be dangerous with a whiteboard.', 'Occasionally drops a take that actually lands.'],
  low: ['Forgot how their own phone works this morning.', 'Genius is... a strong word for this one.'],
});

rate('trollrate', 'Troll Rate', 'Check someone\'s troll level.', 'troll', {
  high: ['Would bait an entire server for one laugh.', 'Lives rent-free in everyone\'s notifications.', 'Certified chaos gremlin with a keyboard.'],
  mid: ['Drops the occasional bait but knows when to stop.'],
  low: ['Too wholesome to troll anyone, honestly.'],
});

rate('cursedrate', 'Cursed Rate', 'Check how cursed someone is.', 'cursed', {
  high: ['Radiates energy that should not be legal.', 'Their search history is a biohazard.'],
  mid: ['Mildly haunted, nothing a priest can\'t fix.'],
  low: ['Blessed, actually. Suspiciously blessed.'],
});

rate('basedrate', 'Based Rate', 'Check how based someone is.', 'based', {
  high: ['Unshakably, undeniably based.', 'Prints their opinions on a t-shirt and wears it proudly.'],
  mid: ['Based in moderation, which is oddly respectable.'],
  low: ['Not based. Not even a little.'],
});

rate('feralrate', 'Feral Rate', 'Check someone\'s feral energy.', 'feral', {
  high: ['Unleashed. Someone get the net.', 'Feral energy off the charts, do not approach.'],
  mid: ['A little unhinged after 10pm, otherwise fine.'],
  low: ['Domesticated. Boring. Housebroken.'],
});

rate('npcrate', 'NPC Rate', 'Check how much of an NPC someone is.', 'NPC', {
  high: ['Says the same three lines on loop.', 'Confirmed background character in this server.'],
  mid: ['Occasionally breaks the script, mostly follows it.'],
  low: ['Certified main character energy.'],
});

rate('villainrate', 'Villain Rate', 'Check someone\'s villain arc progress.', 'villain', {
  high: ['Currently mid-monologue in a lair somewhere.', 'Twirls a mustache that does not exist.'],
  mid: ['Morally grey and proud of it.'],
  low: ['Way too nice to ever pull off a villain arc.'],
});

rate('wizardrate', 'Wizard Rate', 'Check someone\'s wizard potential.', 'wizard', {
  high: ['Casts spells nobody asked for and it works anyway.', 'Owns a staff and is not afraid to use it.'],
  mid: ['Knows a few tricks, still working on the robe budget.'],
  low: ['Could not summon a spark if their life depended on it.'],
});

rate('piraterate', 'Pirate Rate', 'Check someone\'s pirate energy.', 'pirate', {
  high: ['Ready to sail off with the server\'s snack budget.', 'Owns a parrot in spirit if not in fact.'],
  mid: ['Would absolutely say "arr" under the right conditions.'],
  low: ['Gets seasick thinking about the ocean.'],
});

rate('vampirerate', 'Vampire Rate', 'Check someone\'s vampire energy.', 'vampire', {
  high: ['Has not seen sunlight since last Tuesday.', 'Drains the group chat\'s energy without trying.'],
  mid: ['Mildly nocturnal, mostly by accident.'],
  low: ['Practically solar powered.'],
});

rate('goblinrate', 'Goblin Rate', 'Check someone\'s goblin energy.', 'goblin', {
  high: ['Hoards snacks like they are rare loot.', 'Feral little creature, do not feed after midnight.'],
  mid: ['Mildly gremlin-coded on weekends.'],
  low: ['Too well-mannered to be a goblin.'],
});

rate('savagerate', 'Savage Rate', 'Check someone\'s savage level.', 'savage', {
  high: ['Roasts people without even trying.', 'Zero chill detected in the system.'],
  mid: ['Occasionally savage, mostly by accident.'],
  low: ['Wholesome to a fault.'],
});

rate('spookyrate', 'Spooky Rate', 'Check someone\'s spooky energy.', 'spooky', {
  high: ['Haunts the server at 3am unprompted.', 'Gives off genuine horror-movie energy.'],
  mid: ['A little eerie, mostly harmless.'],
  low: ['Not scary at all, kind of a golden retriever.'],
});

rate('sillyrate', 'Silly Rate', 'Check someone\'s silly level.', 'silly', {
  high: ['Peak goofball, certified clown behavior.', 'Cannot be taken seriously for even one message.'],
  mid: ['Silly on occasion, serious the rest of the time.'],
  low: ['Deadly serious at all times, unfortunately.'],
});

rate('mysteriousrate', 'Mysterious Rate', 'Check someone\'s mysterious aura.', 'mysterious', {
  high: ['Nobody knows their real backstory and it stays that way.', 'Speaks in riddles even when ordering food.'],
  mid: ['A little cryptic, mostly an open book.'],
  low: ['Shares literally everything, zero mystery left.'],
});

rate('royaltyrate', 'Royalty Rate', 'Check someone\'s royal energy.', 'royalty', {
  high: ['Walks in like the server owes them tribute.', 'Should legally be addressed as "Your Majesty".'],
  mid: ['Has main-character posture, minor royal energy.'],
  low: ['Peasant behavior, respectfully.'],
});

rate('menacerate', 'Menace Rate', 'Check someone\'s menace-to-society level.', 'menace', {
  high: ['A genuine menace to society, in the fun way.', 'Chaos follows them into every voice channel.'],
  mid: ['Mildly menacing before their morning coffee.'],
  low: ['Harmless. Certified sweetheart.'],
});

rate('sleepyrate', 'Sleepy Rate', 'Check someone\'s sleepy level.', 'sleepy', {
  high: ['Has fallen asleep mid-sentence at least twice today.', 'Runs on naps and vibes alone.'],
  mid: ['Yawns occasionally, still functional.'],
  low: ['Wide awake and disgustingly energetic.'],
});

rate('hotrate', 'Hot Take Rate', 'Check how spicy someone\'s takes are.', 'hot-take', {
  high: ['Every opinion starts a small war in chat.', 'Their takes should come with a fire extinguisher.'],
  mid: ['Occasionally controversial, mostly reasonable.'],
  low: ['Every opinion is safe, agreeable, and a little boring.'],
});

rate('luckyrate', 'Lucky Rate', 'Check someone\'s luck level.', 'lucky', {
  high: ['Wins the giveaway they forgot they entered.', 'Four-leaf clovers grow wherever they walk.'],
  mid: ['Averagely lucky, wins some, loses some.'],
  low: ['Would lose a coin flip against themselves.'],
});

rate('magicrate', 'Magic Rate', 'Check someone\'s magical potential.', 'magical', {
  high: ['Sparkles follow them into every call.', 'Definitely secretly a wizard, no further questions.'],
  mid: ['Has a few tricks up their sleeve, literally.'],
  low: ['Entirely mundane, not a spark of magic.'],
});

rate('memerate', 'Meme Rate', 'Check how meme-worthy someone is.', 'meme-worthy', {
  high: ['Living meme, screenshots itself.', 'Their reactions alone belong in a compilation.'],
  mid: ['Posts a decent meme every now and then.'],
  low: ['Never once produced a quotable moment.'],
});

rate('nerdrate', 'Nerd Rate', 'Check someone\'s nerd level.', 'nerd', {
  high: ['Has a spreadsheet for their spreadsheets.', 'Could give a TED talk on their special interest right now.'],
  mid: ['Nerdy about exactly one thing, normal about everything else.'],
  low: ['Could not name a single fun fact if asked.'],
});

rate('overthinkrate', 'Overthink Rate', 'Check someone\'s overthinking level.', 'overthinker', {
  high: ['Reread that one message eleven times before replying.', 'Has three backup plans for a coin flip.'],
  mid: ['Overthinks the big stuff, ignores the small stuff.'],
  low: ['Sends messages with zero hesitation, ever.'],
});

rate('scaryrate', 'Scary Rate', 'Check someone\'s scary factor.', 'scary', {
  high: ['Could headline their own horror franchise.', 'Silence from them is the scariest thing in chat.'],
  mid: ['A little intimidating, mostly a teddy bear.'],
  low: ['About as scary as a golden retriever puppy.'],
});

rate('schemerate', 'Schemer Rate', 'Check someone\'s scheming potential.', 'scheming', {
  high: ['Has a five-step plan for everything, including snacks.', 'Definitely plotting something right now.'],
  mid: ['Schemes occasionally, mostly harmless plots.'],
  low: ['Too straightforward to ever scheme.'],
});

rate('smoothrate', 'Smooth Rate', 'Check someone\'s smoothness.', 'smooth', {
  high: ['Talks their way out of anything, every time.', 'Smoother than freshly buffered audio.'],
  mid: ['Smooth on a good day, awkward the rest.'],
  low: ['Trips over their own words constantly.'],
});

rate('swagrate', 'Swag Rate', 'Check someone\'s swag level.', 'swag', {
  high: ['Drips confidence just by typing "hello".', 'Certified server fashion icon.'],
  mid: ['Has swag in small, controlled doses.'],
  low: ['Swag levels critically low, send help.'],
});

rate('driprate', 'Drip Rate', 'Check someone\'s drip level.', 'drip', {
  high: ['Outfit could headline a runway show.', 'Fits so clean it should be studied.'],
  mid: ['Decent fit, nothing groundbreaking.'],
  low: ['Wardrobe malfunction energy at all times.'],
});

rate('classyrate', 'Classy Rate', 'Check someone\'s classiness.', 'classy', {
  high: ['Sips tea with their pinky out, unironically.', 'Could attend a gala without embarrassing anyone.'],
  mid: ['Classy in public, chaotic in private.'],
  low: ['Would eat cereal with a fork, no shame.'],
});

rate('cornyrate', 'Corny Rate', 'Check someone\'s corniness.', 'corny', {
  high: ['Dad jokes on demand, no cooldown.', 'Corny to the point of being a public safety hazard.'],
  mid: ['Drops one corny line per conversation, tops.'],
  low: ['Never once told a corny joke in their life.'],
});

rate('awkwardrate', 'Awkward Rate', 'Check someone\'s awkwardness.', 'awkward', {
  high: ['Waves back at someone who was waving at another person.', 'Peak secondhand-embarrassment generator.'],
  mid: ['Awkward in small bursts, recovers quickly.'],
  low: ['Smooth talker, zero awkward moments recorded.'],
});

rate('babyrate', 'Baby Rate', 'Check how babied someone acts.', 'babied', {
  high: ['Needs a nap and a juice box immediately.', 'Cries over minor inconveniences, full toddler energy.'],
  mid: ['Occasionally needs coddling, mostly independent.'],
  low: ['Fully grown, emotionally mature adult behavior.'],
});

rate('brainrate', 'Brain Rate', 'Check someone\'s brainpower.', 'brainy', {
  high: ['Big brain moves only, no notes.', 'Thinks three steps ahead of everyone else.'],
  mid: ['Smart in bursts, questionable the rest of the time.'],
  low: ['Brain cells took the day off.'],
});

rate('coolrate', 'Cool Rate', 'Check someone\'s coolness.', 'cool', {
  high: ['Effortlessly cool, does not even try.', 'Could walk out of an explosion without looking back.'],
  mid: ['Cool most days, cringe on others.'],
  low: ['Tries way too hard, and it shows.'],
});

rate('dangerousrate', 'Dangerous Rate', 'Check how dangerous someone is.', 'dangerous', {
  high: ['A genuine hazard to server peace.', 'Should come with a warning label.'],
  mid: ['Dangerous in a mild, mostly-legal way.'],
  low: ['Harmless. Wouldn\'t hurt a fly.'],
});

rate('deviousrate', 'Devious Rate', 'Check someone\'s devious energy.', 'devious', {
  high: ['Devious minded, up to absolutely no good.', 'Grinning about a plan nobody else knows about.'],
  mid: ['A little devious when the mood strikes.'],
  low: ['Too innocent to be devious about anything.'],
});

rate('energyrate', 'Energy Rate', 'Check someone\'s energy level.', 'energetic', {
  high: ['Runs on an endless supply of caffeine and chaos.', 'Could power the whole server with enthusiasm alone.'],
  mid: ['Energetic in short, respectable bursts.'],
  low: ['Running on fumes and vibes.'],
});

rate('evilrate', 'Evil Rate', 'Check someone\'s evil level.', 'evil', {
  high: ['Twirling a mustache in their mind at all times.', 'Would absolutely push the big red button.'],
  mid: ['Mildly evil before their morning coffee.'],
  low: ['Wholesome to the core, no evil detected.'],
});

rate('fashionrate', 'Fashion Rate', 'Check someone\'s fashion sense.', 'fashionable', {
  high: ['Could walk a runway blindfolded.', 'Outfit choices belong in a magazine.'],
  mid: ['Decent fashion sense, nothing to write home about.'],
  low: ['Fashion emergency, please send backup.'],
});

rate('focusrate', 'Focus Rate', 'Check someone\'s focus level.', 'focused', {
  high: ['Laser-focused, could ignore a fire alarm.', 'Zoned in like a monk on a deadline.'],
  mid: ['Focused for about ten minutes at a time.'],
  low: ['Distracted by literally anything shiny.'],
});

rate('funnyrate', 'Funny Rate', 'Check how funny someone is.', 'funny', {
  high: ['Could headline a comedy show tonight.', 'Everything they say ends up quoted for weeks.'],
  mid: ['Funny on a good day, quiet on the rest.'],
  low: ['Comedic timing needs some serious work.'],
});

rate('geekrate', 'Geek Rate', 'Check someone\'s geek level.', 'geeky', {
  high: ['Has strong opinions about fictional lore.', 'Could recite an entire wiki page from memory.'],
  mid: ['Geeky about one specific thing, casual otherwise.'],
  low: ['Could not tell you what a wiki even is.'],
});

rate('ghostrate', 'Ghost Rate', 'Check someone\'s ghosting tendencies.', 'ghost', {
  high: ['Reads the message and simply vanishes.', 'Harder to reach than a customer service line.'],
  mid: ['Occasionally slow to reply, mostly responsive.'],
  low: ['Replies within seconds, every single time.'],
});

rate('goofyrate', 'Goofy Rate', 'Check someone\'s goofiness.', 'goofy', {
  high: ['Trips over air on a regular basis.', 'Certified full-time goofball.'],
  mid: ['Goofy in small, manageable doses.'],
  low: ['Serious business, zero goofiness on file.'],
});

rate('gremlinrate', 'Gremlin Rate', 'Check someone\'s gremlin energy.', 'gremlin', {
  high: ['Feeds after midnight and causes chaos on schedule.', 'Small, chaotic, and impossible to predict.'],
  mid: ['Gremlin mode activates occasionally.'],
  low: ['Far too well-behaved to be a gremlin.'],
});

rate('grumpyrate', 'Grumpy Rate', 'Check someone\'s grumpiness.', 'grumpy', {
  high: ['Grumpy before coffee, grumpy after coffee.', 'Could out-grump a tired cat.'],
  mid: ['Grumpy in the mornings, fine by noon.'],
  low: ['Relentlessly cheerful, somehow.'],
});

rate('happyrate', 'Happy Rate', 'Check someone\'s happiness level.', 'happy', {
  high: ['Radiates joy strong enough to fix a bad day.', 'Smiling for no reason at all, and it works.'],
  mid: ['Happy enough, having a fine day.'],
  low: ['Storm cloud energy, needs a hug.'],
});

rate('heroicrate', 'Heroic Rate', 'Check someone\'s heroic potential.', 'heroic', {
  high: ['Would run into a burning building for a snack.', 'Main character in their own origin story.'],
  mid: ['Heroic when it is convenient.'],
  low: ['Would let the group chat burn down for peace and quiet.'],
});

rate('partyrate', 'Party Rate', 'Check someone\'s party energy.', 'party', {
  high: ['The event does not start until they show up.', 'Could turn a Tuesday into a full celebration.'],
  mid: ['Shows up, has fun, leaves at a reasonable hour.'],
  low: ['Would rather be asleep by 9pm.'],
});

rate('patiencerate', 'Patience Rate', 'Check someone\'s patience level.', 'patient', {
  high: ['Could wait out a loading screen with a smile.', 'Zen master levels of calm under pressure.'],
  mid: ['Patient until the third repeat question.'],
  low: ['Patience ran out somewhere around message two.'],
});

rate('powerrate', 'Power Rate', 'Check someone\'s power level.', 'powerful', {
  high: ['Power level immeasurable, scouter just exploded.', 'Could probably arm-wrestle a small planet.'],
  mid: ['Decent power level, nothing world-ending.'],
  low: ['Power level barely registers on the scale.'],
});

rate('socialrate', 'Social Rate', 'Check someone\'s social battery.', 'social', {
  high: ['Talks to everyone, everywhere, always.', 'Social battery permanently stuck at 100%.'],
  mid: ['Social in small doses, then needs a nap.'],
  low: ['Social battery drained just reading this.'],
});

rate('spicyrate', 'Spicy Rate', 'Check how spicy someone\'s personality is.', 'spicy', {
  high: ['Personality could set off a smoke alarm.', 'Every message comes with a heat warning.'],
  mid: ['Mild spice, easy to handle.'],
  low: ['About as spicy as plain white bread.'],
});

rate('starrate', 'Star Rate', 'Check someone\'s star power.', 'star', {
  high: ['Main character lighting follows them everywhere.', 'Certified server celebrity.'],
  mid: ['Has a moment in the spotlight now and then.'],
  low: ['Extra number four in the background, respectfully.'],
});

rate('susrate', 'Sus Rate', 'Check how sus someone is.', 'sus', {
  high: ['Definitely venting right now, no cap.', 'Acting mad suspicious for someone with nothing to hide.'],
  mid: ['A little sus, could go either way.'],
  low: ['Confirmed not the impostor.'],
});

rate('sweetheartrate', 'Sweetheart Rate', 'Check how sweet someone is.', 'sweet', {
  high: ['Sweet enough to cause a cavity.', 'Certified server sweetheart, protect at all costs.'],
  mid: ['Sweet on good days, spicy on others.'],
  low: ['Needs a sugar refill immediately.'],
});

rate('teamrate', 'Team Player Rate', 'Check someone\'s team player energy.', 'team-player', {
  high: ['Carries the whole squad without complaint.', 'MVP of every group project, no contest.'],
  mid: ['Pulls their weight most of the time.'],
  low: ['Ghosts the group project the second it starts.'],
});

rate('zombierate', 'Zombie Rate', 'Check someone\'s zombie energy.', 'zombie', {
  high: ['Shuffles around before coffee, groaning quietly.', 'Running purely on brains and vibes.'],
  mid: ['Zombie mode activates after 10pm only.'],
  low: ['Wide awake and disturbingly alert.'],
});

rate('alienrate', 'Alien Rate', 'Check someone\'s alien energy.', 'alien', {
  high: ['Definitely not from this planet, the vibes confirm it.', 'Communicates in ways no human understands.'],
  mid: ['A little otherworldly on weekends.'],
  low: ['Painfully, boringly human.'],
});

rate('adorablerate', 'Adorable Rate', 'Check how adorable someone is.', 'adorable', {
  high: ['Certified server cutie, no contest.', 'Adorable enough to be declared a protected species.'],
  mid: ['Cute in short bursts, chaotic the rest.'],
  low: ['Adorable levels critically low today.'],
});

rate('agentrate', 'Secret Agent Rate', 'Check someone\'s secret agent energy.', 'secret-agent', {
  high: ['Definitely has a hidden earpiece right now.', 'Could disappear from a call without a trace.'],
  mid: ['Mysterious enough to raise one eyebrow.'],
  low: ['Would blow their cover within five seconds.'],
});

rate('beastrate', 'Beast Rate', 'Check someone\'s beast mode.', 'beast', {
  high: ['Beast mode permanently switched on.', 'Could bench press the entire group chat.'],
  mid: ['Beast mode activates occasionally, then naps.'],
  low: ['Beast mode currently in hibernation.'],
});

rate('bossrate', 'Boss Rate', 'Check someone\'s boss energy.', 'boss', {
  high: ['Walks in like they own the whole server.', 'Final boss music plays when they join a call.'],
  mid: ['Boss energy on payday only.'],
  low: ['Intern energy, respectfully.'],
});

rate('calmrate', 'Calm Rate', 'Check someone\'s calmness.', 'calm', {
  high: ['Nothing rattles them, ever. Zen incarnate.', 'Could nap through a fire drill.'],
  mid: ['Calm until the third notification ping.'],
  low: ['Panics over a typo in the group chat.'],
});

rate('chaoticrate', 'Chaotic Rate', 'Check someone\'s chaos level.', 'chaotic', {
  high: ['Pure chaos energy, unfiltered and unbothered.', 'Enters a room and the vibes immediately shift.'],
  mid: ['Chaotic on weekends, orderly on weekdays.'],
  low: ['Organized, calm, and suspiciously predictable.'],
});

rate('clownrate', 'Clown Rate', 'Check someone\'s clown behavior.', 'clown', {
  high: ['Honks a horn nobody can hear but them.', 'Certified full-time circus act.'],
  mid: ['Clowns around occasionally, mostly serious.'],
  low: ['Way too composed to ever clown.'],
});

rate('angryrate', 'Angry Rate', 'Check someone\'s anger levels.', 'angry', {
  high: ['One notification away from combusting.', 'Rage levels reaching critical mass.'],
  mid: ['Mildly annoyed, mostly fine.'],
  low: ['Too chill to ever get mad about anything.'],
});

rate('chaoscorerate', 'Chaos Score', 'Check someone\'s chaos score.', 'chaotic', {
  high: ['Chaos score off the leaderboard entirely.', 'Single-handedly ends server peace on a whim.'],
  mid: ['Moderate chaos, mostly contained.'],
  low: ['Peaceful, orderly, borderline suspicious.'],
});

// ===========================================================================
// TARGET_ACTION commands (not covered by /roleplay or /fun)
// ===========================================================================

targetAction('admire', 'Admire', 'Admire someone from across the server.', [
  '**{actor}** admires **{target}** like they just solved the whole server.',
  '**{actor}** stares at **{target}** in quiet, unwavering admiration.',
  '**{actor}** thinks **{target}** deserves an award for just existing today.',
], { blockSelf: false });

targetAction('adopt', 'Adopt', 'Adopt someone into your found family.', [
  '**{actor}** officially adopts **{target}**. Welcome to the family.',
  '**{actor}** signs the paperwork and adopts **{target}** on the spot.',
], { blockSelf: false });

targetAction('ambush', 'Ambush', 'Jump out and ambush someone.', [
  '**{actor}** ambushes **{target}** from behind a potted plant.',
  '**{actor}** leaps out of nowhere and ambushes **{target}**.',
], { blockSelfMessage: 'You cannot ambush yourself, that is just standing still.' });

targetAction('annoy', 'Annoy', 'Annoy someone relentlessly.', [
  '**{actor}** pokes **{target}** repeatedly until they respond.',
  '**{actor}** hums the same three notes near **{target}** on loop.',
]);

targetAction('applaud', 'Applaud', 'Give someone a round of applause.', [
  '**{actor}** gives **{target}** a standing ovation.',
  '**{actor}** claps enthusiastically for **{target}**.',
], { blockSelf: false });

targetAction('arrest', 'Arrest', 'Arrest someone for crimes against the server.', [
  '**{actor}** arrests **{target}** for excessive use of caps lock.',
  '**{actor}** slaps handcuffs on **{target}** and reads them their rights.',
]);

targetAction('awaken', 'Awaken', 'Awaken someone\'s inner power.', [
  '**{actor}** awakens something ancient inside **{target}**.',
  '**{actor}** unlocks **{target}**\'s final form with a single tap.',
], { blockSelf: false });

targetAction('backstab', 'Backstab', 'Backstab someone when they least expect it.', [
  '**{actor}** backstabs **{target}** when they least expected it.',
  '**{actor}** waits for the perfect moment to betray **{target}**.',
]);

targetAction('blindfold', 'Blindfold', 'Blindfold someone for a surprise.', [
  '**{actor}** blindfolds **{target}** and leads them somewhere mysterious.',
]);

targetAction('blame', 'Blame', 'Blame someone for everything that went wrong.', [
  '**{actor}** blames **{target}** for the server outage. Classic.',
  '**{actor}** points directly at **{target}**. It was them all along.',
]);

targetAction('boop', 'Boop', 'Boop someone on the nose.', [
  '**{actor}** boops **{target}** right on the nose.',
], { blockSelf: false });

targetAction('bump', 'Bump', 'Bump into someone by accident (on purpose).', [
  '**{actor}** bumps into **{target}** and does not apologize.',
]);

targetAction('caress', 'Caress', 'Gently caress someone\'s face.', [
  '**{actor}** gently caresses **{target}**\'s cheek.',
]);

targetAction('carry', 'Carry', 'Carry someone off dramatically.', [
  '**{actor}** scoops up **{target}** and carries them off dramatically.',
], { blockSelf: false });

targetAction('charm', 'Charm', 'Try to charm someone.', [
  '**{actor}** attempts to charm **{target}** with a wink and a smirk.',
  '**{actor}** turns on the charm for **{target}**. It is not working.',
]);

targetAction('chase', 'Chase', 'Chase someone around the server.', [
  '**{actor}** chases **{target}** around the whole server.',
]);

targetAction('cheer', 'Cheer', 'Cheer someone up.', [
  '**{actor}** cheers **{target}** up with an overly enthusiastic pep talk.',
], { blockSelf: false });

targetAction('cherish', 'Cherish', 'Cherish someone forever.', [
  '**{actor}** decides to cherish **{target}** forever, no take-backs.',
], { blockSelf: false });

targetAction('coddle', 'Coddle', 'Coddle someone like a tiny baby.', [
  '**{actor}** coddles **{target}** like a tiny, fragile baby.',
], { blockSelf: false });

targetAction('comfort', 'Comfort', 'Comfort someone having a rough day.', [
  '**{actor}** wraps an arm around **{target}** and offers some comfort.',
], { blockSelf: false });

targetAction('confront', 'Confront', 'Confront someone about their behavior.', [
  '**{actor}** confronts **{target}** about the group chat drama.',
]);

targetAction('congratulate', 'Congratulate', 'Congratulate someone on their achievement.', [
  '**{actor}** congratulates **{target}** on a job well done.',
], { blockSelf: false });

targetAction('cradle', 'Cradle', 'Cradle someone gently.', [
  '**{actor}** cradles **{target}** gently like something precious.',
], { blockSelf: false });

targetAction('crown', 'Crown', 'Crown someone royalty for the day.', [
  '**{actor}** places a crown on **{target}**\'s head. All hail.',
], { blockSelf: false });

targetAction('debate', 'Debate', 'Start a heated debate with someone.', [
  '**{actor}** challenges **{target}** to a heated debate over nothing important.',
]);

targetAction('defend', 'Defend', 'Defend someone in an argument.', [
  '**{actor}** steps in to defend **{target}** against all odds.',
], { blockSelf: false });

targetAction('devour', 'Devour', 'Devour someone\'s last snack.', [
  '**{actor}** devours **{target}**\'s last snack without asking.',
]);

targetAction('disown', 'Disown', 'Disown someone dramatically.', [
  '**{actor}** dramatically disowns **{target}** in front of everyone.',
]);

targetAction('drag', 'Drag', 'Drag someone into a call.', [
  '**{actor}** drags **{target}** into the voice call, kicking and screaming.',
]);

targetAction('duel', 'Duel', 'Challenge someone to a duel.', [
  '**{actor}** challenges **{target}** to a duel at dawn.',
]);

targetAction('elbow', 'Elbow', 'Elbow someone to get their attention.', [
  '**{actor}** elbows **{target}** to get their attention.',
]);

targetAction('enlighten', 'Enlighten', 'Enlighten someone with wisdom.', [
  '**{actor}** enlightens **{target}** with a truth they were not ready for.',
], { blockSelf: false });

targetAction('escort', 'Escort', 'Escort someone out politely.', [
  '**{actor}** politely escorts **{target}** out of the conversation.',
]);

targetAction('feed', 'Feed', 'Feed someone a snack.', [
  '**{actor}** feeds **{target}** a snack, no questions asked.',
], { blockSelf: false });

targetAction('fistbump', 'Fist Bump', 'Give someone a fist bump.', [
  '**{actor}** and **{target}** share an explosive fist bump.',
], { blockSelf: false });

targetAction('interrogate', 'Interrogate', 'Interrogate someone under a bright light.', [
  '**{actor}** interrogates **{target}** under a suspiciously bright lamp.',
]);

targetAction('kidnap', 'Kidnap', 'Kidnap someone (affectionately).', [
  '**{actor}** kidnaps **{target}** and demands snacks as ransom.',
]);

targetAction('praise', 'Praise', 'Shower someone with praise.', [
  '**{actor}** showers **{target}** with over-the-top praise.',
], { blockSelf: false });

targetAction('protect', 'Protect', 'Protect someone at all costs.', [
  '**{actor}** vows to protect **{target}** at all costs.',
], { blockSelf: false });

targetAction('scold', 'Scold', 'Scold someone for their behavior.', [
  '**{actor}** scolds **{target}** like a disappointed parent.',
]);

targetAction('tackle', 'Tackle', 'Tackle someone out of nowhere.', [
  '**{actor}** tackles **{target}** clean off their feet.',
]);

targetAction('threaten', 'Threaten', 'Threaten someone (not seriously).', [
  '**{actor}** threatens **{target}** with mild, non-serious consequences.',
]);

targetAction('roast', 'Roast', 'Roast a user (all in good fun).', [
  '**{actor}** roasts **{target}** until the smoke alarm notices.',
  '**{actor}** delivers a roast so clean, **{target}** needs a minute.',
  '**{actor}** roasts **{target}** with zero survivors.',
]);

targetAction('worship', 'Worship', 'Worship someone as a deity.', [
  '**{actor}** builds a small shrine to worship **{target}**.',
], { blockSelf: false });

// ===========================================================================
// PROMPT commands (random single-line question/statement)
// ===========================================================================

prompt('chaosquestion', 'Chaos Question', 'Get a random chaotic hypothetical to answer.', [
  'If you could delete one app from everyone\'s phone forever, which one goes first?',
  'You get one free "get out of trouble" card for life. When are you using it?',
  'What is the pettiest reason you have ever stopped talking to someone?',
  'If the server had a villain arc, who is causing it and why?',
  'What harmless rule would you break just to see what happens?',
]);

prompt('bucketlist', 'Bucket List', 'Get a random bucket-list style prompt.', [
  'What is one thing you would do if you knew you could not fail?',
  'What is a completely useless skill you would love to master?',
  'What is one place you would drop everything to visit tomorrow?',
  'What is something wildly ambitious you have secretly planned?',
  'What is a small thing you have always wanted to try but never have?',
]);

prompt('dreamjob', 'Dream Job', 'Get a random dream job prompt.', [
  'If money did not matter at all, what job would you actually want?',
  'What is a job you would be terrible at but would still love to try?',
  'What is your dream job if it had to involve snacks somehow?',
  'What career would past-you be shocked present-you almost picked?',
]);

prompt('showerthought', 'Shower Thought', 'Get a random shower thought.', [
  'Technically, a hot dog is a taco if you squint hard enough.',
  'You have never actually seen your own face, only reflections and photos of it.',
  'The "any" key does not exist, and yet everyone understands what it means.',
  'Cereal is just cold soup with a marketing budget.',
  'Every time you learn something new, some part of you gets slightly less wrong.',
]);

prompt('moraldilemma', 'Moral Dilemma', 'Get a random moral dilemma to argue about.', [
  'Is it wrong to eat the last slice if nobody said it was reserved?',
  'If a friend asks for honest feedback, do they actually want honesty?',
  'Is skipping the line okay if you are only grabbing one thing?',
  'Would you tell a friend their partner is cheating if you were not 100% sure?',
]);

prompt('confession', 'Confession', 'Get a random anonymous-style confession prompt.', [
  'Confess: what is a food combination you love that everyone judges you for?',
  'Confess: what is the smallest lie you have told this week?',
  'Confess: what is a show or song you pretend not to like?',
  'Confess: what is something you do that you would never admit out loud... until now.',
]);

prompt('fakeheadline', 'Fake Headline', 'Generate a random fake breaking-news headline.', [
  '"Local server user declares war over one misplaced comma."',
  '"Scientists baffled after group chat reaches consensus for the first time ever."',
  '"Man discovers 4am is not, in fact, a productive time to start projects."',
  '"Breaking: entire friend group agrees on where to eat, historians stunned."',
]);

prompt('debatebait', 'Debate Bait', 'Get a random topic guaranteed to start an argument.', [
  'Is a sandwich still a sandwich if it is open-faced?',
  'Does pineapple actually belong on pizza, final answer only.',
  'Is it socially acceptable to text back "k" and nothing else?',
  'Should cereal be considered a soup?',
]);

prompt('bestiecheck', 'Bestie Check', 'Get a random best-friend loyalty question.', [
  'Would your best friend drop everything to help you move? Be honest.',
  'What is one secret only your closest friend actually knows?',
  'Who would you trust to housesit without any hesitation?',
  'Who in this server feels like an instant bestie?',
]);

prompt('apocalypseplan', 'Apocalypse Plan', 'Get a random apocalypse survival prompt.', [
  'What is your role in the group during a zombie apocalypse?',
  'What useless skill would somehow become critical after the apocalypse?',
  'Who in this server would betray the group first for supplies?',
  'What is the one item you are absolutely not leaving behind?',
]);

prompt('firstimpression', 'First Impression', 'Get a random first-impression question.', [
  'What is a first impression you had about someone that turned out completely wrong?',
  'What do you think people assume about you within the first ten seconds?',
  'What is the best first impression you have ever made, on purpose or not?',
]);

prompt('crushquestion', 'Crush Question', 'Get a random crush-related question.', [
  'What is the most obvious sign someone has a crush on you?',
  'What is a small gesture that instantly gives you butterflies?',
  'What is one red flag you always ignore anyway?',
]);

prompt('hottake', 'Hot Take', 'Get a random spicy hot take prompt.', [
  'Share a hot take that would get you muted at Thanksgiving dinner.',
  'What is a wildly unpopular opinion you will die defending?',
  'What is something everyone loves that you just do not get?',
]);

prompt('redflag', 'Red Flag Check', 'Get a random red-flag-spotting prompt.', [
  'What is a red flag people somehow still ignore?',
  'What is the biggest red flag in a first conversation?',
  'What behavior instantly makes you lose interest in someone?',
]);

prompt('greenflag', 'Green Flag Check', 'Get a random green-flag prompt.', [
  'What is an underrated green flag people do not talk about enough?',
  'What is a small habit that instantly makes someone more likeable?',
  'What is one green flag you look for immediately?',
]);

prompt('conspiracytheory', 'Conspiracy Theory', 'Get a random harmless conspiracy theory.', [
  'Birds are government drones sent to monitor snack consumption.',
  'Autocorrect is sentient and mildly annoyed at all of us.',
  'The "loading..." screen is just buying time to judge your life choices.',
  'Group chats go quiet at the exact moment someone needs a reply the most, on purpose.',
]);

prompt('villainorigin', 'Villain Origin Story', 'Get a random villain origin story prompt.', [
  'What small, petty inconvenience would finally turn you into a villain?',
  'What is the exact moment your villain origin story would begin?',
  'What would your villain catchphrase be?',
]);

prompt('unpopularopinion', 'Unpopular Opinion', 'Get a random prompt for an unpopular opinion.', [
  'Share an unpopular opinion about food that will start an argument.',
  'What widely loved movie or show do you think is actually mid?',
  'What is a popular trend you simply refuse to participate in?',
]);

prompt('letter2self', 'Letter To Past Self', 'Get a random letter-to-past-self prompt.', [
  'What is one thing you would tell yourself from exactly one year ago?',
  'What warning would you give your past self about this week?',
  'What would surprise your past self the most about who you are now?',
]);

prompt('wouldyourather', 'Would You Rather', 'Get a random would-you-rather dilemma.', [
  'Would you rather always be 10 minutes late or always 20 minutes early?',
  'Would you rather lose all your photos or all your saved messages?',
  'Would you rather have autocorrect read your mind or never work again?',
  'Would you rather always know when someone is lying, or never get caught lying yourself?',
]);

// ===========================================================================
// RANDOMIZER commands (pick one item from a list)
// ===========================================================================

randomizer('fortune', 'Fortune', 'Crack open a random fortune.', [
  'A lucky interruption is coming your way.',
  'Someone is going to quote you out of context very soon.',
  'A bad idea will somehow work out perfectly.',
  'Today rewards bold, slightly unnecessary decisions.',
  'You are about to overthink something extremely small.',
  'An unexpected snack will fix everything today.',
  'Your next notification will be more dramatic than expected.',
], { intro: 'Your fortune for today:' });

randomizer('magic8', 'Magic 8-Ball', 'Shake the magic 8-ball for an answer.', [
  'Absolutely yes.',
  'No chance.',
  'Ask again later.',
  'Only if you commit fully.',
  'That sounds risky but fun.',
  'Signs point to yes.',
  'Outlook not so good.',
  'It is decidedly so.',
  'Do not count on it.',
], { intro: 'The magic 8-ball says:' });

randomizer('randomjob', 'Random Job', 'Roll a completely random career.', [
  'Potion tester',
  'Arcade owner',
  'Meteorologist',
  'Night-shift DJ',
  'Food critic',
  'Museum thief (professional)',
  'Cereal mascot',
  'Competitive nap taker',
  'Rubber duck quality inspector',
], { intro: 'Your new career:' });

randomizer('randomexcuse', 'Random Excuse', 'Generate a random emergency excuse.', [
  'My internet developed trust issues.',
  'The timeline rejected my plan entirely.',
  'I got trapped in a side quest.',
  'The group chat took me hostage.',
  'A pigeon judged me and I had to leave.',
  'My alarm clock staged a rebellion.',
  'I was legally required to finish that episode first.',
], { intro: 'Emergency excuse generated:' });

randomizer('randomsuperpower', 'Random Superpower', 'Roll a random (mostly useless) superpower.', [
  'The ability to always find the TV remote.',
  'Perfect Wi-Fi signal, everywhere, forever.',
  'Knowing exactly when the microwave will beep.',
  'Never stepping on a Lego again.',
  'Instantly winning every rock-paper-scissors match.',
  'Always picking the fastest checkout line.',
], { intro: 'Your randomly assigned superpower:' });

randomizer('randomnickname', 'Random Nickname', 'Roll a random ridiculous nickname.', [
  'Captain Chaos',
  'The Snack Goblin',
  'Sir Procrastinates-a-Lot',
  'Duchess of Overthinking',
  'The Silent Menace',
  'Professor Nonsense',
], { intro: 'Your new nickname:' });

randomizer('randomvillain', 'Random Villain Name', 'Roll a random dramatic villain name.', [
  'Doctor Mischief',
  'The Crimson Overthinker',
  'Lord Petty',
  'The Notification Reaper',
  'Madame Chaos',
  'The Silent Saboteur',
], { intro: 'Your villain name is:' });

randomizer('randomquest', 'Random Quest', 'Roll a random tiny quest to complete.', [
  'Send a compliment to the last person who messaged you.',
  'Type your next message in all lowercase.',
  'Use only emojis for your next reply.',
  'Post your current mood as a single word.',
  'Ask the group a random "would you rather" question.',
], { intro: 'Your quest:' });

randomizer('randomweather', 'Random Weather Report', 'Get a random absurd weather report.', [
  'Cloudy with a 70% chance of chaos.',
  '100% humidity, 0% motivation.',
  'Sunny with scattered vibes.',
  'A light drizzle of bad decisions expected later.',
  'Clear skies, heavy traffic of intrusive thoughts.',
], { intro: 'Today\'s forecast:' });

randomizer('randommood', 'Random Mood', 'Roll a random mood for the day.', [
  'Chaotic but productive.',
  'Feral energy, low patience.',
  'Suspiciously calm.',
  'Ready to overthink everything.',
  'Main character energy activated.',
  'Running entirely on spite and snacks.',
], { intro: 'Today\'s assigned mood:' });

randomizer('randomspell', 'Random Spell', 'Cast a random (harmless) magic spell.', [
  'Snackus Summonus - instantly craves a snack.',
  'Wifius Maximus - boosts internet speed by pure willpower.',
  'Sleepus Interruptus - guarantees a notification at 3am.',
  'Chaosus Unleashus - mild chaos, nothing illegal.',
  'Confidencia Momentus - temporary main character energy.',
], { intro: 'The spell cast is:' });

randomizer('randomband', 'Random Band Name', 'Roll a random fictional band name.', [
  'The Overthinking Committee',
  'Snack Attack Collective',
  'Lag Spike Alliance',
  'The Group Chat Ghosts',
  'Petty But Professional',
], { intro: 'Your band name is:' });

randomizer('dailyquote', 'Daily Quote', 'Roll a random questionable daily quote.', [
  '"Not all who wander have Wi-Fi." - Anonymous',
  '"Sleep is for those without notifications." - Anonymous',
  '"Do or do not, there is no snooze." - Anonymous',
  '"Chaos is just organization nobody explained yet." - Anonymous',
], { intro: 'Quote of the day:' });

randomizer('petname', 'Random Pet Name', 'Roll a random ridiculous pet name.', [
  'Sir Fluffington III',
  'Chaos Nugget',
  'Biscuit the Menace',
  'Noodle Supreme',
  'Captain Whiskers',
], { intro: 'Your pet\'s new name:' });

randomizer('randomteam', 'Random Team Name', 'Roll a random competitive team name.', [
  'The Undefeated Overthinkers',
  'Squad Goals Malfunction',
  'The Snack Time Alliance',
  'Chaos Coordinated',
  'The Lag Spike Legends',
], { intro: 'Your team name is:' });

randomizer('randomtitle', 'Random Title', 'Roll a random overblown title for yourself.', [
  'Supreme Overlord of Snacks',
  'Grand Duke of Group Chats',
  'Minister of Minor Chaos',
  'Ambassador of Overthinking',
  'Keeper of the Server Vibes',
], { intro: 'Your new official title:' });

randomizer('randomdrink', 'Random Drink Order', 'Roll a random chaotic drink order.', [
  'A coffee with more sugar than coffee.',
  'Water, but make it dramatic.',
  'Whatever is closest and does not require effort.',
  'Something with too many syllables in the name.',
  'Straight caffeine, no dilution.',
], { intro: 'Your order:' });

randomizer('randompickuptruck', 'Random Getaway Vehicle', 'Roll a random dramatic escape vehicle.', [
  'A shopping cart with one bad wheel.',
  'A golf cart, stolen with confidence.',
  'A skateboard held together by hope.',
  'A suspiciously fast office chair.',
], { intro: 'Your getaway vehicle:' });

randomizer('coinflip', 'Coin Flip', 'Flip a coin.', ['Heads', 'Tails'], { intro: 'The coin landed on:' });

randomizer('diceroll', 'Dice Roll', 'Roll a six-sided die.', ['1', '2', '3', '4', '5', '6'], { intro: 'You rolled a:' });

randomizer('randomanimalpick', 'Random Spirit Animal', 'Roll a random spirit animal.', [
  'A raccoon with a plan.',
  'A cat that judges silently.',
  'An overly confident chihuahua.',
  'A sloth running on main character energy.',
  'An owl that stays up way too late.',
], { intro: 'Your spirit animal is:' });

// ===========================================================================
// TRANSFORM commands (text manipulation)
// ===========================================================================

transform('uppercase', 'Uppercase Text', 'Convert text to UPPERCASE.', 'uppercase');
transform('lowercase', 'Lowercase Text', 'Convert text to lowercase.', 'lowercase');
transform('reversetext', 'Reverse Text', 'Reverse a piece of text.', 'reverse');
transform('alternatetext', 'Alternating Case', 'Convert text to aLtErNaTiNg CaSe.', 'alternatecase');
transform('mockingcase', 'Mocking Case', 'Convert text to mOcKiNg case (SpongeBob style).', 'mockingcase');
transform('leetspeak', 'Leetspeak', 'Convert text to 1337sp34k.', 'leetspeak');
transform('claptext', 'Clap Text', 'Add 👏 claps 👏 between 👏 words.', 'clapcase');
transform('dottext', 'Dot Text', 'Separate words with dots.', 'dotcase');
transform('spacedtext', 'Spaced Out Text', 'S p a c e   o u t   t e x t.', 'spacedout');
transform('boxtext', 'Box Text', 'Wrap [e][a][c][h] letter in brackets.', 'boxtext');
transform('blockcaps', 'Block Caps', 'Convert text into spaced-out block capitals.', 'blockcaps');
transform('titlecase', 'Title Case', 'Convert Text To Title Case.', 'titlecase');
transform('sentencecase', 'Sentence case', 'Convert text to sentence case.', 'sentencecase');
transform('vowelspam', 'Vowel Spam', 'Streeetch out all the vooowels.', 'vowelspam');
transform('mirrorwords', 'Mirror Words', 'Reverse the order of words in a sentence.', 'mirrorwords');
transform('wavecase', 'Wave Case', 'Convert text into a wavy alternating pattern.', 'wavecase');
transform('slugtext', 'Slug Text', 'Convert text into a-url-friendly-slug.', 'slugtext');
transform('spoilertext', 'Spoiler Text', 'Wrap ||e|a|c|h|| letter in a spoiler tag.', 'spoilertext');

module.exports = definitions;
