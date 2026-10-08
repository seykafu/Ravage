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
        { body: "Selene says tonight's the night. We've spent ten months planning for it. Honestly, it feels like I've been heading here for thirty years. I just don't remember most of them.", expression: "guarded" },
        { body: "Ranatoli's at the south door checking the hinge. Selene's watching the east corridor. Khonu, Yul, Tev and Sera all know their posts. There are eight of us, and we've had ten months to get this right.", expression: "resolute" },
        { body: "Selene asked me earlier if I was ready. I said yes. I don't think I meant it, and she knew. She didn't call me on it. That's how she looks after people.", expression: "wounded" }
      ],
      post_b1: [
        { body: "I was a forge worker yesterday and I'm a forge worker again tonight. But for ten minutes in that throne hall I was somebody else, and I can still feel it in my hands.", expression: "wounded" },
        { body: "The doctor in the ward said I sleepwalked three times, holding a sword that wasn't there. He thought it was funny. I'm trying not to think about it.", expression: "shocked" },
        { body: "There are seven names I can't quite remember, and seven faces. I keep dreaming about them — corridors, a kitchen, a stable. They're calling for someone, and I think it's me.", expression: "guarded" }
      ],
      post_thuling: [
        { body: "Lucian gave me a half-smile when I came back from the road. He hasn't asked me anything. He hasn't exactly let it go, either. I don't know which one scares me more.", expression: "guarded" },
        { body: "Ning put thirty arrows in the same hand-span last night. Then she rebuilt our fletching bench because it was 'built by someone who's never fletched'. She was right. She usually is. I keep noticing that.", expression: "warm_half_smile" },
        { body: "Mira brought me a bowl of stew tonight. I tried to thank her in two languages before I caught myself. Only one came out. She didn't notice. I don't think she did. I'm not sure.", expression: "guarded" }
      ],
      post_field: [
        { body: "Fergus sent us against the mountain bandits and they had a sister waiting on the ridge. Nobody at the captain's tent told us about the sister. I've been thinking about the sister.", expression: "guarded" },
        { body: "Maya watches me when she thinks I'm not looking. She isn't scared of me. She's sizing me up. I'd rather she just asked, but I don't know what I'd tell her if she did.", expression: "wounded" },
        { body: "Kian came over earlier and corrected my grip on the sword. Said I was holding it like a man who'd forgotten. He laughed, so I laughed too. Neither of us said what we were both thinking.", expression: "guarded" }
      ],
      post_doubt: [
        { body: "Fergus knew. The whole time. He sent us into Orinhal hoping the King would solve his problem for him. Lucian figured it out before I did. Lucian figures most things out before I do.", expression: "resolute" },
        { body: "I've been trying to remember the throne hall since the ravine. Pieces are coming back. Selene's voice. The carpet. King Nebu's face. I don't want most of it. I keep trying anyway.", expression: "wounded" },
        { body: "Maya offered to tell me what she knows about my old life. I asked her to wait. I don't want to hear it from someone else. I want to remember it myself first.", expression: "guarded" }
      ],
      post_para: [
        { body: "Kian was on the road outside Lucian's house with a warrant and twelve men behind him. He looked more tired than I've ever seen him. We rode west and didn't look back.", expression: "wounded" },
        { body: "Mira and Tali made it to the cousin's farm. Lucian wrote a letter at the first inn and gave it to a courier. He didn't tell me what it said. I think it was a goodbye.", expression: "guarded" },
        { body: "The harbor road climbs for four hours. We're riding single file and nobody's talking. I keep wanting to say something, but I don't know what.", expression: "wounded" }
      ],
      crossing: [
        { body: "We lost sight of the harbor lights an hour ago. There's nothing but sea in every direction. Lucian's wooden practice sword is in my pack. I've taken it out twice and put it back.", expression: "wounded" },
        { body: "Khione says it's fourteen months to Grude. That's a long time to think about all those names, and to work out who I want to be when we land. I'll let you know what I come up with.", expression: "warm_half_smile" },
        { body: "I dreamed about Selene last night. She kept saying 'don't, don't, don't', the same word three times. I woke up before I could ask what I wasn't supposed to do, and I haven't slept since.", expression: "wounded" }
      ],
      grude: [
        { body: "The whole city's built in terraces. There's eighty years of our iron in those walls, and nobody on the street even knows the name of the country it came from. I can't stop thinking about that.", expression: "quiet_rage" },
        { body: "Rose is buried under the lemon tree behind the shop. I only knew her for one evening. She walked us through the plaza three times so we'd make it out alive.", expression: "wounded" },
        { body: "My mother's alive. She's been alive the whole time, and every good thing in my life was something she arranged. I don't know what to do with that. I've been sitting here an hour trying to work it out.", expression: "shocked" }
      ],
      inner: [
        { body: "Ndara went after Coyne alone, because she does everything alone. Now she's upstairs, breathing but not waking up. Khione sits with her most nights. I've started sitting with her too.", expression: "wounded" },
        { body: "My mother asked me to be a king. Lucian, when he was dying, told me not to fight for thrones. I keep thinking about both of them, and I still can't choose between them.", expression: "guarded" },
        { body: "Khione says there's a part of the story nobody's told me. She said it kindly, which is somehow worse. I'm going down to the quay in the morning. I don't think I'll like what's on that ship.", expression: "guarded" }
      ],
      paths: [
        { body: "I had seven names in my head for three days, and then I picked one, out loud, in front of everyone. It's mine now. Nobody handed it to me. That's new.", expression: "resolute" },
        { body: "My mother let me reach that ship. She told me so on the dock. Othren was hers, Khione was hers, all of it. She spent thirty years arranging my life, and the last thing she arranged was letting me go. I still don't know what to do with that.", expression: "wounded" },
        { body: "Corin came aboard and stood at the stern for an hour holding his sister's clasp. I stood next to him and didn't say anything. It seemed like the right thing to do. Later he told me it was.", expression: "guarded" }
      ],
      war: [
        { body: "They're singing my name all over the camp, because I held one line where people could see me. My mother wrote that song. All of it except my name.", expression: "guarded" },
        { body: "Three battles in nine days, and I've stopped counting rounds. Lucian used to say the harvest doesn't care how tired you are. It meant something different back on the farm.", expression: "wounded" },
        { body: "Ranatoli's back. Selene's back. Two of the original eight, after two years. I keep looking over to check they're still there, and they keep catching me doing it.", expression: "warm_half_smile" }
      ],
      fleet: [
        { body: "The kings' war ended the morning the sky opened. The armies just haven't heard yet. Riders went out to Serrick's remnant, to Halden, and to my father. We've been enemies for two years, and now I'm sending them all the same letter.", expression: "resolute" },
        { body: "Khione says they came to her shore first, before any of our maps were drawn. Everyone she fought beside is dead. She's kept that to herself the whole time I've known her, and I never once asked.", expression: "wounded" },
        { body: "Veya says the light coming from the east is bent. Ning says the birds flew inland four days ago. Maya can't figure out what they want. I've never seen Maya stuck like that.", expression: "guarded" }
      ],
      endgame: [
        { body: "It's over. I keep telling myself that and waiting to believe it. (He counts the squad.) Eight of us made it to the end. I'd have taken much worse odds than that.", expression: "warm_half_smile" },
        { body: "Somebody asked me today what I'll do now. I told them the truth: I don't know. Nobody's handed me a plan in a week. It's the strangest holiday I've ever had.", expression: "guarded" },
        { body: "I took Lucian's practice sword out again this morning. There's a word carved in the grip. I put it there in the ninth month of the crossing and I've never shown anyone. I'm not going to now, either.", expression: "wounded" }
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
        { body: "The forge work's been thin this season, but the squad eats. Mira keeps pretending she doesn't know how much I'm setting aside for the next quarter's tax. She knows.", expression: "fatherly_smile" },
        { body: "Amar's been off since the throne hall. You see it. Don't ask him about it. He'll tell us when he's ready or he won't. Either way's all right with me.", expression: "grim_resolve" },
        { body: "Tali asked me where the squad goes when we leave. I told her we go places where the work needs doing. She said okay. She didn't ask if we always come back. I don't think she knows to ask that yet.", expression: "fatherly_smile" }
      ],
      post_field: [
        { body: "The captain who sent us against the mountain bandits — he sent us with five units against seven. He's done that twice this month. I've started keeping a count.", expression: "grim_resolve" },
        { body: "Maya's watching us. Fine. She'll get to whatever she's after when she's ready. It doesn't change the squad either way.", expression: "fatherly_smile" },
        { body: "Leo's a soldier like his father, and he isn't. I can see the part that isn't. He'll work out what to do about it in his own time. The squad won't push him.", expression: "grim_resolve" }
      ],
      post_doubt: [
        { body: "Mira and Tali. If something happens out here, your job is them. I've said it to Maya and to Ning too. You're on the list. Don't argue.", expression: "grim_resolve" },
        { body: "Ning saved me from a bolt this morning, her first time. Shoved me out of an archer's lane and gave me a black eye doing it. She'll do.", expression: "fatherly_smile" },
        { body: "Maya's who I thought she was. The details are just different. I'm relieved, your highness. Really. The squad's closer now the truth is out.", expression: "fatherly_smile" }
      ],
      post_para: [
        { body: "We rode out of Thuling at three in the morning. I haven't slept since. The cousin will move Mira and Tali north before sunrise. They'll be all right. They will.", expression: "grim_resolve" },
        { body: "Whatever happens at the cliffs, your highness — and don't tell me to stop calling you that — the squad needs to make the boat. That's the only thing that matters. We make the boat.", expression: "fatherly_smile" },
        { body: "Kian was at my front door with twelve men and a sealed warrant, using his old drill-yard voice. I trained spear with him at sixteen, and now he's got a writ for the man I trained him to protect. I don't blame him. I blame the writ.", expression: "grim_resolve" }
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
        { body: "Lucian doesn't say I did well. He says \"yes\" or \"no\" about whether the target dropped. A \"yes\" still feels like a pat on the back.", expression: "startled" },
        { body: "I had a brother. He'd be thirteen now if the harvest hadn't failed when it did. He was the bowyer first — I was just the one carrying his quivers. Sometimes a draw goes just right and it feels like he's the one pulling it.", expression: "startled" }
      ],
      post_field: [
        { body: "Maya saw me try a tighter draw last week and didn't say anything. Three days later she walked past my fletching bench and left a drift-feather quill on it without breaking stride. I think that's how she compliments people.", expression: "focused_bow" },
        { body: "Leo asked me how I knew which arrow was mine in the dark. I said the fletching's tied with twine I twist myself. He said that's the same answer his father gave him about reins. Neither of us said much after that.", expression: "focused_bow" },
        { body: "I haven't gotten used to dropping people. I don't think I want to. If I ever do, I should put the bow down.", expression: "startled" }
      ],
      post_doubt: [
        { body: "Lucian took a bolt for me in the ravine. I was standing in the lane and I didn't see the archer. I'm never standing in a lane I haven't checked again. I've decided.", expression: "focused_bow" },
        { body: "The promotion took six minutes after the ravine. It felt like six years. I'm not the bowyer's apprentice anymore. I'm the squad's archer. I'm ready to be that.", expression: "focused_bow" },
        { body: "Maya told me tonight what she actually does. I'd guessed some of it, just not the details. She asked if I was angry. I said no. I'm relieved. Everyone in this squad has been hiding something. Now there's one less secret.", expression: "focused_bow" }
      ],
      post_para: [
        { body: "I covered the rear at Lucian's door with twelve arrows nocked in twelve seconds. Nobody got past me. Lucian made me confirm three times. He always does that.", expression: "focused_bow" },
        { body: "Mira said goodbye to me at the back gate like it was an ordinary night. She knew what was happening, and she still said it like an ordinary night. I can't stop thinking about that.", expression: "startled" },
        { body: "I have my brother's quiver in my pack and Lucian's spare bowstring on my belt. The squad is what's left of the people who taught me anything. I'm not leaving any of it behind.", expression: "focused_bow" }
      ],
      crossing: [
        { body: "I didn't realize I was crying until Maya put a hand on my arm. Lucian was the first person who told me I was good at something. I'll write to Mira and Tali too. They should know what he meant to us.", expression: "startled" },
        { body: "Lucian's bowstring is on my belt. The wooden practice sword Amar carries — Lucian carved that too, he told me once. He was always making things. Now we've each got something of his.", expression: "focused_bow" },
        { body: "Khione gave me a windrose this morning. Said the sea throws fletching off and a windrose helps you re-tune. I don't know why she gave it to me specifically. I think Maya said something to her.", expression: "focused_bow" }
      ],
      grude: [
        { body: "Everything here is stone and stairs. After fourteen months on a deck I've forgotten how to walk uphill. I fell UP three steps this morning. Leo saw. I'll never hear the end of it.", expression: "eager_grin" },
        { body: "Rose said at the briefing that the plaza would take eight minutes, and it did. Then the back door opened and the plan fell apart. She was so exact about everything.", expression: "startled" },
        { body: "I count the squad at every fire. Four of us, and one who's new, and two who are gone. It's a stupid habit and I'm not stopping.", expression: "exhausted" }
      ],
      inner: [
        { body: "Their quartermaster sold us out. He ran the supply line for nine years, and then he told them how to get into our house. I don't get how somebody spends nine years on something and then wrecks it.", expression: "startled" },
        { body: "Veya let me hold the rig. It's heavier than it looks and it hums when the light's right. She talked about it for forty minutes and I understood maybe six. I'd sit through the other thirty-four again.", expression: "eager_grin" },
        { body: "Amar's mother wants him on a throne. Lucian told him not to. All I'll say is, I know which one of them fed us when the wagons burned.", expression: "focused_bow" }
      ],
      paths: [
        { body: "He picked one. Out loud, in the hold, in front of everybody. I've waited two years for people to stop telling him what he's supposed to be.", expression: "eager_grin" },
        { body: "Ndara walked out of that cabin on her own legs, just to tell him to stop worrying about everyone else's answers. Khione caught her before she fell. Neither of them made a fuss about it.", expression: "startled" },
        { body: "We're going somewhere nobody has a warrant for us. Do you know how long it's been? (She counts on her fingers, then stops.) Since Thuling. It's been since Thuling.", expression: "focused_bow" }
      ],
      war: [
        { body: "I used to count arrows. Now I count the people I chose not to shoot. It's a harder thing to count, and I can't go back to counting arrows.", expression: "exhausted" },
        { body: "The granaries were burning before we got there. All that grain. My town lost a winter's food once. I know exactly what that street's going to be like in three months.", expression: "startled" },
        { body: "The big man with the shield walked out of the prison row and Amar just — went. Straight across the ash, didn't even put his sword away first. I've never seen him move like that.", expression: "eager_grin" }
      ],
      fleet: [
        { body: "My bowstring went in the surf again. Third one this week. Ranatoli splices them before I ask now. I haven't thanked him properly. He'd only make a joke of it.", expression: "exhausted" },
        { body: "They come out of the water in a line and they don't shout. No orders, no drums, nothing. I just aim for the joints. That's all I've got, and it's worked so far.", expression: "focused_bow" },
        { body: "Selene took the ridge watch and came back with the exact number of them, and how they walk, and which one gives the orders. Two hours. She said eleven words about it.", expression: "startled" }
      ],
      endgame: [
        { body: "It's quiet. Properly quiet, not between-waves quiet. (She keeps looking east anyway.) I'll stop doing that eventually. Ranatoli says it took him a year after the cells.", expression: "exhausted" },
        { body: "I'm going to rebuild the rivet press. The one in Thuling, the actual one. I've been drawing it on the back of a map for two weeks. It's going to be better than the old one.", expression: "eager_grin" },
        { body: "Everyone who taught me anything is either at this fire or buried. I don't mean that sadly. I'm going to go teach somebody the draw now. That's the point.", expression: "focused_bow" }
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
        { body: "The squad's closer than the briefing said. Lucian keeps it together. Amar keeps to himself. Ning holds her ground. It'll do for what's coming. I'm not saying what that is yet.", expression: "calculating_side_glance" },
        { body: "Amar's footwork is from a courtyard, not a wagon yard. I haven't said it out loud. I might not for a while. He's waiting for me to ask, and I want to see what he does when I don't.", expression: "calculating_side_glance" },
        { body: "Madame Dawn's last courier brought a list of three names she wants verified. I sent back two confirmations and a maybe. The maybe is Amar. I'm holding onto the maybe until I know what to do with it.", expression: "guarded_neutral" }
      ],
      post_field: [
        { body: "Took the south flank at the canyon ambush before Lucian called it. He didn't reprimand me. He didn't praise me either. He just adjusted around me. That's the kind of trust I respect most.", expression: "guarded_neutral" },
        { body: "Leo's been off since the village we burned through last month. He keeps looking at the road south. He's going to make a call soon. I'll be ready when he does.", expression: "calculating_side_glance" },
        { body: "Fergus's last three contracts were unwinnable on paper. We won them anyway. He's going to send something we can't win soon. I've been getting ready for it since Orinhal.", expression: "calculating_side_glance" }
      ],
      post_doubt: [
        { body: "I told them tonight. The whole truth: Dawn, how she placed me here, eleven months of spying on all of you. Lucian smiled. Lucian! I hadn't expected that. I'd planned for a knife.", expression: "steel_cold_confession_face" },
        { body: "Ning won't take a bolt for just anyone in the squad again. She'll decide for herself who's worth it. That's right for who she is now.", expression: "guarded_neutral" },
        { body: "Amar asked me to wait before telling him what I know about his old life. I'll respect that, and I'll wait. But the ship to Grude takes fourteen months, and I'm not spending all fourteen of them keeping it from him.", expression: "calculating_side_glance" }
      ],
      post_para: [
        { body: "The east watch caught me leaving the back gate of Lucian's house at 3:48 AM with Mira on one hip and Tali by the hand. She didn't recognize me. The makeup helped. Tali asked twice if I was a witch. I said yes. She seemed satisfied.", expression: "guarded_neutral" },
        { body: "The cousin's farm is north of the King's Road, two valleys past the trader's bridge. Mira and Tali will be safer there than they would be in any city Dawn could put them in. I made the choice without asking Lucian. I'd make it again.", expression: "calculating_side_glance" },
        { body: "Kian saw me on the back lane. He saw me. We made eye contact. He turned his head and walked into the front yard like he hadn't. That's the second time he's gone easier on us than his orders said to.", expression: "guarded_neutral" }
      ],
      crossing: [
        { body: "The flag was on the wall of his front room. I took it on the way out the back gate without thinking about why. I thought about why on the deck of the ship at dawn. I wrapped him in it. It was the right call.", expression: "steel_cold_confession_face" },
        { body: "Khione says fourteen months. I'm using it. Reading. Drawing maps from memory. By the time we land I want to know Grude better than its tax officers do. Ask me about the upper district market in eight months.", expression: "calculating_side_glance" },
        { body: "Lucian asked me to look after Mira and Tali if anything happened. I said yes. I meant it. I'll write to them every season for the rest of my life. He'll know somehow. He always does.", expression: "guarded_neutral" }
      ],
      grude: [
        { body: "Eight months of reading and I still walked us past the wrong customs platform. Maps don't tell you which officer has been told what. I won't make that mistake twice.", expression: "guarded_neutral" },
        { body: "Rose and I trained in the same cohort. We wrote to each other for twelve years and got one evening in the same room. I keep starting a report to her out of habit and getting three lines in before I remember.", expression: "tearful" },
        { body: "For eleven years I believed his father was dead because she told me so. I never checked. I check everything, and I never checked that.", expression: "steel_cold_confession_face" }
      ],
      inner: [
        { body: "I spent three months on the study floor going through manifests. Every message in that house crossed one desk before it reached hers: Coyne's. Ndara worked it out an hour before me and went alone. I should have said the name louder.", expression: "steel_cold_confession_face" },
        { body: "She's giving orders now instead of asking. That's a big change. When Dawn stops asking, it means she's decided she can afford to lose the people around her.", expression: "calculating_side_glance" },
        { body: "Whatever she offers him tomorrow, he needs his answer ready before he hears it. Otherwise he'll just agree with her. He's better than that. But she's better at this than anyone.", expression: "guarded_neutral" }
      ],
      paths: [
        { body: "I spent eleven years steering him toward whatever Dawn wanted. Then I stood in a ship's hold and told him he doesn't have to do what anyone wants anymore. Best thing I've ever said out loud.", expression: "soft_genuine_smile" },
        { body: "Ndara woke up on this ship. Khione carried her aboard two nights before the quay and told no one. I check everything, and I missed a whole marshal in the hold. That woman is a better spy than I am.", expression: "calculating_side_glance" },
        { body: "No warrant, no map, no handler, and no plan for after we land. I should be terrified. Ask me why I'm not and I'll deny I said any of this.", expression: "guarded_neutral" }
      ],
      war: [
        { body: "Two kings sacrificing other people's sons on the same afternoon. I've read the books for both sides, and neither one adds up. They never did.", expression: "calculating_side_glance" },
        { body: "They're chanting his name out there. Once a crowd knows your name, they know who to blame when it goes wrong. I've watched her do that to better men. I'll be keeping an eye on him.", expression: "guarded_neutral" },
        { body: "Corin's sister taught me the stance I still use. He watches me drill and doesn't say anything about it. I let him. It's the only place he can still see her.", expression: "tearful" }
      ],
      fleet: [
        { body: "They test us, work out what we're worth, then push harder. It's how you'd size someone up before a deal. I've done exactly that to people myself. It's very strange being on the receiving end.", expression: "calculating_side_glance" },
        { body: "I've always been able to work out what the people in a room want. Kings, wardens, Dawn. I can't work this out, and I'd rather say so now than have you all find out at the wrong moment.", expression: "alarmed" },
        { body: "Khione told me tonight what happened to her shore. Not the version she tells the squad. The real one. I'm not going to repeat any of it.", expression: "guarded_neutral" }
      ],
      endgame: [
        { body: "They ran the numbers and walked away. I've spent twenty years being somebody's asset, and the one valuation I'm proud of is the one that said we weren't worth the trouble.", expression: "soft_genuine_smile" },
        { body: "The councils are arguing about a bridge. Just a bridge, and who pays for it. It's the most boring thing I've ever helped organize.", expression: "guarded_neutral" },
        { body: "I reported on him for eleven years. Every grip he corrected, every night he didn't sleep. There's one line I never filed. I'm still not filing it. Don't ask.", expression: "tearful" }
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
        { body: "Father sent me with the squad to see how I'd ride. I think he meant the dactyl. I've been finding out other things about myself instead.", expression: "ready" },
        { body: "Ndara got away on a dactyl off the mountain ridge. She circled once before she left and looked down at us. I keep thinking about that. She knew exactly what she was looking at.", expression: "resolute" },
        { body: "The dactyl's name is Ash. He's three years old, raised in the Para roost, took a year to bond. The squad calls him Kid. He doesn't mind. He likes Ning. She gives him fletching scraps.", expression: "ready" }
      ],
      post_doubt: [
        { body: "Walked the dactyl to the partisan side at Orinhal. Out loud, in front of the King's men. I haven't been able to stop smiling about it. Don't tell Lucian I said that.", expression: "ready" },
        { body: "Father's letter caught up to us at the next inn. He didn't write what I expected him to write. He wrote what I'd hoped he would. I can't decide if that's harder.", expression: "resolute" },
        { body: "Maya pulled me aside after the ravine and said she'd known for months which way I'd jump. I asked how. She said \"the way you look at villages.\" I think about that line every time we ride past one now.", expression: "resolute" }
      ],
      post_para: [
        { body: "Cleared the back lane in three minutes flat with the dactyl. Mira held on like she was born on a saddle. Tali asked if she could keep flying. I told her maybe later, kid.", expression: "ready" },
        { body: "Lucian gave me the south watch tonight. He hasn't given me a watch in months — I'm too senior, he says. He gave me one tonight because he's not sure he'll be around tomorrow. I won't say anything to him. I'll just take the watch.", expression: "resolute" },
        { body: "Father always told me the first man who breaks ranks loses the day. I broke ranks at Orinhal and we didn't lose. I think Father was wrong about that for years and never tested it.", expression: "ready" }
      ],
      crossing: [
        { body: "The dactyl doesn't like the deck. Won't sit. Khione says he'll settle by week three. The dactyl's the only one of us who hasn't lost anyone yet. Maybe that's why.", expression: "resolute" },
        { body: "I keep expecting to see Lucian come up the deck stairs to check the rear watch. He didn't do it last night, won't do it tonight, won't do it tomorrow. I keep expecting it anyway.", expression: "wounded_pride" },
        { body: "Wrote to my father this morning. Three pages. I don't know if the letter will reach him before Grude. I don't know what he'll do with it if it does. I wrote it anyway.", expression: "resolute" }
      ],
      grude: [
        { body: "There's no sky here. I mean there is, but it's got a city in front of it. Ash won't go up over the terraces — too much stone, too many bells. First time in my life I've been the one on foot.", expression: "wounded_pride" },
        { body: "Rose put me on the captain in the plaza and I took him in four passes. Cleanest work I've ever done. And it didn't matter at all, because of a door nobody knew was there.", expression: "resolute" },
        { body: "So his mother's the queen of the rebellion and his father's the emperor. (He whistles.) And people used to tell ME I had a complicated family.", expression: "cocky_smirk" }
      ],
      inner: [
        { body: "A traitor in the house. Nine years in her supply line. (He checks a strap he already checked.) My father would have said that's what happens when you trust people you didn't grow up with. My father was wrong about most things.", expression: "wounded_pride" },
        { body: "Ash gets the run of the courtyard now, and Ndara's window looks onto it. Khione says a coma still hears. So he goes and makes a racket under her window every morning. It's a THEORY.", expression: "ready" },
        { body: "Amar's been stuck on a question for a week. I can see it on him. I made my own choice at Orinhal. That doesn't mean I can make his for him.", expression: "resolute" }
      ],
      paths: [
        { body: "He picked one. Doesn't matter which — well, it does, but you know what I mean. I've been waiting two years for that man to choose something for himself instead of being handed it.", expression: "cocky_smirk" },
        { body: "Open water and no orders. Do you know what my father's whole life was? Orders, and being the man who gave them. He'd hate this. He'd absolutely hate this. I love it.", expression: "ready" },
        { body: "The lancer's all right, by the way. Corin. Doesn't talk much, doesn't laugh at anything, keeps a rotation like it's a religion. Ash likes him. Ash is never wrong about people.", expression: "resolute" }
      ],
      war: [
        { body: "The field before Grude was the biggest thing I've ever flown over. Two armies, all the way to both ridges. You can't see people from up there. That's the part that bothers me.", expression: "wide-eyed_horror" },
        { body: "Their cavalry came at the barricade six times. I can still feel it through my boots. We held with a fence and some carts. A FENCE.", expression: "wounded_pride" },
        { body: "Three battles in nine days. I stopped being scared somewhere around the fence line and I genuinely can't tell if that's good.", expression: "resolute" }
      ],
      fleet: [
        { body: "I put three feet of steel through one and it looked surprised. Not hurt. Surprised. Ash won't fly over them. Won't. First time he's ever refused me anything.", expression: "wide-eyed_horror" },
        { body: "Ranatoli's told the same story four nights running and the number of men in it has gone from nine to twenty-two. Nobody's stopping him. It's the best thing about this camp.", expression: "cocky_smirk" },
        { body: "I'm sick of being tested by things with no faces. Let one of them land where I can reach it. That sounded better in my head. Don't tell Maya I said it out loud.", expression: "ready" }
      ],
      endgame: [
        { body: "When this is over Ash and I are going to fly the coast. That's the whole plan. That's it, that's the entire plan. (He's said this eleven times.)", expression: "cocky_smirk" },
        { body: "My father gave me a list of everything my life was supposed to be. I went the other way, and this is where I ended up. I'd do it again.", expression: "resolute" },
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
        { body: "I'm slower than I was. Shield's the same weight, the arm isn't. (He shrugs it off.) A shield-man doesn't need to be fast. He just needs to stay put.", expression: "dry_skeptical" },
        { body: "Nine of them at the north gate, and I held it alone with a cracked shield until the line re-formed. It was six last night, I know. It grows. That's what stories do — they get more honest about how it FELT.", expression: "lecturing" }
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
        { body: "I asked if you were ready. You said yes. I know. I'm not going to make you say it twice." }
      ],
      fleet: [
        { body: "I've been three streets behind you since the harbour. Long enough to see who you let live. That's how I knew it was still you." },
        { body: "Found tracks on the eastern ridge this morning. Wolves walking next to deer, and neither one hunting. I've tracked for twenty years. I've never seen that." },
        { body: "For two years nobody knew where I was. It was simpler. (She checks the string again.) I'm not saying it was better.", expression: "cold_contempt" }
      ],
      endgame: [
        { body: "It's over and my hands still go to the string every time a bird moves. Give it a season." },
        { body: "I said something in my sleep on the crossing. You heard it, and you never asked. Thank you for that.", expression: "breaking" },
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
        { body: "Nine years I signed off on that plate. Nine years of inspections, and not once did the court ask me what I'd learned about where it fails. Their loss. Quite literally, in the street outside.", expression: "wry_smile" },
        { body: "I ground lenses so men could see farther and take more. After the plaza they put my name on their lists anyway. So now I'm working against them. It took me nine years to make that small a change.", expression: "grim_resolve" },
        { body: "Ning asked me how the rig works. I talked for forty minutes. She stayed for all forty. Nobody at court ever stayed past five. I'd have defected years earlier if I'd known people like her were out here.", expression: "wry_smile" }
      ],
      inner: [
        { body: "Their quartermaster sold the enemy the door I was standing behind. I have opinions about men who are trusted for nine years and then sell out in one afternoon.", expression: "alarmed" },
        { body: "The rig's front element has a flaw, lower left, from the quay. I could regrind it in an afternoon with a proper bench. I'm keeping it, so I remember what happened there.", expression: "grim_resolve" },
        { body: "A field posting at my age. My mother wanted me to marry a magistrate. I'd like the record to show I'm having a considerably better time than that.", expression: "wry_smile" }
      ],
      paths: [
        { body: "Sea air is terrible for optics and wonderful for everything else. I've recalibrated twice a day since we sailed. I'd do it four times for this view.", expression: "wry_smile" },
        { body: "He chose without asking me what I thought. Good. I've spent my career giving measurements to men who'd already made up their minds. He's the first one who actually decided for himself.", expression: "focused" },
        { body: "The lancer asked me — politely, at length — whether the rig could be mounted to a saddle. I said no. He asked twice more. I'm now sketching it, which I resent.", expression: "wry_smile" }
      ],
      war: [
        { body: "Half those boys were forced into the army at spear-point, out of villages exactly like the ones behind us. The officers give the orders, so I shoot the officers and leave the conscripts alone. It's just sensible targeting.", expression: "grim_resolve" },
        { body: "The glassworks in the upper district survived the fire. Barely. Do you understand what I could BUILD with a proper annealing oven — sorry. Sorry. There's a war on.", expression: "focused" },
        { body: "Smoke does interesting things to a beam. Scatters it, mostly, which is a polite way of saying it ruins it. I spent two nights working around that. The city was burning. It seemed like the useful thing to do.", expression: "focused" }
      ],
      fleet: [
        { body: "The light from the east is coming in bent. I thought it was the sunset, but it's a real reading, and it's getting stronger. I've checked it eleven times. It keeps being true.", expression: "alarmed" },
        { body: "One lens bends the light a little. Seven of them together force it. I built this from salvage out of a burned observatory in two nights. It's the best work of my life and I'd like that noted.", expression: "focused" },
        { body: "It soaked up four of my seven colours before it broke off. It was studying my beam while I was cutting into it. Nothing I've aimed at has ever looked back at me before.", expression: "grim_resolve" }
      ],
      endgame: [
        { body: "Lighthouses. That's what I want next. Instruments whose whole purpose is helping people see what's coming. After the last few years I find the idea almost aggressively pleasant.", expression: "wry_smile" },
        { body: "Four years ago I was measuring plate seams for men who wanted to take more. Nobody has asked me to help anyone take anything in a very long time.", expression: "neutral" },
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
        { body: "Maya stands the way my sister taught her. First position, weight back, chin level. I watched her drill tonight and forgot to breathe for a moment. It is not grief, exactly. It is more like seeing my sister again.", expression: "quiet_grief" },
        { body: "I asked the Marshal one question on that dock, and he did not answer. That told me enough. Nine years I took his orders. I'd have taken nine more. He should have lied to me, Captain. It would have been kinder.", expression: "torn" }
      ],
      paths: [
        { body: "For nine years we lived two streets apart, and the rebellion kept us apart on purpose. I never saw the lemon tree they buried her under. (He turns the clasp over.) I will see it. Not yet.", expression: "quiet_grief" },
        { body: "The horse is settling. It takes a saddle without a fight now. Everyone in this camp is someone the war nearly used up. The horse included. Maybe me.", expression: "resolute" },
        { body: "There's no chain of command here. I asked who I report to and the archer said \"everyone, mostly at dinner.\" I have been in service since I was fifteen. I am adjusting.", expression: "neutral" }
      ],
      war: [
        { body: "The rotation holds even here: feed, tack, watch, fight. Angry men break formation, and I have buried a great many angry men. Keeping discipline is the only thing I can still do for them.", expression: "resolute" },
        { body: "The destrier came out of the prison-row stables and looked me over for a full minute before it lowered its head. Nobody had ridden it since its rider died on the processional. We understand each other.", expression: "battle_fury" },
        { body: "Rose held doorways. That was her whole method: find the door, stand in it, do not move. (He checks the girth strap.) I am cavalry. I break through them. Somebody in the family ought to.", expression: "quiet_grief" }
      ],
      fleet: [
        { body: "Horses will not charge surf. So we dismounted and held the dune the way she used to hold a doorway. (He works a buckle loose.) The horse forgave me around midnight.", expression: "resolute" },
        { body: "They take their dead now. The Herald's wave did, anyway. The first two waves left theirs where they fell. This one carried its own off the field. I don't know what that means, but it means something.", expression: "torn" },
        { body: "The old scholar tells the same story every night with a different number in it. In the cavalry we'd have called that a morale officer and paid him properly.", expression: "neutral" }
      ],
      endgame: [
        { body: "The rotation holds out of habit now rather than need. Feed, tack, watch, sleep. (He stands the last watch anyway.) I'm aware. I'm not stopping.", expression: "resolute" },
        { body: "The account I opened on that dock is settled. (He touches the silver rose at his cloak.) Nobody owed me anything. It was all I had left of her, and I needed somewhere to put it.", expression: "quiet_grief" },
        { body: "I am the last Eseldra. So the name has to mean something other than a family now. I have been thinking about what.", expression: "torn" }
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
        { body: "The General's compliments, and a standing instruction to keep an eye on the marsh road. I'd have come anyway. I've known him since he was thirteen and couldn't hold a stance for a count of four.", expression: "knowing_smile" },
        { body: "Lucian runs this line better than the King's own sergeants run theirs, and he does it with a forge crew. I'll be putting none of that in the report.", expression: "knowing_smile" },
        { body: "He drops his shoulder before a thrust. Same tell he had at eleven. He's lost a great deal, but he kept that. I find that reassuring. I'm not sure I should.", expression: "wounded" }
      ],
      post_field: [
        { body: "The squad's footwork is improving. Even Amar's. Especially Amar's. Funny how that works.", expression: "knowing_smile" },
        { body: "Fergus is sending us against harder targets each rotation. You see it. I see it. The question is whether we'll see it the same way when it matters.", expression: "knowing_smile" },
        { body: "Lucian and I trained spear together at sixteen. Same yard. Same instructor. He went into the forge. I went into the King's service. Funny how some choices can't be undone, the older you get.", expression: "wounded" }
      ],
      post_doubt: [
        // Kian's still in the squad through B9 per ACTIVE_ROSTER —
        // narratively the gap between his ally face and his coming
        // betrayal at B10 is widening. These lines surface the
        // strain without spoiling the warrant reveal.
        { body: "Lucian's started keeping a count of how many soldiers Fergus sends us against vs. how many he should. I've seen the count on Lucian's wrist. I've started keeping my own. The numbers match. I haven't told Lucian.", expression: "wounded" },
        { body: "I have orders I haven't read yet. They came in a wax-sealed pouch from Para three days ago. I keep meaning to open them. Not tonight, though.", expression: "knowing_smile" },
        { body: "Amar — your highness — I'm sorry... I haven't said that out loud yet. I will. Not tonight, but eventually.", expression: "wounded" }
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
  completedBattles: string[],
  // Who Amar married (save.flags[ROMANCE_FLAG]), when anyone.
  partner?: string | null
): DialogBeat => {
  const talk = CAMP_TALK[characterId];
  const era = eraFromCompletedBattles(completedBattles);
  // After the wedding the fire talks about little else.
  const wed = talk && era === "endgame" ? weddingLine(characterId, partner) : null;
  if (talk && wed) {
    return { speaker: talk.name, portraitId: talk.portraitId, expression: wed.expression, body: wed.body };
  }
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
      body: `(${talk.name} looks up from the fire but doesn't say anything.)`
    };
  }
  // No CAMP_TALK entry at all — fall back to a generic narrator beat
  // referencing the character id by name.
  return {
    portraitId: "narrator",
    body: `(They look up from the fire but don't say anything.)`
  };
};

// ---- After the wedding -------------------------------------------------------
//
// Once the war is won and Amar has married (save.flags[ROMANCE_FLAG]), the
// camp's last nights belong to it: the one he married talks about married
// life, Amar talks about them, and everyone else has an opinion about the
// wedding. Registers per docs/VOICE.md. Ndara keeps the war office and
// isn't at the fire, so she only appears in other people's lines.

const SPOUSE_NAMES: Record<string, string> = {
  selene: "Selene", corin: "Corin", ning: "Ning", leo: "Leo", maya: "Maya", veya: "Veya", ndara: "Ndara"
};

/** The one he married, at the fire. */
const SPOUSE: Record<string, CampLine[]> = {
  selene: [
    { body: "He snores. Left side only. (She doesn't look up from the fletching.) I sleep on the right." },
    { body: "I tracked him across an ocean once. Now he's just across the tent." }
  ],
  corin: [
    { body: "Roster amended. Last watch: two names, one tent. (He holds the sheet a moment longer than reading it takes.) Procedure is satisfied.", expression: "resolute" },
    { body: "Rose would have filed a complaint about the arch of lances. Unregulated. She'd have stood under it first.", expression: "quiet_grief" }
  ],
  ning: [
    { body: "Four hundred and twelve days from the hospital to the wedding. I counted. I haven't stopped counting. I'm just counting different things now.", expression: "eager_grin" },
    { body: "He keeps helping at the press. He holds the rivets wrong. I'm not telling him. It's the best part of my morning." }
  ],
  leo: [
    { body: "Married. Me. Ash took it better than my father would have. Ash took it better than I did.", expression: "cocky_smirk" },
    { body: "I had a whole speech. Good one. Jokes in it. (He fusses with a strap.) He said yes before the first joke. Wasted material.", expression: "ready" }
  ],
  maya: [
    { body: "Joint accounts. I've audited worse. (She doesn't look up from the ledger.) He's in credit, if you're asking. He's always been in credit.", expression: "soft_genuine_smile" },
    { body: "Someone asked me what he's worth to me. Professionally insulting question. I didn't give them a number. That was my answer.", expression: "calculating_side_glance" }
  ],
  veya: [
    { body: "He wears the ring lens-side in, so everything looks a little warm at one edge. That's a flaw in the grind. He knows that.", expression: "wry_smile" },
    { body: "He got my ring size wrong by half a size. (She holds up her hand.) I haven't had it resized. Don't tell him.", expression: "focused" }
  ]
};

/** Amar, about the one he married. */
const AMAR: Record<string, CampLine[]> = {
  selene: [
    { body: "Selene still checks the treeline before she sits down. I've started checking it too. We're a pair.", expression: "warm_half_smile" },
    { body: "She doesn't say much, but she says enough. (He turns the ring on his finger.) That's really all there is to it." }
  ],
  corin: [
    { body: "Corin stands the last watch. I stand it with him. It's not really a watch anymore. It's just when we talk.", expression: "warm_half_smile" },
    { body: "He folds my shirts. Regulation fold. I don't know what to do about how much I like that." }
  ],
  ning: [
    { body: "Ning's teaching me the rivet press. I'm bad at it. I think she's noticed I'm bad on purpose.", expression: "warm_half_smile" },
    { body: "She counts things when she's happy. Last night it was stars. She lost count at three hundred and started over." }
  ],
  leo: [
    { body: "Leo tells everyone the proposal was his idea. It was. I just got there first.", expression: "warm_half_smile" },
    { body: "Ash sleeps across the tent door now. I think he's guarding Leo from me. I think he's losing." }
  ],
  maya: [
    { body: "Maya keeps the household ledger. There's a line in it she won't let me read. (He doesn't try to.) I think I know what it says.", expression: "warm_half_smile" },
    { body: "She still watches every room we walk into. Now she tells me what she sees. That's new. That's most of what's changed." }
  ],
  veya: [
    { body: "The lens in this ring bends the light warm on one side. (He looks through it at the fire.) Veya says it's a flaw. I'm keeping the flaw.", expression: "warm_half_smile" },
    { body: "She measured how long I took to say yes. She won't tell me the number." }
  ],
  ndara: [
    { body: "Ndara's letters come every week by runner. Supply reports. (He shows one.) Last line every time: return intact. I'm keeping all of them.", expression: "warm_half_smile" },
    { body: "She ran a war from a chair and never raised her voice. She raised it once at the wedding, to say yes. (He smiles.) Whole tent heard it." }
  ]
};

/** Everyone else, about the wedding ({name}: who he married). */
const SQUAD: Record<string, CampLine[]> = {
  ranatoli: [
    { body: "I cried at the wedding. It was the wind. (He wipes his eyes.) It's still the wind. There's been a great deal of wind lately.", expression: "satisfied" },
    { body: "Captain-my-Captain and {name}. (He raises his cup.) I told that boy years ago he'd feast one day. I never said with whom. I'm a modest prophet.", expression: "satisfied" }
  ],
  ning: [{ body: "Amar and {name}. (She starts counting on her fingers, then stops.) I don't need to count anything. That's how I know it's good.", expression: "eager_grin" }],
  maya: [{ body: "Amar and {name}. I'd have priced it as a long shot. Good thing nobody asked me.", expression: "calculating_side_glance" }],
  leo: [{ body: "Amar and {name}! I called it. I didn't, actually, but I'm saying I did, and nobody here can prove otherwise.", expression: "cocky_smirk" }],
  selene: [{ body: "Amar and {name}. (She nods once.) Good match." }],
  veya: [{ body: "I calculated the odds of {name} saying no. (She doesn't look up.) Zero, to four decimal places. I checked my work.", expression: "wry_smile" }],
  corin: [{ body: "Amar and {name}. (He straightens.) Logged. Approved. ...I'm glad.", expression: "resolute" }]
};

const weddingLine = (characterId: string, partner?: string | null): CampLine | null => {
  if (!partner || partner === "none" || !SPOUSE_NAMES[partner]) return null;
  const pool = characterId === partner ? SPOUSE[partner]
    : characterId === "amar" ? AMAR[partner]
    : SQUAD[characterId];
  if (!pool || pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)]!;
  return { ...pick, body: pick.body.replace("{name}", SPOUSE_NAMES[partner]!) };
};
