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
// lines vary per-era.
//
// ERA GRANULARITY: the second half used to collapse into a single
// "crossing" bucket, which meant one set of lines covered B11 through
// the finale — a player who clicked Maya after the last battle heard
// what she said the night the ship left Para. The eras below follow the
// story's actual movements, so the camp keeps pace with the campaign.

export type CampEra =
  | "pre_b1"           // No battles completed yet — the cold open
  | "post_b1"          // Hospital, Amar wakes alone
  | "post_thuling"     // B2-B4 (Thuling settles in)
  | "post_field"       // B5-B7 (Fergus's contracts)
  | "post_doubt"       // B8-B9 (the truth about Fergus)
  | "post_para"        // B10 (leaving Thuling)
  | "crossing"         // B11 (the cliffs, Lucian, the open sea)
  | "grude"            // B12-B14 (the empire, Rose, the parentage)
  | "inner"            // B15-B17 (Coyne, the throne offer, the lie)
  | "paths"            // B18-B19 (the choice is made, the road opens)
  | "war"              // B20-B22 (Dawn's war, the road, the burning city)
  | "fleet"            // B23-B27 (the narrows, the bell, the sky)
  | "endgame";         // B28-B29 (the last duel, and after)

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
// the player walks up to them at the fire. Registers follow docs/VOICE.md:
// Ning counts things, Maya prices them, Leo jokes at the wrong moment,
// Ranatoli tells war stories with suspicious numbers, Selene uses the
// fewest words she can get away with, Veya measures, Corin keeps the
// rotation. Expressions must exist in src/assets/expressions.ts — the
// campTalk test fails the build if one doesn't.

export const CAMP_TALK: Record<string, CharacterCampTalk> = {
  // -------- AMAR -------- (every era; he's the one constant)
  amar: {
    characterId: "amar",
    name: "Amar",
    portraitId: "amar",
    eras: {
      pre_b1: [
        { body: "Tonight is the night, Selene says. The squad has been moving for ten months toward this hour. I've been moving for thirty years. I just don't remember most of them. (The hour drifts on.)", expression: "guarded" },
        { body: "Ranatoli's at the south door checking the hinge. Selene's at the east corridor. Khonu, Yul, Tev, Sera — they all know their post. Eight of us. Ten months. One night. (The moment holds.)", expression: "resolute" },
        { body: "Selene asked me earlier if I was ready. I said yes. I think I lied. Selene knew I lied. Selene didn't say anything about the lie. That's how Selene loves people.", expression: "wounded" }
      ],
      post_b1: [
        { body: "I was a forge worker yesterday. I am a forge worker again tonight. I was something else for ten minutes in the throne hall and the something else still has my hands. (He says no more about it.)", expression: "wounded" },
        { body: "The doctor in the ward said I tried to walk with a sword that wasn't there. Three times in my sleep. He said it like it was funny. I'm trying not to think about it. (The fire crackles between the words.)", expression: "shocked" },
        { body: "There are seven names I can't quite remember. Seven faces. I see them at the edge of dreams — corridors, a kitchen, a stables. They're calling out for someone who isn't here. I think the someone is me.", expression: "guarded" }
      ],
      post_thuling: [
        { body: "Lucian gave me a half-smile when I came back from the road. He hasn't asked. He hasn't NOT asked, either. I don't know which I'm more afraid of. (The silence holds.)", expression: "guarded" },
        { body: "Ning put thirty arrows in the same hand-span last night, then re-set the fletching bench because ours was 'built by someone who's never fletched'. She was right. She's usually right. I keep noticing that. (A small smile.)", expression: "warm_half_smile" },
        { body: "Mira brought me a bowl of stew tonight. I tried to thank her in two languages before I caught myself. Only one came out. She didn't notice. I don't think she did. I'm not sure.", expression: "guarded" }
      ],
      post_field: [
        { body: "Fergus sent us against the mountain bandits and they had a sister waiting on the ridge. Nobody at the captain's tent told us about the sister. I've been thinking about the sister.", expression: "guarded" },
        { body: "Maya watches me when she thinks I'm not looking. She's not afraid. She's measuring. I'd rather she ask. I don't know what I'd say if she did. (The thought trails off.)", expression: "wounded" },
        { body: "Kian came over earlier and corrected my grip on the sword. Said I was holding it like a man who'd forgotten. He laughed. I laughed back. Neither of us said what we both knew.", expression: "guarded" }
      ],
      post_doubt: [
        { body: "Fergus knew. The whole time. He sent us into Orinhal hoping the King would solve his problem for him. Lucian figured it out before I did. Lucian figures most things out before I do.", expression: "resolute" },
        { body: "I've been trying to remember the throne hall since the ravine. Pieces are coming back. Selene's voice. The carpet. King Nebu's face. I don't want most of it. I keep trying anyway. (The fire crackles low.)", expression: "wounded" },
        { body: "Maya offered to tell me what she knows about my old life. I asked her to wait. I don't think I'm ready to hear it from someone else's mouth. I want to remember it from inside my own first.", expression: "guarded" }
      ],
      post_para: [
        { body: "Kian on the road outside Lucian's house, with a warrant in his hand and twelve men behind him. He looked tired in a way I'd never seen him look. We rode west and didn't look back. (He goes quiet for a while.)", expression: "wounded" },
        { body: "Mira and Tali made the cousin's farm. Lucian wrote a letter at the first inn and gave it to a courier. He didn't tell me what it said. I think it was a goodbye. (The kind goes unsaid.)", expression: "guarded" },
        { body: "The harbor road climbs for four hours. The squad rides single file. Nobody talks. I keep wanting to say something. I keep not knowing what. The silence is doing the talking for us.", expression: "wounded" }
      ],
      crossing: [
        { body: "The harbor lights have been gone for an hour. The sea is the only thing in any direction. Lucian's wood practice sword is in my pack. I've taken it out twice and put it back. (He looks back at the sea.)", expression: "wounded" },
        { body: "Khione says fourteen months to Grude. Fourteen months to think about every name. Fourteen months to decide who I want to be when we land. I'll let you know what I come up with. (Half-smile.)", expression: "warm_half_smile" },
        { body: "Selene was at the edge of a dream last night. She was saying don't, don't, don't — same word three times. I woke up before I could ask what I wasn't supposed to do. I haven't gone back to sleep.", expression: "wounded" }
      ],
      grude: [
        { body: "A city that goes up in terraces. Eighty years of our iron in its walls, and not one person on the street knows the name of the country it came from. (Quiet.) That's the part I can't put down.", expression: "quiet_rage" },
        { body: "Rose is buried under the lemon tree behind the shop. I met her for one evening. She walked us through the plaza three times so we'd live. (He doesn't finish the thought.)", expression: "wounded" },
        { body: "My mother is alive, she's been alive the whole time, and every good thing in my life was something she arranged. I don't know where to put that. I've been sitting here trying to for an hour.", expression: "shocked" }
      ],
      inner: [
        { body: "Ndara went to face Coyne alone because she does everything alone. Now she's upstairs breathing and not waking. Khione sits with her most nights. I've started sitting too.", expression: "wounded" },
        { body: "My mother asked me to be a king. Lucian told me, dying, not to fight for thrones. (A long pause.) I keep setting those two sentences next to each other and waiting for one of them to give.", expression: "guarded" },
        { body: "Khione says there's a part of the story nobody's told me. She said it kindly, which is somehow worse. I'm going down to the quay in the morning. I don't think I'll like what's on that ship.", expression: "guarded" }
      ],
      paths: [
        { body: "Seven names in my head for three days, and then I picked one, out loud, in front of everyone. (He turns his hands over.) It's mine now. Nobody handed it to me. That's new.", expression: "resolute" },
        { body: "My mother let me reach that ship. She said so on the dock — Othren was hers, Khione was hers, all of it. Thirty years of arranging, and the last thing she arranged was letting go. I still don't know what to do with that.", expression: "wounded" },
        { body: "Corin came aboard and stood at the stern for an hour with his sister's clasp in his hand. I stood next to him and said nothing. It seemed like the right amount. (A beat.) He said it was.", expression: "guarded" }
      ],
      war: [
        { body: "They're singing my name across the camp. I held one line where people could see me. (He listens a while.) My mother wrote that song, every word except the one they're shouting.", expression: "guarded" },
        { body: "Three battles in nine days and I've stopped counting the rounds. Lucian used to say the harvest doesn't care how tired you are. I understand the sentence differently now than I did on the farm.", expression: "wounded" },
        { body: "Ranatoli's back. Selene's back. Two of the eight, out of the smoke, two years late. (A breath.) I keep looking over at them to check they're still there. They keep catching me at it.", expression: "warm_half_smile" }
      ],
      fleet: [
        { body: "The kings' war ended the morning the sky opened; it just hasn't been told. Riders went out to Serrick's remnant, to Halden, to my father. Enemies for two years, and now I'm writing them all the same letter.", expression: "resolute" },
        { body: "Khione says they came to her shore first, before any map we own. Everyone she stood beside is gone. She's been carrying that alone the entire time I've known her. (Quiet.) I never once asked.", expression: "wounded" },
        { body: "Veya says the light out of the east arrives bent. Ning says the birds went inland four days ago. Maya can't find the angle. (A long pause.) I've never seen Maya not find the angle.", expression: "guarded" }
      ],
      endgame: [
        { body: "It's over. I keep saying that to myself and waiting to believe it. (He looks at the squad, one by one, like a man counting.) Eight. Eight of us, at the end of this. I'd have taken far worse odds.", expression: "warm_half_smile" },
        { body: "Somebody asked me today what I'll do now. First honest answer of my life: I don't know. (A breath.) Nobody's handed me a plan in a week. It's the strangest holiday I've ever had.", expression: "guarded" },
        { body: "I took Lucian's practice sword out again this morning. There's a word carved in the grip. I put it there in the ninth month of the crossing and I've never shown anyone. (He doesn't offer to now.)", expression: "wounded" }
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
        { body: "Amar's been off since the throne hall. You see it. Don't ask him about it. He'll tell us when he's ready or he won't. Either way's all right with me.", expression: "grim_resolve" },
        { body: "Tali asked me where the squad goes when we leave. I told her we go places where the work needs doing. She said okay. She didn't ask if we always come back. I don't think she knows to ask that yet.", expression: "fatherly_smile" }
      ],
      post_field: [
        { body: "The captain who sent us against the mountain bandits — he sent us with five units against seven. He's done that twice this month. I've started keeping a count. (Quiet.)", expression: "grim_resolve" },
        { body: "Maya's reading us. Fine. She'll get to whatever she's after when she's ready. The squad is the squad regardless.", expression: "fatherly_smile" },
        { body: "Leo's a soldier in his father's mold and he's not. I can see the not. He'll figure out what to do about the not on his own time. The squad won't push him.", expression: "grim_resolve" }
      ],
      post_doubt: [
        { body: "Mira and Tali. If something happens out here, your job is them. I've said it to Maya and to Ning too. You're on the list. Don't argue.", expression: "grim_resolve" },
        { body: "Ning took her first bolt-rescue this morning. Pushed me out of an archer's lane and gave me a black eye doing it. (Smile.) She'll do.", expression: "fatherly_smile" },
        { body: "Maya was who I thought she was. The shape's just different. I'm relieved, your highness. Genuinely. The squad's tighter for the truth being out.", expression: "fatherly_smile" }
      ],
      post_para: [
        { body: "We rode out of Thuling at three in the morning. I haven't slept since. The cousin will move Mira and Tali north before sunrise. They'll be all right. (He doesn't quite believe it.)", expression: "grim_resolve" },
        { body: "Whatever happens at the cliffs, your highness — and don't tell me to stop calling you that — the squad needs to make the boat. That's the only thing that matters. We make the boat.", expression: "fatherly_smile" },
        { body: "Kian was at my front door. Twelve men. Wax-sealed warrant. Old-yard voice. The man I trained spear with at sixteen, with a writ for the man I trained him to protect. (A long quiet.) I don't blame him. I blame the writ.", expression: "grim_resolve" }
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
        { body: "Lucian doesn't say I did well. He says \"yes\" or \"no\" about whether the target dropped. \"Yes\" feels like a hand on my shoulder anyway.", expression: "startled" },
        { body: "I had a brother. He'd be thirteen now if the harvest hadn't failed when it did. He was the bowyer first — I was just the one carrying his quivers. Sometimes a draw goes right and I think he's the one drawing it. (Quiet.)", expression: "startled" }
      ],
      post_field: [
        { body: "Maya saw me try a tighter draw last week and didn't say anything. Three days later she walked past my fletching bench and left a drift-feather quill on it without breaking stride. I think that's how she compliments people.", expression: "focused_bow" },
        { body: "Leo asked me how I knew which arrow was mine in the dark. I said the fletching's tied with twine I twist myself. He said that's the same answer his father gave him about reins. We sat with that one a while.", expression: "focused_bow" },
        { body: "I haven't gotten used to dropping people. I don't think I want to. The day I do is the day I should put the bow down.", expression: "startled" }
      ],
      post_doubt: [
        { body: "Lucian took a bolt for me in the ravine. I was standing in the lane and I didn't see the archer. I'm not standing in any more lanes I don't see. I've decided.", expression: "focused_bow" },
        { body: "Promotion took six minutes after the ravine. It felt like six years. I'm not the bowyer's apprentice anymore. I'm the squad's archer. (Quiet.) I'm ready to be that.", expression: "focused_bow" },
        { body: "Maya told me tonight what she actually does. I'd suspected. Not the specifics — but the shape. She asked if I was angry. I said no. I'm relieved. Everyone in this squad has been carrying something. Now there's one less.", expression: "focused_bow" }
      ],
      post_para: [
        { body: "I covered the rear at Lucian's door with twelve arrows nocked in twelve seconds. Nobody got past me. Lucian made me confirm three times. He always does that. (Small smile.)", expression: "focused_bow" },
        { body: "Mira said goodbye to me at the back gate. She said it like it was an ordinary night. She knew. She knew and she said it like an ordinary night. (Pause.) That's the part I keep thinking about.", expression: "startled" },
        { body: "I have my brother's quiver in my pack and Lucian's spare bowstring on my belt. The squad is what's left of the people who taught me anything. I'm carrying them all up the harbor road.", expression: "focused_bow" }
      ],
      crossing: [
        { body: "I didn't realize I was crying until Maya put a hand on my arm. Lucian was the first person who told me I was good at something. (Pause.) I'll write to Mira and Tali too. They should know what he was to us.", expression: "startled" },
        { body: "Lucian's bowstring is on my belt. The wood practice sword Amar's carrying — Lucian carved that one too, he told me once. Lucian made things. We're carrying them now. All of us, something.", expression: "focused_bow" },
        { body: "Khione gave me a windrose this morning. Said the sea throws fletching off and a windrose helps you re-tune. I don't know why she gave it to me specifically. I think Maya said something to her.", expression: "focused_bow" }
      ],
      grude: [
        { body: "Everything here is stone and stairs. Fourteen months of deck and now my legs don't know what a hill is. (She laughs at herself.) I fell UP three steps this morning. Leo saw. I'll never hear the end of it.", expression: "eager_grin" },
        { body: "The plaza was eight minutes. Rose said eight minutes at the briefing and it was eight minutes. Then the back door opened and it stopped being anybody's plan. (Quiet.) She was so exact about everything.", expression: "startled" },
        { body: "I count the squad at every fire. Four of us, and one who's new, and two who are gone. It's a stupid habit and I'm not stopping.", expression: "exhausted" }
      ],
      inner: [
        { body: "Their quartermaster sold the door to our house. Nine years he carried the supply line and then he sold the door. (She works a fletching, hard.) I don't understand people who do their whole life and then undo it.", expression: "startled" },
        { body: "Veya let me hold the rig. It's heavier than it looks and it hums when the light's right. She talked about it for forty minutes and I understood maybe six. I'd sit through the other thirty-four again.", expression: "eager_grin" },
        { body: "Amar's mother wants him on a throne. Lucian told him not to. (Beat.) I know which one of them fed us when the wagons burned, is all I'll say about it.", expression: "focused_bow" }
      ],
      paths: [
        { body: "He picked. Out loud, in the hold, in front of everybody. (She grins, a little fierce.) I've been waiting two years for somebody to stop telling him what he's for.", expression: "eager_grin" },
        { body: "Ndara walked. On her own legs, out of that cabin, to tell him to stop counting other people's answers. Khione caught her before she went down. Neither of them made a sound about it.", expression: "startled" },
        { body: "We're going somewhere nobody has a warrant for us. Do you know how long it's been? (She counts on her fingers, then stops.) Since Thuling. It's been since Thuling.", expression: "focused_bow" }
      ],
      war: [
        { body: "I used to count arrows. Now I count the faces I aimed past — the ones I chose not to take. It's a worse way to count. I can't go back to the other one.", expression: "exhausted" },
        { body: "The granaries went up before we got there. All that grain. (A long breath.) My town lost a winter once. I know exactly what that street is going to feel like in three months.", expression: "startled" },
        { body: "The big man with the shield walked out of the prison row and Amar just — went. Straight across the ash, didn't even put his sword away first. (Softly.) I've never seen him move like that.", expression: "eager_grin" }
      ],
      fleet: [
        { body: "My bowstring went in the surf again. Third one this week. Ranatoli splices them before I ask now. I haven't thanked him properly. He'd only make a joke of it.", expression: "exhausted" },
        { body: "They come out of the water in a line and they don't shout. No orders, no drums, nothing. (She turns an arrow over.) Aim where things bend. That's all I've got and it's been enough so far.", expression: "focused_bow" },
        { body: "Selene took the ridge watch and came back with the exact number of them, and how they walk, and which one gives the orders. Two hours. She said eleven words about it.", expression: "startled" }
      ],
      endgame: [
        { body: "It's quiet. Properly quiet, not between-waves quiet. (She keeps looking east anyway.) I'll stop doing that eventually. Ranatoli says it took him a year after the cells.", expression: "exhausted" },
        { body: "I'm going to rebuild the rivet press. The one in Thuling, the actual one. I've been drawing it on the back of a map for two weeks. (Fiercely.) It's going to be better than the old one.", expression: "eager_grin" },
        { body: "Everyone who taught me anything is either at this fire or in the ground. (Beat.) That's not a sad thing to say. I'm going to go teach somebody the draw now. That's the point of it.", expression: "focused_bow" }
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
        { body: "Amar's footwork is from a courtyard, not a wagon yard. I haven't said it out loud. I might not for a while. He's listening for the question and I want to know what he does when I don't ask it.", expression: "calculating_side_glance" },
        { body: "Madame Dawn's last courier brought a list of three names she wants verified. I sent back two confirmations and a maybe. The maybe is Amar. I'm holding onto the maybe until I know what to do with it.", expression: "guarded_neutral" }
      ],
      post_field: [
        { body: "Took the south flank at the canyon ambush before Lucian called it. He didn't reprimand. He didn't praise either. He just adjusted around me. That's the version of trust I respect most.", expression: "guarded_neutral" },
        { body: "Leo's been off since the village we burned through last month. He keeps looking at the road south. He's going to make a call soon. I'll be ready when he does.", expression: "calculating_side_glance" },
        { body: "Fergus's last three contracts were unwinnable on paper. We won them anyway. He's going to send something we can't win soon. I've been packing for it since Orinhal.", expression: "calculating_side_glance" }
      ],
      post_doubt: [
        { body: "Said it tonight. The whole truth. Dawn, the planting, eleven months of reading you all. Lucian smiled. Lucian. I hadn't expected that. I'd planned for a knife.", expression: "steel_cold_confession_face" },
        { body: "Ning won't take a bolt for anyone in the squad again, and she'll be the one who decides who's worth one. That's the right shape for what she is now.", expression: "guarded_neutral" },
        { body: "Amar asked me to wait before telling him what I know about his old life. I respected the ask. I will wait. But the ship to Grude takes fourteen months, and I am not going to spend all fourteen of them not telling him.", expression: "calculating_side_glance" }
      ],
      post_para: [
        { body: "The east watch caught me leaving the back gate of Lucian's house at 3:48 AM with Mira on one hip and Tali by the hand. She didn't recognize me. The makeup helped. Tali asked twice if I was a witch. I said yes. She seemed satisfied.", expression: "guarded_neutral" },
        { body: "The cousin's farm is north of the King's Road, two valleys past the trader's bridge. Mira and Tali will be safer there than they would be in any city Dawn could put them in. I made the choice without asking Lucian. I'd make it again.", expression: "calculating_side_glance" },
        { body: "Kian saw me on the back lane. He saw me. We made eye contact. He turned his head and walked into the front yard like he hadn't. (Quiet.) That's twice he's been better than the warrant in his hand.", expression: "guarded_neutral" }
      ],
      crossing: [
        { body: "The flag was on the wall of his front room. I took it on the way out the back gate without thinking about why. I thought about why on the deck of the ship at dawn. I wrapped him in it. It was the right call.", expression: "steel_cold_confession_face" },
        { body: "Khione says fourteen months. I'm using it. Reading. Drawing maps from memory. By landfall I want to know Grude better than its tax officers do. (Half-smile.) Ask me about the upper district market in eight months.", expression: "calculating_side_glance" },
        { body: "Lucian asked me to look after Mira and Tali if anything happened. I said yes. I meant it. I'll write to them every season for the rest of my life. He'll know somehow. He always does.", expression: "guarded_neutral" }
      ],
      grude: [
        { body: "Eight months of reading and I still walked us past the wrong customs platform. (Flat.) Maps don't tell you which officer has been told what. I won't make that mistake twice.", expression: "guarded_neutral" },
        { body: "Rose and I trained in the same cohort. Twelve years of letters. One evening in the same room. (A pause she doesn't fill.) I keep starting a report to her out of habit and getting three lines in before I remember.", expression: "tearful" },
        { body: "Eleven years I believed his father was dead because she told me so. I never checked. (Quiet, and it costs her.) I check everything. I never checked that.", expression: "steel_cold_confession_face" }
      ],
      inner: [
        { body: "Three months of manifests on the study floor. Every message in that house crossed one desk before hers. Coyne. (Beat.) Ndara got there an hour ahead of me and went alone. I should have said the name louder.", expression: "steel_cold_confession_face" },
        { body: "She's telling now, not asking. That's not a small change. A woman who stops asking has priced the people around her and found them affordable.", expression: "calculating_side_glance" },
        { body: "Whatever she offers him tomorrow, he needs his answer before he hears hers. Otherwise he'll take hers. (She catches herself.) He's better than that. But she's better than everyone.", expression: "guarded_neutral" }
      ],
      paths: [
        { body: "I spent eleven years steering him toward her board. Then I stood in a hold and told him it wasn't anybody's board anymore. (A breath.) Best sentence I've ever said out loud.", expression: "soft_genuine_smile" },
        { body: "Ndara woke up on this ship. Khione carried her aboard two nights before the quay and told no one. I audit everything and I missed a marshal in the hold. (Almost admiring.) That woman is a better spy than I am.", expression: "calculating_side_glance" },
        { body: "No warrant, no map, no handler, no plan past landfall. (She turns the empty page over.) I should be terrified. Ask me why I'm not and I'll deny saying any of this.", expression: "guarded_neutral" }
      ],
      war: [
        { body: "Two crowns spending other people's sons on the same afternoon. I've read the ledgers behind both of them. Neither one balances. (Flat.) They never did.", expression: "calculating_side_glance" },
        { body: "They're chanting his name out there. A crowd that learns a name learns where to send the bill. I've watched her do it to better men. (Beat.) I'll be watching him for it.", expression: "guarded_neutral" },
        { body: "Corin's sister taught me the stance I still use. He watches me drill and doesn't say anything about it. (Quiet.) I let him. It's the only place left where she's not past tense.", expression: "tearful" }
      ],
      fleet: [
        { body: "Probe, price, escalate. That's not a war, it's an appraisal — I've run that exact play on smaller people. (She looks up.) Deeply strange to be on the other side of my own method.", expression: "calculating_side_glance" },
        { body: "I've found the angle on every room I've stood in. Kings, wardens, Dawn. (Flat.) I can't find the angle on this and I'd rather say it out loud than have you all find out at the wrong moment.", expression: "alarmed" },
        { body: "Khione told me tonight what happened to her shore. Not the version she gives the squad. The other one. (A pause.) I'm not going to repeat any of it.", expression: "guarded_neutral" }
      ],
      endgame: [
        { body: "They ran the numbers and walked away from the deal. Twenty years of being somebody's asset, and the first appraisal I'm proud of says unprofitable. (Almost a laugh.)", expression: "soft_genuine_smile" },
        { body: "The councils are arguing about a bridge. Not a war, not a throne — a bridge, and who pays for it. (She's delighted and refuses to show it.) It's the most boring thing I've ever helped organize.", expression: "guarded_neutral" },
        { body: "I reported on him for eleven years. Every grip he corrected, every night he didn't sleep. (Beat.) There's one line I never filed. I'm still not filing it. Don't ask.", expression: "tearful" }
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
        { body: "Ndara escaped on a dactyl off the mountain ridge. She wheeled once before she went. I keep thinking about the wheel. The pause. The look down. (Quiet.) She knew what she was looking at.", expression: "resolute" },
        { body: "The dactyl's name is Ash. He's three years old, raised in the Para roost, took a year to bond. The squad calls him Kid. He doesn't mind. He likes Ning. She gives him fletching scraps.", expression: "ready" }
      ],
      post_doubt: [
        { body: "Walked the dactyl to the partisan side at Orinhal. Out loud, in front of the King's men. I haven't been able to stop smiling about it. Don't tell Lucian I said that.", expression: "ready" },
        { body: "Father's letter caught up to us at the next inn. He didn't write what I expected him to write. He wrote what I'd hoped he would. I can't decide if that's harder.", expression: "resolute" },
        { body: "Maya pulled me aside after the ravine and said she'd known for months which way I'd jump. I asked how. She said \"the way you look at villages.\" I think about that line every time we ride past one now.", expression: "resolute" }
      ],
      post_para: [
        { body: "Cleared the back lane in three minutes flat with the dactyl. Mira held on like she was born on a saddle. Tali asked if she could keep flying. (Smile.) I told her maybe later, kid.", expression: "ready" },
        { body: "Lucian gave me the south watch tonight. He hasn't given me a watch in months — I'm too senior, he says. He gave me one tonight because he's not sure he'll be around tomorrow. I won't say anything to him. I'll just take the watch.", expression: "resolute" },
        { body: "Father always told me the first man who breaks ranks loses the day. I broke ranks at Orinhal. The day didn't lose. I think father had been wrong about that one for a long time and never tested it.", expression: "ready" }
      ],
      crossing: [
        { body: "The dactyl doesn't like the deck. Won't sit. Khione says he'll settle by week three. The dactyl's the only one of us who hasn't lost anyone yet. Maybe that's why.", expression: "resolute" },
        { body: "I keep expecting to see Lucian come up the deck stairs to check the rear watch. He didn't do it last night, won't do it tonight, won't do it tomorrow. I keep expecting it anyway.", expression: "wounded_pride" },
        { body: "Wrote to my father this morning. Three pages. I don't know if the letter will reach him before Grude. I don't know what he'll do with it if it does. I wrote it anyway.", expression: "resolute" }
      ],
      grude: [
        { body: "There's no sky here. I mean there is, but it's got a city in front of it. Ash won't go up over the terraces — too much stone, too many bells. (Restless.) First time in my life I've been the one on foot.", expression: "wounded_pride" },
        { body: "Rose put me on the captain in the plaza and I took him in four passes. Cleanest work I've ever done. (Flat.) And it didn't matter at all, because of a door nobody knew was there.", expression: "resolute" },
        { body: "So his mother's the queen of the rebellion and his father's the emperor. (He whistles.) And people used to tell ME I had a complicated family.", expression: "cocky_smirk" }
      ],
      inner: [
        { body: "A traitor in the house. Nine years in her supply line. (He checks a strap he already checked.) My father would have said that's what happens when you trust people you didn't grow up with. My father was wrong about most things.", expression: "wounded_pride" },
        { body: "Ash gets the run of the courtyard now, and Ndara's window looks onto it. Khione says a coma still hears. So he goes and makes a racket under her window every morning. (Defensive.) It's a THEORY.", expression: "ready" },
        { body: "Amar's been carrying a question around for a week. I know what it looks like on him. (Beat.) I flew away from my answer at Orinhal. Can't exactly hand him mine.", expression: "resolute" }
      ],
      paths: [
        { body: "He picked one. Doesn't matter which — well, it does, but you know what I mean. (Grinning.) I've been waiting two years for that man to choose something for himself instead of being handed it.", expression: "cocky_smirk" },
        { body: "Open water and no orders. Do you know what my father's whole life was? Orders, and being the man who gave them. (He leans back.) He'd hate this. He'd absolutely hate this. I love it.", expression: "ready" },
        { body: "The lancer's all right, by the way. Corin. Doesn't talk much, doesn't laugh at anything, keeps a rotation like it's a religion. (Beat.) Ash likes him. Ash is never wrong about people.", expression: "resolute" }
      ],
      war: [
        { body: "The field before Grude was the biggest thing I've ever flown over. Two armies, all the way to both ridges. (Quiet, for him.) You can't see people from up there. That's the part that bothers me.", expression: "wide-eyed_horror" },
        { body: "Their cavalry came at the barricade six times. I can still feel it through my boots. We held with a fence and some carts. (He laughs, badly.) A FENCE.", expression: "wounded_pride" },
        { body: "Three battles in nine days. I stopped being scared somewhere around the fence line and I genuinely can't tell if that's good.", expression: "resolute" }
      ],
      fleet: [
        { body: "I put three feet of steel through one and it looked surprised. Not hurt. Surprised. (He shakes his head.) Ash won't fly over them. Won't. First time he's ever refused me anything.", expression: "wide-eyed_horror" },
        { body: "Ranatoli's told the same story four nights running and the number of men in it has gone from nine to twenty-two. (Grinning.) Nobody's stopping him. It's the best thing about this camp.", expression: "cocky_smirk" },
        { body: "I'm done being sampled by things with no face. Let one of them land where I can reach it. (A beat.) That sounded better in my head. Don't tell Maya I said it out loud.", expression: "ready" }
      ],
      endgame: [
        { body: "When this is over Ash and I are going to fly the coast. That's the whole plan. That's it, that's the entire plan. (He's said this eleven times.)", expression: "cocky_smirk" },
        { body: "My father handed me a list of everything my life would be. I flew the other way. (He looks around the fire.) This was at the bottom of the climb. I'd take it again.", expression: "resolute" },
        { body: "Nobody's shooting at us and I don't know what to do with my hands. (He fusses with a strap.) Ash is worse. He keeps going up to check.", expression: "ready" }
      ]
    }
  },
  // -------- RANATOLI -------- (original squad at B1; recaptured, rejoins
  // out of the Grude prison row after B22 — so B1 and the fleet arc on)
  ranatoli: {
    characterId: "ranatoli",
    name: "Ranatoli",
    portraitId: "ranatoli",
    eras: {
      pre_b1: [
        { body: "Steel up, lad. Ten months of planning and it comes down to one corridor and whether the hinge on the south door is oiled. (He checks it again.) It's oiled. I did it twice.", expression: "lecturing" },
        { body: "We bleed together or we feast together. Anything in between is shame. I've said it to every squad I've stood in for twenty years and I've only had to bury the ones who didn't listen. (Mostly.)", expression: "satisfied" }
      ],
      fleet: [
        { body: "Two years in a Grude cell. You want to know what kept me? Spite, mostly. And a rumour, about a year in, that a boy from Anthros had turned up on the wrong side of the sea causing trouble. (He grins.) I knew exactly which boy.", expression: "satisfied" },
        { body: "I'm slower than I was. Shield's the same weight, the arm isn't. (He shrugs it off.) A door doesn't need to be fast. It needs to be there.", expression: "dry_skeptical" },
        { body: "Nine of them at the north gate, and I held it alone with a cracked shield until the line re-formed. (Beat.) It was six last night, I know. It grows. That's what stories do — they get more honest about how it FELT.", expression: "lecturing" }
      ],
      endgame: [
        { body: "The girl splices her own bowstrings now and pretends she doesn't need me to. I keep doing it anyway. It's what an old man has instead of conversation.", expression: "satisfied" },
        { body: "I said a thing to a frightened boy in a throne hall once, about bleeding and feasting. (He looks around the fire, at all of them.) Took two years in a cell and a sky full of strangers, but look at it. We're at the feasting part.", expression: "satisfied" },
        { body: "Everyone keeps asking what I'll do now. Eat, mostly. Properly. Sitting down, at a table, with people I like, for about a year. (Dead serious.) I've given it a great deal of thought.", expression: "dry_skeptical" }
      ]
    }
  },
  // -------- SELENE -------- (original squad at B1; escapes the monastery
  // at B7, shadows the squad for two years, rejoins after B22)
  selene: {
    characterId: "selene",
    name: "Selene",
    portraitId: "selene",
    eras: {
      pre_b1: [
        { body: "Corridor's clear to the east stair. Two guards, both bored. (She doesn't look up from the string.) Ask me again in an hour and the answer will be different. That's why I keep checking." },
        { body: "You asked if you were ready. You said yes. (A pause.) I know. I'm not going to make you say it twice." }
      ],
      fleet: [
        { body: "Three streets behind you since the harbour. Long enough to watch who you spare. (Beat.) That's how I knew it was still you." },
        { body: "Cut sign on the eastern ridge this morning. Wolves walking beside deer. Neither hunting. (She lets that sit.) I've tracked for twenty years. I've never seen that." },
        { body: "Two years I was a rumour with a bow. It was simpler. (She checks the string again.) I'm not saying it was better.", expression: "cold_contempt" }
      ],
      endgame: [
        { body: "It's over and my hands still go to the string every time a bird moves. (Flat.) Give it a season." },
        { body: "I said a thing on the crossing, in my sleep. You heard it. You never asked. (A long pause, and she leaves it there.) Thank you for never asking.", expression: "breaking" },
        { body: "There's nothing out there hunting either of us. (She keeps watching the horizon anyway.) I know. I'm working on it." }
      ]
    }
  },
  // -------- VEYA -------- (joins B14 in the safe-house street fight)
  veya: {
    characterId: "veya",
    name: "Veya",
    portraitId: "veya",
    eras: {
      grude: [
        { body: "Nine years I signed off on that plate. Nine years of inspections, and not once did the court ask me what I'd learned about where it fails. (Dry.) Their loss. Quite literally, in the street outside.", expression: "wry_smile" },
        { body: "I ground lenses so men could see farther and take more. The plaza put my name on their lists anyway. (She wipes the front element.) So from here I aim the other way. It's a small correction. It took me nine years.", expression: "grim_resolve" },
        { body: "Ning asked me how the rig works. I talked for forty minutes. She stayed for all forty. (A pause.) Nobody at court ever stayed past five. I'd have defected years earlier if someone had told me about the forty.", expression: "wry_smile" }
      ],
      inner: [
        { body: "Their quartermaster sold the door I was standing behind. (She sets a lens down harder than needed.) I have opinions about men who spend nine years being trusted and one afternoon being paid.", expression: "alarmed" },
        { body: "The rig's front element has a flaw, lower left, from the quay. I could regrind it in an afternoon with a proper bench. I'm keeping it. Some flaws are records.", expression: "grim_resolve" },
        { body: "A field posting at my age. My mother wanted me to marry a magistrate. (Dry.) I'd like the record to show I'm having a considerably better time than that.", expression: "wry_smile" }
      ],
      paths: [
        { body: "Sea air is terrible for optics and wonderful for everything else. (She's cleaning, endlessly cleaning.) I've recalibrated twice a day since we sailed. I'd do it four times for this view.", expression: "wry_smile" },
        { body: "He chose without asking me what I thought. Correct. (Beat.) I've spent my career being asked for measurements by men who'd already decided. This is the first one who decided honestly.", expression: "focused" },
        { body: "The lancer asked me — politely, at length — whether the rig could be mounted to a saddle. I said no. He asked twice more. (A pause.) I'm now sketching it, which I resent.", expression: "wry_smile" }
      ],
      war: [
        { body: "Half those boys were levied at spear-point out of villages exactly like the ones behind us. Officers do the directing. So I take the officers. (Flat.) Break the head, spare the hands. It's not mercy. It's aiming.", expression: "grim_resolve" },
        { body: "The glassworks in the upper district survived the fire. Barely. (Excited despite herself.) Do you understand what I could BUILD with a proper annealing oven — sorry. Sorry. There's a war on.", expression: "focused" },
        { body: "Smoke does interesting things to a beam. Scatters it, mostly, which is a polite word for ruins it. (Beat.) I spent two nights working around that. The city was burning. It seemed like the useful thing to do.", expression: "focused" }
      ],
      fleet: [
        { body: "The light out of the east arrives bent. That's not a sunset — that's a reading, and it's rising. (She takes another measurement.) I've checked it eleven times. It keeps being true.", expression: "alarmed" },
        { body: "One lens asks the light politely. Seven of them insist. (She seats the last prism.) I built this out of salvage from a burned observatory in two nights. It's the best work of my life and I'd like that noted.", expression: "focused" },
        { body: "It ate four of my seven colours before it broke off. That wasn't armour — it was ATTENTION. It was learning my light while I was cutting it. (Quiet.) I've never had a thing look back at me.", expression: "grim_resolve" }
      ],
      endgame: [
        { body: "Lighthouses. That's what I want next. Instruments whose entire purpose is helping things be seen coming. (Dry.) After the last few years I find the idea almost aggressively pleasant.", expression: "wry_smile" },
        { body: "Four years ago I was measuring plate seams for men who wanted to take more. (She looks at the rig on the bench.) Nobody has asked me to help anyone take anything in a very long time.", expression: "neutral" },
        { body: "I've started grinding a small one. No, it's not for the rig. No, I'm not going to say what it's for. (She covers it with a cloth.) Ask me in a month.", expression: "wry_smile" }
      ]
    }
  },
  // -------- CORIN -------- (crosses Othren's line at B17 and comes aboard)
  corin: {
    characterId: "corin",
    name: "Corin",
    portraitId: "corin",
    eras: {
      inner: [
        { body: "Nine years I kept a cavalry rotation: feed, tack, watch, sleep. The squad keeps no rotation at all and somehow the watch is always kept. Rose would have hated it. Rose would have loved it. Both, I think.", expression: "quiet_grief" },
        { body: "Maya stands the way my sister taught her. First position, weight back, chin level. I watched her drill tonight and forgot to breathe for a moment. It isn't grief exactly. It's nearer to visiting.", expression: "quiet_grief" },
        { body: "I asked the Marshal one question on that dock and the silence answered it. (Flat.) Nine years I took his orders. I'd have taken nine more. He should have lied to me, Captain. It would have been kinder.", expression: "torn" }
      ],
      paths: [
        { body: "Nine years we lived two streets apart and the rebellion kept us in separate pockets. I never saw the lemon tree they buried her under. (He turns the clasp over.) I'll see it. Not yet.", expression: "quiet_grief" },
        { body: "The horse is settling. Takes a saddle without an argument now. (He almost smiles.) Everyone in this camp is something the war tried to spend and missed. The horse included. Maybe me.", expression: "resolute" },
        { body: "There's no chain of command here. I asked who I report to and the archer said \"everyone, mostly at dinner.\" (A long pause.) I have been in service since I was fifteen. I am adjusting.", expression: "neutral" }
      ],
      war: [
        { body: "Rotation holds even here: feed, tack, watch, fight. Angry men break formation. (Flat.) I've buried a great many angry men. Discipline is the only apology I have left to offer any of them.", expression: "resolute" },
        { body: "The destrier came out of the prison-row stables and looked me over for a full minute before it lowered its head. (Quiet.) Nobody had ridden it since its rider died on the processional. We understand each other.", expression: "battle_fury" },
        { body: "Rose held doors. That was her whole method — find the door, stand in it, do not move. (He checks the girth strap.) I open them. Somebody in the family ought to.", expression: "quiet_grief" }
      ],
      fleet: [
        { body: "Horses will not charge surf. So we dismounted and held the dune the way she used to hold a doorway. (He works a buckle loose.) The horse forgave me around midnight.", expression: "resolute" },
        { body: "They take their dead now. The Herald did, anyway. (Beat.) Two waves left where they fell and this one carried its own off the field. I don't know what that means. I know it means something.", expression: "torn" },
        { body: "The old scholar tells the same story every night with a different number in it. (Almost a smile.) In the cavalry we'd have called that a morale officer and paid him properly.", expression: "neutral" }
      ],
      endgame: [
        { body: "The rotation holds out of habit now rather than need. Feed, tack, watch, sleep. (He stands the last watch anyway.) I'm aware. I'm not stopping.", expression: "resolute" },
        { body: "The account I opened on that dock is settled. (He touches the silver rose at his cloak.) It was never a debt anyone owed me. It was everything I had left, looking for somewhere to live.", expression: "quiet_grief" },
        { body: "There are no more Eseldras. (A long pause; he doesn't drop the sentence, he just carries it.) So the name has to mean something other than a family now. I've been thinking about what.", expression: "torn" }
      ]
    }
  },
  // -------- KIAN -------- (in squad B4-B9; the enemy from B10 onward)
  kian: {
    characterId: "kian",
    name: "Kian",
    portraitId: "kian",
    eras: {
      post_thuling: [
        { body: "The General's compliments, and a standing instruction to keep an eye on the marsh road. (A pleasant shrug.) I'd have come anyway. I've known him since he was thirteen and couldn't hold a stance for a count of four.", expression: "knowing_smile" },
        { body: "Lucian runs this line better than the King's own sergeants run theirs, and he does it with a forge crew. (Beat.) I'll be putting none of that in the report.", expression: "knowing_smile" },
        { body: "He drops his shoulder before a thrust. Same tell he had at eleven. (Quiet.) A man can lose a great deal and keep the tell. I find that reassuring. I'm not sure I should.", expression: "wounded" }
      ],
      post_field: [
        { body: "The squad's footwork is improving. Even Amar's. Especially Amar's. (Knowing smile.) Funny how that works.", expression: "knowing_smile" },
        { body: "Fergus is sending us against harder targets each rotation. You see it. I see it. The question is whether we'll see it the same way when it matters. (Quiet.)", expression: "knowing_smile" },
        { body: "Lucian and I trained spear together at sixteen. Same yard. Same instructor. He went into the forge. I went into the King's service. Funny which doors close behind you and which ones don't, the older you get.", expression: "wounded" }
      ],
      post_doubt: [
        // Kian's still in the squad through B9 per ACTIVE_ROSTER —
        // narratively the gap between his ally face and his coming
        // betrayal at B10 is widening. These lines surface the
        // strain without spoiling the warrant reveal.
        { body: "Lucian's started keeping a count of how many soldiers Fergus sends us against vs. how many he should. I've seen the count on Lucian's wrist. I've started keeping my own. The numbers match. I haven't told Lucian.", expression: "wounded" },
        { body: "I have orders I haven't read yet. They came in a wax-sealed pouch from Para three days ago. I keep meaning to open them. Tonight isn't the night either. (Quiet.)", expression: "knowing_smile" },
        { body: "Amar — your highness — I'm sorry. (Pause.) I haven't said it out loud. I will eventually. Not tonight, but eventually.", expression: "wounded" }
      ]
      // No post_para or later — Kian leaves the squad before B10 to
      // act on the warrant. He's the boss of B10/B11.
    }
  }
};

// ---- Resolvers ------------------------------------------------------------

// Chapter number out of a battle id (`b<NN>_slug`). -1 for anything
// unparseable, which falls through to the earliest era.
const chapterOf = (battleId: string): number => {
  const n = Number.parseInt(battleId.slice(1, 3), 10);
  return Number.isFinite(n) ? n : -1;
};

export const eraFromCompletedBattles = (completedBattles: string[]): CampEra => {
  const last = completedBattles[completedBattles.length - 1];
  if (!last) return "pre_b1";
  const ch = chapterOf(last);
  if (ch <= 1) return "post_b1";
  if (ch <= 4) return "post_thuling";
  if (ch <= 7) return "post_field";
  if (ch <= 9) return "post_doubt";
  if (ch === 10) return "post_para";
  if (ch === 11) return "crossing";
  if (ch <= 14) return "grude";
  if (ch <= 17) return "inner";
  if (ch <= 19) return "paths";
  if (ch <= 22) return "war";
  if (ch <= 27) return "fleet";
  return "endgame";
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
