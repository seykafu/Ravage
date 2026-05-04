import type { DialogBeat, PortraitId } from "../story/beats";

// Camp idle dialogues — one short line per character per "era" of the
// campaign. Click a character at the camp; CampScene resolves the
// player's most recent completed battle into an era token, looks up
// the character's lines for that era, and runs BattleDialogueScene
// with a single beat. Reusing BattleDialogueScene avoids a redundant
// scene; the styling (portrait + dim battle behind, single dialog
// panel) translates perfectly to "click on Amar at the fire."
//
// Era resolution maps the most recent completed battle to a coarse
// chapter chunk so we don't have to author per-battle variants. The
// camp's subtitle in CampScene already varies per-battle; the spoken
// lines vary per-era for authoring tractability.

export type CampEra =
  | "pre_b1"           // No battles completed yet — the cold open
  | "post_b1"          // Hospital, Amar wakes alone
  | "post_thuling"     // B2-B4 era (Thuling settles in)
  | "post_field"       // B5-B7 era (Fergus's contracts)
  | "post_doubt"       // B8-B9 era (the truth about Fergus)
  | "post_para"        // B10 (leaving Thuling)
  | "crossing";        // B11+ (the Grude crossing begins)

export interface CampLine {
  body: string;
  expression?: string;
}

export interface CharacterCampTalk {
  characterId: string;
  // Display name for the speaker label in the dialog panel.
  name: string;
  // Portrait id used by BattleDialogueScene's portrait resolver.
  portraitId: PortraitId;
  // Per-era line lists. Each era can have 1-3 lines; a random one
  // surfaces on each click so repeated visits don't feel canned.
  // Eras the character isn't in the squad for are simply absent —
  // the resolver returns a fallback line in that case.
  eras: Partial<Record<CampEra, CampLine[]>>;
}

// ---- Dialogue authoring ----------------------------------------------------
// Each line is one quiet character moment — what they're thinking when
// the player walks up to them at the fire. State-aware where it matters
// (e.g. Amar processes his amnesia differently in post_b1 vs post_thuling)
// but mostly anchored to who the character IS.

export const CAMP_TALK: Record<string, CharacterCampTalk> = {
  // -------- AMAR --------
  amar: {
    characterId: "amar",
    name: "Amar",
    portraitId: "amar",
    eras: {
      pre_b1: [
        { body: "Tonight is the night, Selene says. The squad has been moving for ten months toward this hour. I've been moving for thirty years. I just don't remember most of them. (The hour drifts on.)", expression: "guarded" },
        { body: "Ranatoli's at the south door checking the hinge. Selene's at the east corridor. Khonu, Yul, Tev, Sera — they all know their post. Eight of us. Ten months. One night. (The moment holds.)", expression: "resolute" }
      ],
      post_b1: [
        { body: "I was a forge worker yesterday. I am a forge worker again tonight. I was something else for ten minutes in the throne hall and the something else still has my hands. (He says no more about it.)", expression: "wounded" },
        { body: "The doctor in the ward said I tried to walk with a sword that wasn't there. Three times in my sleep. He said it like it was funny. I'm trying not to think about it. (The fire crackles between the words.)", expression: "shocked" }
      ],
      post_thuling: [
        { body: "Lucian gave me a half-smile when I came back from the road. He hasn't asked. He hasn't NOT asked, either. I don't know which I'm more afraid of. (The silence holds.)", expression: "guarded" },
        { body: "Ning's getting better with the bow every week. Thirty arrows last night, all in the same hand-span on the target. She won't say it but she's proud. I'm proud for her. (A small smile.)", expression: "fatherly_smile" }
      ],
      post_field: [
        { body: "Fergus sent us against the mountain bandits and they had a sister waiting on the ridge. Nobody at the captain's tent told us about the sister. I've been thinking about the sister.", expression: "guarded" },
        { body: "Maya watches me when she thinks I'm not looking. She's not afraid. She's measuring. I'd rather she ask. I don't know what I'd say if she did. (The thought trails off.)", expression: "wounded" }
      ],
      post_doubt: [
        { body: "Fergus knew. The whole time. He sent us into Orinhal hoping the King would solve his problem for him. Lucian figured it out before I did. Lucian figures most things out before I do.", expression: "resolute" },
        { body: "I've been trying to remember the throne hall since the ravine. Pieces are coming back. Selene's voice. The carpet. King Nebu's face. I don't want most of it. I keep trying anyway. (The fire crackles low.)", expression: "wounded" }
      ],
      post_para: [
        { body: "Kian on the road outside Lucian's house, with a warrant in his hand and twelve men behind him. He looked tired in a way I'd never seen him look. We rode west and didn't look back. (He goes quiet for a while.)", expression: "wounded" },
        { body: "Mira and Tali made the cousin's farm. Lucian wrote a letter at the first inn and gave it to a courier. He didn't tell me what it said. I think it was a goodbye. (The kind goes unsaid.)", expression: "guarded" }
      ],
      crossing: [
        { body: "The harbor lights have been gone for an hour. The sea is the only thing in any direction. Lucian's wood practice sword is in my pack. I've taken it out twice and put it back. (He looks back at the sea.)", expression: "wounded" },
        { body: "Khione says fourteen months to Grude. Fourteen months to think about every name. Fourteen months to decide who I want to be when we land. I'll let you know what I come up with. (Half-smile.)", expression: "fatherly_smile" }
      ]
    }
  },
  // -------- LUCIAN -------- (in squad B2-B11; dies in post_cliffs)
  lucian: {
    characterId: "lucian",
    name: "Lucian",
    portraitId: "lucian",
    eras: {
      post_thuling: [
        { body: "The forge work's been thin this season but the squad eats. Mira keeps pretending she doesn't know how much I'm setting aside for the next quarter's tax. She knows. (Small smile.)", expression: "fatherly_smile" },
        { body: "Amar's been off since the throne hall. You see it. Don't ask him about it. He'll tell us when he's ready or he won't. Either way's all right with me.", expression: "grim_resolve" }
      ],
      post_field: [
        { body: "The captain who sent us against the mountain bandits — he sent us with five units against seven. He's done that twice this month. I've started keeping a count. (Quiet.)", expression: "grim_resolve" },
        { body: "Maya's reading us. Fine. She'll get to whatever she's after when she's ready. The squad is the squad regardless.", expression: "fatherly_smile" }
      ],
      post_doubt: [
        { body: "Mira and Tali. If something happens out here, your job is them. I've said it to Maya and to Ning too. You're on the list. Don't argue.", expression: "grim_resolve" },
        { body: "Ning took her first bolt-rescue this morning. Pushed me out of an archer's lane and gave me a black eye doing it. (Smile.) She'll do.", expression: "fatherly_smile" }
      ],
      post_para: [
        { body: "We rode out of Thuling at three in the morning. I haven't slept since. The cousin will move Mira and Tali north before sunrise. They'll be all right. (He doesn't quite believe it.)", expression: "grim_resolve" },
        { body: "Whatever happens at the cliffs, your highness — and don't tell me to stop calling you that — the squad needs to make the boat. That's the only thing that matters. We make the boat.", expression: "fatherly_smile" }
      ]
      // No crossing entries — Lucian dies in post_cliffs.
    }
  },
  // -------- NING --------
  ning: {
    characterId: "ning",
    name: "Ning",
    portraitId: "ning",
    eras: {
      post_thuling: [
        { body: "Thirty arrows tonight. I can hear them in the dark — I know which is mine. The bowyer in town said apprentices take a year to learn the sound. I learned it in two months. I think that's because I had to.", expression: "focused_bow" },
        { body: "Lucian doesn't say I did well. He says \"yes\" or \"no\" about whether the target dropped. \"Yes\" feels like a hand on my shoulder anyway.", expression: "startled" }
      ],
      post_field: [
        { body: "Maya saw me try a tighter draw last week and didn't say anything. Three days later she walked past my fletching bench and left a drift-feather quill on it without breaking stride. I think that's how she compliments people.", expression: "focused_bow" }
      ],
      post_doubt: [
        { body: "Lucian took a bolt for me in the ravine. I was standing in the lane and I didn't see the archer. I'm not standing in any more lanes I don't see. I've decided.", expression: "focused_bow" },
        { body: "Promotion took six minutes after the ravine. It felt like six years. I'm not the bowyer's apprentice anymore. I'm the squad's archer. (Quiet.) I'm ready to be that.", expression: "focused_bow" }
      ],
      post_para: [
        { body: "I covered the rear at Lucian's door with twelve arrows nocked in twelve seconds. Nobody got past me. Lucian made me confirm three times. He always does that. (Small smile.)", expression: "focused_bow" }
      ],
      crossing: [
        { body: "I didn't realize I was crying until Maya put a hand on my arm. Lucian was the first person who told me I was good at something. (Pause.) I'll write to Mira and Tali too. They should know what he was to us.", expression: "startled" }
      ]
    }
  },
  // -------- MAYA --------
  maya: {
    characterId: "maya",
    name: "Maya",
    portraitId: "maya",
    eras: {
      post_thuling: [
        { body: "The squad's tighter than the briefing suggested. Lucian holds it together. Amar holds himself apart. Ning holds her line. The shape's good for what's coming. (She doesn't elaborate on what's coming.)", expression: "calculating_side_glance" },
        { body: "Amar's footwork is from a courtyard, not a wagon yard. I haven't said it out loud. I might not for a while. He's listening for the question and I want to know what he does when I don't ask it.", expression: "calculating_side_glance" }
      ],
      post_field: [
        { body: "Took the south flank at the canyon ambush before Lucian called it. He didn't reprimand. He didn't praise either. He just adjusted around me. That's the version of trust I respect most.", expression: "guarded_neutral" },
        { body: "Leo's been off since the village we burned through last month. He keeps looking at the road south. He's going to make a call soon. I'll be ready when he does.", expression: "calculating_side_glance" }
      ],
      post_doubt: [
        { body: "Said it tonight. The whole truth. Dawn, the planting, eleven months of reading you all. Lucian smiled. Lucian. I hadn't expected that. I'd planned for a knife.", expression: "steel_cold_confession_face" },
        { body: "Ning won't take a bolt for anyone in the squad again, and she'll be the one who decides who's worth one. That's the right shape for what she is now.", expression: "guarded_neutral" }
      ],
      post_para: [
        { body: "The east watch caught me leaving the back gate of Lucian's house at 3:48 AM with Mira on one hip and Tali by the hand. She didn't recognize me. The makeup helped. Tali asked twice if I was a witch. I said yes. She seemed satisfied.", expression: "guarded_neutral" }
      ],
      crossing: [
        { body: "The flag was on the wall of his front room. I took it on the way out the back gate without thinking about why. I thought about why on the deck of the ship at dawn. I wrapped him in it. It was the right call.", expression: "steel_cold_confession_face" },
        { body: "Khione says fourteen months. I'm using it. Reading. Drawing maps from memory. By landfall I want to know Grude better than its tax officers do. (Half-smile.) Ask me about the upper district market in eight months.", expression: "calculating_side_glance" }
      ]
    }
  },
  // -------- LEO --------
  leo: {
    characterId: "leo",
    name: "Leo",
    portraitId: "leo",
    eras: {
      post_field: [
        { body: "Father sent me with the squad to test how I'd ride. I think he meant the dactyl. I think I've been testing how I ride in a different way than he meant.", expression: "ready" },
        { body: "Ndara escaped on a dactyl off the mountain ridge. She wheeled once before she went. I keep thinking about the wheel. The pause. The look down. (Quiet.) She knew what she was looking at.", expression: "resolute" }
      ],
      post_doubt: [
        { body: "Walked the dactyl to the partisan side at Orinhal. Out loud, in front of the King's men. I haven't been able to stop smiling about it. Don't tell Lucian I said that.", expression: "ready" },
        { body: "Father's letter caught up to us at the next inn. He didn't write what I expected him to write. He wrote what I'd hoped he would. I can't decide if that's harder.", expression: "resolute" }
      ],
      post_para: [
        { body: "Cleared the back lane in three minutes flat with the dactyl. Mira held on like she was born on a saddle. Tali asked if she could keep flying. (Smile.) I told her maybe later, kid.", expression: "ready" }
      ],
      crossing: [
        { body: "The dactyl doesn't like the deck. Won't sit. Khione says he'll settle by week three. The dactyl's the only one of us who hasn't lost anyone yet. Maybe that's why.", expression: "resolute" }
      ]
    }
  },
  // -------- KIAN -------- (in squad B4-B9; enemy from B10 onward)
  kian: {
    characterId: "kian",
    name: "Kian",
    portraitId: "kian",
    eras: {
      post_field: [
        { body: "The squad's footwork is improving. Even Amar's. Especially Amar's. (Knowing smile.) Funny how that works.", expression: "knowing_smile" },
        { body: "Fergus is sending us against harder targets each rotation. You see it. I see it. The question is whether we'll see it the same way when it matters. (Quiet.)", expression: "knowing_smile" }
      ]
      // No post_doubt or later — Kian leaves the squad before B10 to
      // act on the warrant. He's the boss of B10/B11.
    }
  }
};

// ---- Resolvers ------------------------------------------------------------

const eraFromCompletedBattles = (completedBattles: string[]): CampEra => {
  const last = completedBattles[completedBattles.length - 1];
  if (!last) return "pre_b1";
  if (last === "b01_palace_coup") return "post_b1";
  if (last === "b02_farmland" || last === "b03_dawn_bandits" || last === "b04_swamp") return "post_thuling";
  if (last === "b05_mountain_ndari" || last === "b06_caravan" || last === "b07_monastery") return "post_field";
  if (last === "b08_orinhal" || last === "b09_ravine") return "post_doubt";
  if (last === "b10_leaving_thuling") return "post_para";
  return "crossing";
};

// Pick an idle line for the named character given the campaign state.
// Returns a DialogBeat directly so CampScene can pass it straight to
// BattleDialogueScene without further translation. Falls back to a
// generic "(quiet at the fire)" line if the character has no authored
// content for the current era — keeps the click affordance honest
// even on character/era combos we haven't filled in yet.
export const resolveCampBeat = (
  characterId: string,
  completedBattles: string[]
): DialogBeat => {
  const talk = CAMP_TALK[characterId];
  const era = eraFromCompletedBattles(completedBattles);
  if (talk) {
    const lines = talk.eras[era];
    if (lines && lines.length > 0) {
      const pick = lines[Math.floor(Math.random() * lines.length)]!;
      return {
        speaker: talk.name,
        portraitId: talk.portraitId,
        expression: pick.expression,
        body: pick.body
      };
    }
    // Character exists in CAMP_TALK but no lines for this era.
    return {
      speaker: talk.name,
      portraitId: talk.portraitId,
      body: `(${talk.name} looks up from the fire. The hour passes quietly.)`
    };
  }
  // No CAMP_TALK entry at all — fall back to a generic narrator beat
  // referencing the character id by name.
  return {
    portraitId: "narrator",
    body: `(They look up from the fire. Whatever they were thinking, they keep to themselves.)`
  };
};
