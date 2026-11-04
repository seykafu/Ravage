// Dump the player-facing script in play order, for reading the story the
// way a new player meets it (and for reviewing it without the code).
//
// Usage: npx vite-node scripts/exportScript.ts [outDir=release/script]
//
// Writes:
//   00_trunk.txt          the cold open through the Seven Paths choice
//   path_<path>.txt       each road from its opener to its last scene
//   zz_endings.txt        the weddings / walking on alone, the epilogue
//
// A battle prints its intro, every in-battle dialogue (with what triggers
// it), and its outro; an arc prints each beat with its speaker. Films
// (cinematic / endCinematic) are named; their captions live in
// src/scenes/story/Cinematics.ts.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ARCS } from "../src/story/beats";
import { BATTLES, battleById, resolveBattleForPath } from "../src/data/battles";
import { POST_ARC } from "../src/data/postArcs";
import type { SevenPath } from "../src/data/contentIds";

const out = path.resolve(process.argv[2] ?? "release/script");
mkdirSync(out, { recursive: true });

const PATHS: SevenPath[] = ["vengeance", "restoration", "revolution", "duty", "exile", "mercy", "forgetting"];

type Beat = { speaker?: string; portraitId?: string; body: string; partner?: string };
const line = (b: Beat): string => {
  const who = b.speaker ?? (b.portraitId && b.portraitId !== "narrator" ? b.portraitId : "NARRATOR");
  return `  ${b.partner ? `{only if married to ${b.partner}} ` : ""}[${who}] ${b.body}`;
};

const trig = (t: Record<string, unknown> | undefined): string =>
  t ? Object.entries(t).map(([k, v]) => (k === "kind" ? String(v) : `${k}=${JSON.stringify(v)}`)).join(" ") : "?";

const arcText = (id: string): string => {
  const a = (ARCS as Record<string, { title?: string; subtitle?: string; beats: Beat[]; cinematic?: string; endCinematic?: string; next?: string }>)[id];
  if (!a) return `\n### (missing arc ${id})\n`;
  const head = `\n### STORY SCENE ${id}: "${a.title ?? ""}"${a.subtitle ? ` — ${a.subtitle}` : ""}`;
  const film = a.cinematic ? `\n  (opens with the film "${a.cinematic}")` : "";
  const end = a.endCinematic ? `\n  (closes with the film "${a.endCinematic}")` : "";
  return `${head}${film}\n${a.beats.map(line).join("\n")}${end}\n`;
};

const battleText = (id: string, p: SevenPath | null): string => {
  const raw = battleById(id);
  if (!raw) return `\n### (missing battle ${id})\n`;
  const b = resolveBattleForPath(raw, p);
  const parts = [`\n### BATTLE ${b.index} ${b.id}: ${b.title} — ${b.subtitle}`, `  INTRO (prep screen): ${b.intro}`];
  for (const d of b.dialogues ?? []) {
    parts.push(`  -- in battle (${trig(d.trigger as Record<string, unknown>)}):`);
    for (const beat of d.beats as Beat[]) parts.push("  " + line(beat));
  }
  parts.push(`  OUTRO (victory screen): ${b.outro ?? ""}`);
  return parts.join("\n") + "\n";
};

/** Follow the story from `start` until it leaves the linear chain. */
const walk = (start: string, p: SevenPath | null, stopAt: Set<string>): { text: string; end: string } => {
  let text = "";
  let next = start;
  const seen = new Set<string>();
  for (let guard = 0; guard < 200; guard++) {
    if (seen.has(next)) return { text: text + `\n(loops back to ${next})\n`, end: next };
    seen.add(next);
    if (next.startsWith("story:")) {
      const id = next.slice(6);
      text += arcText(id);
      next = (ARCS as Record<string, { next: string }>)[id]?.next ?? "end";
    } else if (next.startsWith("prep:")) {
      const id = next.slice(5);
      text += battleText(id, p);
      const post = POST_ARC[id as keyof typeof POST_ARC];
      next = post ? `story:${post}` : "end";
    } else {
      return { text, end: next };
    }
    if (stopAt.has(next)) return { text, end: next };
  }
  return { text, end: next };
};

// The trunk: the cold open to the choice.
const trunk = walk("story:cold_open_dawn", null, new Set());
writeFileSync(path.join(out, "00_trunk.txt"), `RAVAGE — the shared story, in play order (ends at: ${trunk.end})\n${trunk.text}`);

// Each road: its opener, then wherever it leads.
for (const p of PATHS) {
  let text = `RAVAGE — the ${p} road, from the Seven Paths choice\n`;
  const opener = `prep:b19_path_opener_${p}`;
  let r = walk(opener, p, new Set());
  text += r.text;
  if (r.end === "ending") {
    text += `\n(the ${p} ending)\n` + arcText(`post_ending_${p}`);
    text += `\n(then the marriage question: RomanceScene — see zz_endings.txt)\n`;
  } else {
    text += `\n(ends at: ${r.end})\n`;
  }
  writeFileSync(path.join(out, `path_${p}.txt`), text);
  void r;
}

// Endings: every wedding, walking on alone, where they went, the epilogue.
let endings = "RAVAGE — the codas after the marriage question, and the epilogue\n";
for (const id of Object.keys(ARCS).filter((k) => k.startsWith("wed_") || k === "end_alone")) endings += arcText(id);
endings += arcText("where_they_went");
endings += "\n(credits, then the epilogue chapter)\n";
endings += walk("story:before_epilogue", "mercy", new Set()).text;
writeFileSync(path.join(out, "zz_endings.txt"), endings);

console.log(`[script] ${BATTLES.length} battles, ${Object.keys(ARCS).length} arcs → ${out}`);
