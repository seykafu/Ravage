// Per-character expression registry.
//
// Add an expression slug here once you've dropped the file in
// public/assets/portraits/<character>_<expression>.png.
//
// In story beats, reference an expression with `expression: "<slug>"`.
// If a beat omits `expression`, the default character portrait is used.
//
// File naming convention:
//   public/assets/portraits/amar.png             ← neutral (default)
//   public/assets/portraits/amar_resolute.png    ← expression: "resolute"
//   public/assets/portraits/amar_shocked.png     ← expression: "shocked"

// Convention: the base file `<character>.png` IS the neutral portrait, so we
// don't register a "neutral" slug. When a character has a *named* neutral
// (e.g., "military_neutral", "guarded_neutral"), it's a distinct emotional
// register that writers can opt into deliberately — those ARE listed.
//
// Exception: when a refined variant should stand in for the legacy base file,
// register it in DEFAULT_VARIANT_FOR below. The manifest will then load
// `<character>_<variant>.png` whenever code asks for `portrait:<character>`
// (the default). This is how we retire the old square 1024×1024 base renders
// without changing every beat's metadata. The variant must already exist as
// a real file on disk — usually it's also listed in PORTRAIT_EXPRESSIONS.

export const DEFAULT_VARIANT_FOR: ReadonlyMap<string, string> = new Map([
  ["amar", "neutral"],
  ["leo", "neutral"],
  ["lucian", "neutral"],
  ["ranatoli", "neutral"],
  // Second wave: characters with refined `<id>_neutral.png` files added
  // alongside the original square 1024×1024 base renders.
  ["archbold", "neutral"],
  ["fergus", "neutral"],
  ["khione", "neutral"],
  ["kian", "neutral"],
  ["ndara", "neutral"],
  ["nebu", "neutral"],
  ["tali", "neutral"],
  ["ning", "neutral"],
  // Third wave: no plain `_neutral.png` exists, so we point the default at
  // an existing named-neutral expression file instead.
  ["maya", "guarded_neutral"],
  ["ndari", "regal_neutral"],
  // Dawn never had a base file shipped — her default routes to the canonical
  // mask-on expression so any future beat that omits her expression still
  // renders correctly.
  ["dawn", "measured_neutral"],
  // Rose ships only the named variants (neutral / brisk / falling) — no
  // plain rose.png. Default load resolves to rose_neutral.png so any beat
  // that omits an expression renders correctly. B13's beats already use
  // expression: "neutral" explicitly, which now lands on the same file.
  ["rose", "neutral"],
  // Veya ships only named variants (neutral / wry_smile / focused /
  // alarmed / grim_resolve) — no plain veya.png. Same pattern as Rose.
  ["veya", "neutral"],
  // Corin: same pattern — five named variants, no plain corin.png.
  ["corin", "neutral"]
]);

// NOTE on "registered but no PNG on disk yet": listing a slug here does NOT
// require the file to exist. The manifest derives a load entry for each slug,
// BootScene 404s missing ones harmlessly (markFailed), and the dialogue
// resolver falls back to the character's neutral portrait. So registering an
// expression a writer already used in a beat is always safe — it preserves
// the authorial intent (and makes the art "just work" the moment the PNG is
// dropped in) instead of the intent being silently lost. The content-integrity
// test (src/data/__tests__/contentExpressions.test.ts) enforces that every
// expression referenced in a beat appears in this registry, so this map is the
// single source of truth for "emotions the writing asks for".
export const PORTRAIT_EXPRESSIONS: Record<string, readonly string[]> = {
  // "guarded" — Amar's wary register through the Grude betrayal arc (B14-B17),
  // distinct from the hotter "quiet_rage". Art pending; falls back to neutral.
  amar:     ["guarded", "quiet_rage", "resolute", "shocked", "warm_half_smile", "wounded"],
  // "alarmed" — Lucian's B-side reaction beats. Art pending; falls back.
  lucian:   ["alarmed", "dying", "fatherly_smile", "grim_resolve"],
  ning:     ["eager_grin", "exhausted", "focused_bow", "startled"],
  maya:     ["alarmed", "calculating_side_glance", "guarded_neutral", "soft_genuine_smile", "steel_cold_confession_face", "tearful"],
  // "ready"/"resolute" — Leo's B8 defection declaration (the dactyl walks to
  // the partisan side). The emotional centre of his arc; art pending, falls
  // back to neutral until leo_ready.png / leo_resolute.png ship.
  leo:      ["cocky_smirk", "fury", "ready", "resolute", "wide-eyed_horror", "wounded_pride"],
  ranatoli: ["alarmed", "dry_skeptical", "lecturing", "satisfied"],
  selene:   ["breaking", "cold_contempt"],
  // Kian re-appears across the captivity + Grude arcs in registers beyond his
  // two B1 looks: "wounded" (×5), plus one-off "alarmed", "cold_contempt",
  // "fatherly_smile". Art pending; all fall back to kian neutral.
  kian:     ["alarmed", "cold_contempt", "fatherly_smile", "knowing_smile", "pure_menace", "wounded"],
  // "grim_resolve"/"knowing_smile" — Ndari's later commanding beats. Art
  // pending; falls back to ndari's regal_neutral default.
  ndari:    ["grim_resolve", "knowing_smile", "regal_neutral", "scornful", "surprised"],
  nebu:     ["cruel_amusement", "fury"],
  dawn:     ["charismatic_warm_smile", "ideologue_intensity", "mask_slipping", "measured_neutral"],
  fergus:   ["false_sincerity", "unmasked_treachery"],
  ndara:    ["commanding", "grim", "military_neutral"],
  archbold: ["offering_peace", "righteous_fury"],
  khione:   ["ancient_sadness", "revelation", "serene_neutral"],
  // Rose: B13 single-battle appearance (Madame Dawn's lieutenant; dies
  // in post_dawn_rebellion). neutral covers conversational beats; brisk
  // covers the tactical brief + captain-drop approval; falling covers
  // the death scene's before_victory dialogue.
  rose:     ["neutral", "brisk", "falling"],
  // Veya (B14+): the court optician turned lenscaster. Full five-piece
  // set shipped together — "focused" is the loupe-down sighting look
  // used for battle beats.
  veya:     ["neutral", "wry_smile", "focused", "alarmed", "grim_resolve"],
  // Corin (B17+): Rose's brother, Dawn's cavalry captain turned. Full
  // five-piece set shipped together — "torn" is the order he cannot
  // follow; "quiet_grief" is Rose's ghost.
  corin:    ["neutral", "quiet_grief", "torn", "battle_fury", "resolute"],
  mira:     [],
  tali:     []
};
