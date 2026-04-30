# Ravage — Script

> **Source of truth:** the canonical script lives in the Google Doc at
> https://docs.google.com/document/d/1hV5u7yIGPP-N1C1Efvc9c61K-5AL0ZwUvbNONmX2QxI/edit
>
> This file is a synced copy kept in the repo so engineers and assistants
> have offline access to the lore. When the Google Doc and this file disagree,
> the Google Doc wins — but please update this file in the same change so
> they don't drift. Mechanics decisions live in `RAVAGE_DESIGN.md`.
>
> **Convention note:** the original Google Doc used "Wyvern Rider" / "Wyvern"
> in narrative passages and "Dactyl Rider" / "Dactyl King" in the class
> table. The codebase uses "Dactyl" consistently, so this synced copy has
> been normalized — Wyvern → Dactyl across the script.

## Description

After a failed coup d'état, the player character — Amar — must recruit a
new squad of allies and feign amnesia to hide their skill from the King's
monitoring agent, all while secretly preparing to conquer the true colonial
ruler, the dark lord King Archbold, and become the land's first non-monarch
leader.

## Game Progression

The player chooses to play Amar as either a man or a woman. They then
select a difficulty level — Normal, Hard, or Extreme — and decide whether
to enable "Grave" mode. With Grave mode on, any of the player's characters
who fall in battle are permanently removed from the game. With it off,
defeated characters return after the battle ends.

## Character Battle Types

### Tier 1

- Swordsman / Swordswoman
- Spearton
- Knight (mounted)
- Archer
- Dactyl Rider
- Shinobi
- Sentinel

### Tier 2 (with bond and counter relationships)

- **Swordmaster** — Bonds well with Khan, Dactyl King. Weak against Robinhelm and Shinobi Master.
- **Spearton Lord** — Bonds well with Shinobi Master, Guardian. Weak against Swordmaster and Khan.
- **Khan** (mounted) — Bonds well with Swordmaster, Robinhelm. Weak against Dactyl King.
- **Robinhelm** — Bonds well with Khan, Dactyl King. Weak against Spearton Lord and Shinobi Master.
- **Dactyl King** — Bonds well with Swordmaster, Robinhelm. Weak against Shinobi Master.
- **Shinobi Master** — Bonds well with Spearton Lord, Guardian. Weak against Guardian and Dactyl King.
- **Guardian** — Bonds well with Shinobi Master, Spearton Lord. Weak against Swordmaster and Khan.

## Story and Game Script

### Setting

The year is 2640 of the Anthros Monarch. The story takes place in a
mountainous country called Anthros, modeled on the Himalayas and Tibet.

A devastating series of conflicts between former nations has wiped out 90%
of human civilization, leaving 80% of the world uninhabitable. The only
land that still supports human life is the Anthros mountain range, home to
roughly 100 million people — most of them human — now consolidated under a
single country: Anthros.

Anthros is ruled as an absolute monarchy. Workers earn nearly identical
wages, and every property and parcel of land belongs to King Nebu IV.

A man named Amar and seven comrades are mounting a coup d'état against
him. Outraged by Nebu's inefficient and self-serving rule, they intend to
storm his palace in the city of Para and kill everyone inside, the King
included.

### First Battle — The Palace Coup

The coup unfolds inside King Nebu's palace. *(Generative AI may be used to
vary the map layout and obstacles — traps, lighting, etc.)* This is a
grand, almost boss-fight encounter. All eight units begin at level 10 and
are equipped with steel weapons.

Despite their efforts, Nebu and his royal guard repel the assault. Amar
and the entire squad are captured.

### Story

A day later, Amar wakes in a hospital bed just outside the palace with no
memory of his past. The King's most trusted right-hand man — Kian — comes
to check on him and explains that Amar was supposed to be helping the
peasants and farmers prepare for harvest season. Kian tells him he was a
key figure in the King's decade-long plan to revitalize the country's
industrial economy and to ensure that the army never went hungry. With no
awareness of his true past or the fate of his comrades, Amar is sent to
the rural city of Thuling.

Amar — the man or woman the player has chosen — picks up new skills
quickly. Within a single day, he is working both the farmland and the
steel factories, producing weapons, and earning the respect of his peers.
But even without his memories, Amar notices that Kian shadows him whenever
he is off-duty. When Amar asks why, Kian explains that the King believes
Amar can become one of the country's greatest saviors, and that he has
been ordered to monitor Amar's growth personally. He adds that, with
bandit raids on the rise, his presence also keeps Amar safe — a man with
such leadership potential is too valuable to lose.

At the steel factory, Amar is paired with the foreman: a broad-shouldered
man in his early thirties named **Lucian**. Lucian is a former apprentice
blacksmith turned factory supervisor, with a wife and a young daughter
waiting for him at a small house on the edge of Thuling. He is older than
most of the other workers, and something about Amar seems to catch his
attention from the start — the way Amar handles a hammer, the way he
balances his weight when the forge kicks out a spark. Lucian doesn't say
anything about it. He just trains Amar on the line, shares lunch with
him, and introduces him to the other workers who will eventually become
his squad.

One day, Amar and his coworkers at a local farm are attacked by bandits.
He takes up arms alongside five new friends he has made between the farm
and the steel factories — Lucian among them.

### Second Battle — Bandits in the Farmland

Bandits attack the farmland. *(Generative AI may be used here as well.)*
Halfway through the fight, Kian arrives on horseback to aid the group. He
fights as a Knight and is formidable.

Lucian fights as a Spearton — steady, economical, never out of position.
He hauls two wounded farmhands behind the hay bales during the worst of
the fighting and throws a hammer into a bandit's face when his spear is
out of reach. After the battle, while the others are catching their
breath, Lucian quietly hands Amar a rag for the cut on his hand.

Kian is unsettled to see how easily Amar handled himself. He realizes
that Amar's muscle memory and combat instincts are intact, even if his
explicit memories are not. When he confronts Amar about it, Amar feigns
terror and shows Kian a wound on his waist as proof that he has lost his
fighting ability.

The game then cuts to a flashback of the moments just before the ambush:
Amar's memories had, in fact, returned — triggered by the smell of wet
hay and iron as he loaded the wagon that morning, a smell identical to
the one in his father's barn in Para on the night he first took up a
sword. He had wounded himself deliberately on the waist to deflect Kian's
suspicion.

That night, after Kian returns to the palace, Amar gives in to the
frustration he has been hiding — the bitterness of his failed coup. He
sneaks out to search for his missing comrades, hoping they were not
executed. A discarded newspaper tells him they have somehow escaped the
King's army. Each of them now carries a bounty of thousands of gold on
their head.

As Amar flees his new home and begins his search, he is ambushed by
another group of bandits. They claim to serve a queen called Madame Dawn,
and they say her land was stolen by the current King.

Cornered, Amar is suddenly rescued by his new friends from the farm.

### Third Battle — Madame Dawn's Bandits

Bandits loyal to Madame Dawn versus Amar and his squad. Kian is not
present, and this fight is longer, with more enemies. Mid-battle, a new
character arrives — a woman named Maya. She introduces herself as another
peasant from the farmland who came to help.

When the squad takes a tactical position behind a collapsed mill, Lucian
is the one who reads the terrain aloud — sightlines, choke points, where
the bandits will try to flank. He does it the way a foreman calls out
shift assignments: clear, confident, without announcing that he knows how
to do any of it. Amar catches his eye across the barricade. Lucian simply
nods, as if to say *we'll talk about it later*, and turns back to the
fight.

After the battle, the group urges Amar to come back to their rusty home,
and he agrees. He keeps his secrets to himself and decides — for now — to
put his search for his old comrades on hold and continue the daily grind
of farm and factory work for barely-livable wages.

On their way back, the group is ambushed again by bandits also claiming
allegiance to Madame Dawn. The skirmish takes place in a swamp.

### Fourth Battle — Ambush in the Swamp

Madame Dawn's bandits versus Amar and his squad in the swamps. This time
Kian rejoins the group.

Afterward, Kian rounds on Amar and demands to know why the squad was
wandering so far from their assigned farm so late at night. Before Amar
can answer, it is Lucian who steps forward. He delivers an offhand,
slightly embarrassed story about how a few of them had snuck out for a
drink at a still-runner's shack on the hill and how everyone else came
along to drag them home. The lie is so plain and so domestic that Kian
has nothing to push against. He relents, but his suspicion of Amar
deepens. He continues to shadow Amar through every off-duty moment back
in Thuling.

That night, on the walk back to the barracks, Lucian pulls Amar aside.
He doesn't accuse Amar of anything. He only says, "Whatever you're
carrying, you don't have to carry it alone. And when you're ready to set
it down — set it down with me first." Amar doesn't answer. Lucian claps
him on the shoulder and heads home to his family.

Another of the King's generals — a man named Fergus — sees promise in
Amar's squad. He proposes that, instead of farming and factory work,
they take on bandit-hunting missions under his command. Everyone is
excited and eager to accept. Amar grows uneasy about Fergus's motives,
and Kian objects strenuously. The next day, however, while Kian is
dispatched on a separate mission, Amar's squad contacts Fergus and
accepts a contract: hunt down a band of marauders ravaging a mountain
village.

When they arrive, the village has already been destroyed, and the
bandits left behind are no ordinary thugs. Just before the battle begins,
Fergus's son Leo — a Dactyl Rider — asks to join them. Amar can't
understand why Fergus would send his own son into such a dangerous fight,
but he sets the thought aside.

### Fifth Battle — The Mountain Bandits

Amar and his squad of six face the mountain bandits, led by a mysterious
woman named Ndari.

Once Ndari is defeated, she asks Amar why he is fighting on King Nebu's
side — a question that catches him completely off guard. Does she know
about the coup? Before he can recover, Ndari escapes on a Dactyl,
leaving the rest of the group to puzzle over what she meant. Amar,
frustrated and almost ready to come clean, stops himself at the last
moment when he remembers Leo is still with them. He can't risk Leo
reporting back to Fergus. So he plays it off, claiming Ndari must have
mistaken him for someone else.

Lucian watches the exchange without saying a word. Later that night, on
the road back to Thuling, he rides beside Amar in silence for a long
while before finally speaking. "She didn't mistake you for anyone," he
says quietly. "And you've known that since she said it." Amar doesn't
deny it. Lucian tells him the rest can wait. But for the first time,
Amar has a witness.

### Sixth Battle — The Caravan

Fergus sends the squad to escort a supply caravan through the foothills
east of Thuling. The contract is routine on paper — a few wagons of
grain and steel bound for a garrison town — but the squad is ambushed
almost immediately by a coordinated force of bandits who knew the route,
the schedule, and the squad's own numbers. This is not a random raid.

The map is a winding canyon road with high rock shelves on either side.
Archers and Shinobi fire down from above, while mounted bandits seal the
entrance and exit. The squad has to hold the wagons, push a path through
the choke point, and keep the civilian drivers alive.

Mid-battle, Maya takes command of one flank without being asked. Her
instructions are precise — she calls out enemy ranges, anticipates the
Shinobi's drop attacks before they happen, and relocates the squad's
Archer to cover an angle no one else has noticed. Lucian notices. Amar
notices. No one says anything in the moment, but when the last bandit
falls and the caravan rolls free of the canyon, Lucian catches Amar's
eye once more. *Your secret isn't the only one in this squad.*

In the rubble of an overturned wagon, Amar finds a bandit's ledger. The
numbers inside are in the King's own accounting hand — a codebook every
officer of the palace is trained to read. Someone inside Nebu's court
paid these bandits to attack the caravan.

### Seventh Battle — The Ghost from Para

On their next mission, the squad is sent to clear out a group of raiders
holed up in an abandoned monastery in the high passes. Fergus claims the
raiders have been kidnapping tax collectors. The map is tight — narrow
stone corridors, chapel halls, a bell tower the squad must climb to clear
the final defenders.

When the squad breaks into the monastery's inner courtyard, Amar freezes.
The woman leading the raiders is **Selene** — a Swordmaster, and one of
his original seven coup comrades from the failed attack on the palace.
She has a price on her head in the newspaper he read a dozen chapters
ago.

Selene recognizes him immediately. She does not call out his name. She
fights the squad anyway, with the desperate competence of someone who
knows she cannot afford to lose even a step — and who has clearly been
running for a long time. Amar has to deliberately hold himself back,
fighting with only a fraction of his real skill, trying to corner her
without killing her and without letting the rest of the squad notice.

Lucian notices. He stays on Amar's flank the entire fight, absorbing
blows meant for Amar so that Amar never has to expose his real footwork.
At the end of the battle, Selene is cornered on the bell tower's upper
balcony. She and Amar lock eyes across the stone. Then she throws herself
over the edge, catches a rope, and escapes into the mist before Leo can
circle back on his Dactyl.

That night at camp, Lucian finds Amar sitting alone by the fire and sits
down next to him.

Amar tells him everything.

Lucian listens until Amar is done. Then he says only: "I thought it was
something like that. I have a wife and a daughter, Amar. If you want to
rebuild this country into somewhere safer for them, you tell me when
it's time to move. Until then, I'll cover you."

He does not ask for anything in return.

### Eighth Battle — The Town of Orinhal

The squad is sent to Orinhal, a mining town three days' ride from
Thuling, where tax riots have broken out. Fergus gives them explicit
orders: disperse the crowd, arrest the ringleaders, and restore the
King's peace.

When they arrive, the squad finds not a riot but a starving town. The
mines have been producing gold for years, but the town has never seen
any of it. The "ringleaders" are a handful of unarmed foremen standing
between the King's tax collectors and a crowd of their own families.

Before anyone can decide what to do, a company of Madame Dawn's partisans
emerges from the outskirts to protect the townspeople. The battle unfolds
on three sides: the squad, the tax collectors, and Dawn's partisans —
with the civilians caught in the middle. The player must choose whether
to side with the King's forces (as ordered) or break ranks and fight
alongside Dawn's partisans to protect the town.

Leo is the one who makes the choice for the squad. Watching the tax
collectors close in on a group of mothers with children, he peels off
toward the partisans without a word. "My father," he says afterward,
staring at the ground, "would have had me arrest them." The squad fights
alongside Dawn's partisans.

After the battle, Dawn's lieutenant — a quiet, gray-cloaked woman named
**Ndara**, not to be confused with Ndari — tells Amar that Madame Dawn
has been watching him for a long time, and that she would like to meet
him when he is ready. Ndara leaves without waiting for an answer.

Lucian takes the squad's share of the recovered tax silver and
distributes it back to the Orinhal townspeople on their way out.

### Ninth Battle — The Price of Doubt

Word of Orinhal reaches the palace faster than the squad can return.
Fergus sends them into a second mission before they can even report in —
supposedly to intercept a bandit column moving on a border village. The
coordinates are a trap. The "bandit column" is a King's regiment dressed
in commoners' clothes, and they are waiting in a narrow ravine with
prepared positions.

The map is brutal: a river crossing at the low point, sheer cliff walls
on both sides, and the enemy already entrenched on the high ground. The
squad's only objective is to survive long enough to break contact and
escape the ravine.

This is the battle where Fergus shows his hand. He is not protecting the
squad; he is expending them. A prisoner captured during the fight
confesses, under questioning, that Fergus has known about Amar's original
coup for weeks — that he was alerted by Ndari's slip during the mountain
bandits' defeat, and that he has been deliberately sending the squad
into harder and harder missions in the hope that they will not come back.
Fergus intends to take credit for neutralizing them once they die, and
to blame their "treason" on Kian's poor oversight to edge Kian out of
the King's court.

Lucian takes a crossbow bolt to the shoulder, pulling Ning out of an
archer's line of fire. He keeps fighting. He keeps fighting the whole
way back to Thuling. But the wound is bad, and the squad can see it.

Maya, for the first time, speaks openly. She was planted in the squad by
Madame Dawn months ago, she admits. She had been waiting to see what
kind of person Amar really was before revealing herself. After Orinhal
and the ravine, she has seen enough. She tells them that Dawn is ready
to bring them in from the cold and that staying in Thuling any longer is
suicide.

### Tenth Battle — Leaving Thuling

The squad decides to leave. Lucian refuses to go with them until he has
moved his wife and daughter somewhere safe — a cousin's farm two valleys
north, out of the King's immediate reach. He will catch up with the
squad on the road.

He never makes it.

Kian reaches Thuling first. When the squad arrives at Lucian's house to
rendezvous, they find that Lucian's family has already been taken to the
palace as "guests of the King, pending Amar's cooperation." Kian is
waiting on the road outside the house with a company of the King's
personal knights.

The battle is fought in the streets of Thuling itself — the squad's own
adopted home. Houses they know, the forge Lucian used to run, the inn
where Ning tended bar. Civilians watch from doorways. The objective is
not to defeat Kian — he is too well-protected — but to cut a path
through his line and escape the town.

Lucian fights beside Amar the entire battle, pale and favoring his
wounded shoulder but never faltering. At the end, when the squad is
through the line and running for the horses, Kian calls after Amar
across the broken street: "I know who you are. I've known since the
second battle. You had one chance to stay what you were pretending to
be, and you chose this instead."

Amar does not answer. The squad rides west.

### Eleventh Battle — The Truth About Anthros

Kian catches them at the coast.

He has brought the full weight of a King's pursuit force, and he has
brought something else: the truth. Before the battle begins, on the
cliffs above the harbor where Madame Dawn's ship is waiting, Kian tells
Amar everything — not as a confession but as an accusation, the way a
man unburdens himself before a duel he expects to lose.

King Nebu IV has been a façade all along. Anthros is not a sovereign
country but a colony, owned by a true power across the sea — a country
called Gruge. Its real ruler is King Archbold, a dark lord said to have
come from another world and to have long sought to conquer their land.
Kian has served both kings for most of his adult life. He believed,
once, that he was preserving Anthros. He no longer knows what he
believes. But he cannot let Amar reach Dawn. He has his orders.

The battle is fought on the cliffs and the wooden staircases that wind
down to the harbor. The squad has to cut through Kian's knights and
reach the ship before the tide turns.

Lucian falls halfway down the staircase.

A Shinobi drops from a rafter and takes him through the back with a
short blade. Amar is three steps ahead of him and doesn't see it happen
until he hears Ning shout. By the time he turns, Lucian is already on
one knee, still holding his spear, still trying to wave the squad on
toward the ship.

He dies with his head against Amar's forehead, at the bottom of the
staircase, in a pool of salt water. "Tell Mira," he says, and doesn't
finish the sentence, because he doesn't need to. Amar already knows what
to tell her.

Amar fights the rest of the battle without holding anything back for the
first time since he woke up in the hospital in Thuling. Kian falls to a
combined attack from Amar, Leo, and Maya. His last words are to Amar:
"Ask Dawn what she did before she fled. Ask her before you trust her."

Ndara, Madame Dawn's right-hand woman, has been waiting on the ship the
entire battle. She pulls the squad aboard and casts off into the open
sea, bound for Gruge.

A one-year time skip follows. Amar and his friends — Maya, Ning, Leo,
Ranatoli, and the others — begin a new life in Gruge, traveling across
both Gruge and Anthros to see, for the first time, the true shape of the
world. Amar writes to Lucian's wife Mira every month. He does not sign
the letters.

Several smaller battles play out during this period as Amar's group is
repeatedly ambushed by King Archbold's men. After a year of travel,
Archbold's forces finally close in. They have to flee again.

### Twelfth Battle — The Ravage

It is revealed that a group of peaceful "aliens" — a people called the
Ravage — visited Earth roughly a century ago and learned to speak human
languages. Led by King Daybreak (the ancestor of King Archbold), the
Ravage proposed to save what remained of humanity by building a new
society — Gruge — into which the planet's last remaining clean water,
technological knowledge, brilliant minds, and healthy populations could
be funneled. Their plan was to ship the saved population to the Ravage
homeworld and rebuild civilization there.

But the Ravage have always been selective about whom they save. The
colony of Anthros is, in their eyes, simply a holding pen — a monarchy
of unremarkable humans destined to be left behind to die.

### Thirteenth Battle — Madame Dawn's Rebellion

Meanwhile, Madame Dawn — a human and the secret mistress of King
Archbold — has learned of his true plans: not only does he intend to
abandon "useless" humanity, but he also plans to attack Nebu's people in
Anthros instead of merely leaving them behind. She secretly leads a
revolutionary movement to overthrow both kings. On the surface, Archbold
has promised Nebu safe passage for his royal family alone, but Archbold
privately intends to dispose of Nebu as well — afraid that Nebu might
one day come for his throne.

Rose, Madame Dawn's new love, dies saving her. It is revealed that Rose
and Dawn married after Dawn escaped from Archbold with her lost son.

### Fourteenth Battle — Amar's Origin

It is finally revealed that Amar is the biological child of Madame Dawn
and King Archbold.

### Fifteenth Battle — A Coup Within a Coup

As war between Madame Dawn and the two Kings looms, a hidden coup is
carried out within Dawn's camp. Ndara — one of her closest allies — is
left in a coma.

### Sixteenth Battle — Dawn's Proposal

Madame Dawn tells Amar that, once King Archbold is dead, she intends to
rule Gruge herself as revenge for everything he has done to her and as
vengeance for her late wife Rose. King Nebu, she vows, will die along
with him. She asks Amar — her son — to take the throne of Anthros once
Archbold falls.

Now the player must decide: does Amar agree to side with Madame Dawn,
or not?

The squad uncovers the "Anthros Secret": a vast gold mine hidden beneath
King Nebu's castle. This is why Archbold wants to invade rather than
simply abandon the colony. They also begin to see through Nebu's
propaganda. Gruge has been thriving for years — clean water, fertile
soil, established civilization — partly because some of its resources
have been quietly extracted from Anthros itself. Anthros has been bled
to feed the empire that owns it.

That night, Ndara finally wakes from her coma.

### Seventeenth Battle — Dawn's Lie

After the battle, Amar learns from Khione that Madame Dawn has fabricated
a key part of her story.

She was never abandoned by King Archbold. After bearing his child, she
tried to kill him in his sleep and frame one of his men for the murder,
intending to take the throne herself — she despised the dishonest way he
ruled. The plot failed. She was outed as the would-be usurper and fled
with her infant son. She buried the truth by dosing Archbold with a
memory-loss drug after the failed assassination, and Archbold has
remembered nothing of it since.

Only two people ever knew what really happened: Konsta, the King's
personal guard — whom Madame Dawn tied up and then killed — and Khione,
another of the King's mistresses, who silently witnessed everything and
pretended not to. Khione had reasoned that if she ever revealed the
truth, she would be killed. Madame Dawn, for her part, had assumed
Khione had told the whole castle — otherwise, why would she have stayed
with Archbold afterward?

Khione sacrifices herself before Madame Dawn can reach her, choosing
loyalty to Archbold to the very end.

*(Kian's last words on the cliff at the Eleventh Battle — "ask Dawn what
she did before she fled" — come back to Amar here.)*

### Eighteenth Battle — Choosing Sides

If the player has sided with Madame Dawn, they fight against those who
refuse to follow her now that her lie has been exposed (she lied without
ever apologizing — they call her a hypocrite).

If the player has refused her, Madame Dawn challenges Amar, her son, to
a final battle to settle things.

Either way, sacrifices are made:

- **Refuse Dawn** → Ning and Leo are killed (they cannot accept that Dawn would rule any more honestly than Nebu).
- **Side with Dawn** → Madame Dawn and Ndara are killed.

If the player kills Madame Dawn, their final exchange is bloody — but
she tells Amar she loves him before she dies.

### Nineteenth Battle

**If the player killed Dawn:** Within days, Amar's group is ambushed by
King Archbold's men. They are forced onto a boat back to Anthros, the
full truth now in their possession. Once they land in Anthros, they
establish a secret base on the outskirts of Thuling and plan their move
against King Nebu. Amar's goals are clear: finish what the original coup
started, overthrow King Nebu, install a new government, and save Anthros.

**If the player sided with Dawn:** Amar's faction launches an epic
assault on King Archbold and emerges victorious — but Maya is killed in
the fighting.

### Twentieth Battle

**If the player killed Dawn:** Amar leads a new coup against King Nebu
and wins. The squad is battered but alive. Meanwhile, the remaining
followers of Madame Dawn wreak havoc across Gruge, cutting off water and
food supplies.

**If the player sided with Dawn:** With Archbold dead and Dawn enthroned,
Amar turns to the final task: take Anthros from King Nebu. The last
battle pits the squad against Nebu's military, and they overrun the
kingdom at last.

### Final Battle

**If the player killed Dawn:** Three months later, the long-feared
invasion from King Archbold's forces finally arrives — but Amar's new
nation is ready. They strike a devastating blow against Archbold's
military. Archbold himself survives, but he is forced to recognize the
new democratic nation of Anthros under Amar's rule.

**If the player sided with Dawn:** Three months after the fall of Nebu,
Amar is ruling Anthros as a non-monarch while his mother rules Gruge as
its new queen. The arrangement is uneasy from the start. Dawn's first
decrees in Gruge are harsh — mass arrests of Archbold's former
courtiers, forced relocations, a tightening grip on trade that mirrors
uncomfortably well the regime she overthrew. Amar's letters to her grow
shorter and more careful.

Then the sky changes.

A fleet of Ravage reinforcements, dispatched from the homeworld years
before and long delayed in transit, finally arrives in orbit above
Earth. They have lost contact with Archbold. Their standing orders are
to secure Gruge's gold and knowledge and reclaim the colony by force if
necessary. The invading force is larger than anything Amar or Dawn has
faced — not bandits or colonial regiments, but actual off-world soldiers
with weapons the humans have never seen.

Dawn demands that Amar march his Anthros forces into Gruge to defend her
capital. Amar refuses to send his people to die for her throne. Instead,
he proposes a joint defense: Dawn will hold Gruge's inland cities, Amar
will fortify the coast where the Ravage will land, and the two nations
will fight as equals — not as a queen and her vassal. Dawn agrees,
furious, because she has no other choice.

The final battle is fought across two fronts at once: Amar's squad
leading the coastal defense of Gruge's harbor cities against the Ravage
landing parties, while Dawn's forces hold the inland. The map is
massive, the enemy is technologically superior, and the player must
manage positioning across both fronts while their most trusted allies —
Ranatoli, Selene if she was recruited during Battle 7, and the surviving
members of the original squad — anchor key positions.

The Ravage fleet is repelled. The cost is severe, but the two nations
hold.

In the aftermath, Amar and Dawn meet one last time on the same cliffs
where, in another life, Kian died. Dawn offers her son the throne of
Gruge alongside her own — a united empire, mother and son. Amar refuses.
He rules Anthros as a non-monarch, as he promised, and he tells her that
their countries will be neighbors, not one kingdom. Dawn is silent for a
long time. Then she smiles — the first real smile Amar has ever seen
from her — and says she is proud of him anyway. They part as mother and
son, and as two rulers who have chosen different answers to the same
question.

## Ending

Amar becomes the first non-monarch ruler of Anthros. They marry a
character of their choosing — provided that character's class is
bond-compatible with Amar's. The long work of rebuilding Anthros begins,
and the country enters a long-awaited era of peace.

In the final cutscene, Amar visits Thuling. The steel factory is running
again, under new management. A woman named Mira stands at the gate with
her daughter Tali, now a few years older. Amar delivers, in person, the
letter he has been writing every month for three years.

He signs it this time.
