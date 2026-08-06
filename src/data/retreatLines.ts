// Retreat lines — the one-beat dialogue shown when a player/ally unit
// is defeated in battle.
//
// Ravage has no permadeath. A "defeated" character is wounded out of
// the CURRENT fight — they count against the campaign loss budget
// (see MAX_PERMITTED_DEATHS) but are back, whole, the next battle.
// These beats reframe the fall in the character's own voice — a
// retreat, not a death — so the fiction matches the mechanic.
//
// Keyed by the character's portrait id. Lines are written
// scenario-agnostic so they read sensibly in any battle; one is
// picked at random per defeat. A character can only fall once per
// battle, so each line naturally shows at most once per fight.
//
// BattleScene fires buildRetreatBeat() through the DialogueDirector
// when a player/ally unit drops — gated so it does NOT fire on the
// final unit of a squad wipe (that is a defeat, not a retreat, and
// "I'll regroup" is absurd with no one left to regroup with).

import type { DialogBeat, PortraitId } from "../story/beats";

const RETREAT_LINES: Record<string, string[]> = {
  amar: [
    "That's the last of what I had. Pulling back. Hold the line without me. I'll be standing again by the next bell.",
    "Down, not done. Keep the formation tight. I'll regroup at the rear and you will not miss a step."
  ],
  lucian: [
    "...That one had my name on it. Falling back, and don't any of you do something stupid trying to cover the hole I leave.",
    "Old bones. I'm out of this one. Hold the line the way I taught you and I'll see you when it's quiet."
  ],
  ning: [
    "I can't — I can't hold it, I'm sorry. Pulling back. Don't let them through where I was standing —",
    "That's everything I've got. Falling back to the rear. Nobody else goes down, you hear me? Nobody."
  ],
  maya: [
    "I misjudged the angle. Withdrawing before it costs more than me. Cover the gap, east side, quickly.",
    "Down, and it was my own error to own. Pull the line tight without me. We still win this. Go."
  ],
  leo: [
    "The dactyl's worse off than I am. We're out, we're out. Regrouping. Finish it for both of us.",
    "That's us grounded. Falling back. Don't you dare lose this fight without me. I'll never hear the end of it."
  ],
  kian: [
    "Enough. I'm down. Hold what I was holding, and finish it cleanly. No flourishes.",
    "Falling back. Mind the line I leave. The King's men always read a gap before you do."
  ],
  rose: [
    "Down. Not done, just down. Go. The work doesn't clear itself and I'll be up before it's finished.",
    "I'm out of this one. Hold for Dawn. I'll be back on my feet before anyone needs the report."
  ],
  selene: [
    "...Cut deeper than I let it. Falling back. Hold the line. Finish what we came in for.",
    "I'm down. Don't break formation over me. Do the thing. I'll find you after."
  ],
  veya: [
    "Rig's cracked and so am I. Withdrawing. Mind the seams without me, they won't aim themselves.",
    "That's my lens arm gone. I grind, I don't bleed well. Back before the next inspection."
  ],
  corin: [
    "Horse is done and so is my shoulder. Falling back. Hold the line the way she taught Maya to.",
    "Unhorsed. I'll live, which is more than I planned for today. Ride on. Finish it."
  ],
  ranatoli: [
    "Bleed only what you can spare, and I have spared quite enough. Falling back. Hold.",
    "Down, not dead. Cover the gap I'm leaving. We feast together yet, all of us."
  ]
};

const DEFAULT_LINES = [
  "I can't hold. I'm pulling back. Don't wait on me; finish this.",
  "That's me done for this fight. Falling back. Watch the gap I'm leaving behind."
];

// Characters with a real portrait — only these get a portrait on the
// retreat beat; anything else falls back to a speaker-only beat.
const KNOWN_PORTRAITS = new Set(Object.keys(RETREAT_LINES));

// Build the one-beat retreat dialogue for a defeated player/ally unit.
// `charKey` is the unit's portrait id (or its id as a fallback);
// `unitName` is the display name shown as the speaker.
export const buildRetreatBeat = (charKey: string, unitName: string): DialogBeat => {
  const pool = RETREAT_LINES[charKey] ?? DEFAULT_LINES;
  const body = pool[Math.floor(Math.random() * pool.length)] ?? DEFAULT_LINES[0]!;
  const beat: DialogBeat = { speaker: unitName, body };
  if (KNOWN_PORTRAITS.has(charKey)) {
    beat.portraitId = charKey as PortraitId;
  }
  return beat;
};
