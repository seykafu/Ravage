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
  ["dawn", "measured_neutral"]
]);

export const PORTRAIT_EXPRESSIONS: Record<string, readonly string[]> = {
  amar:     ["quiet_rage", "resolute", "shocked", "warm_half_smile", "wounded"],
  lucian:   ["dying", "fatherly_smile", "grim_resolve"],
  ning:     ["eager_grin", "exhausted", "focused_bow", "startled"],
  maya:     ["calculating_side_glance", "guarded_neutral", "soft_genuine_smile", "steel_cold_confession_face", "tearful"],
  leo:      ["cocky_smirk", "fury", "wide-eyed_horror", "wounded_pride"],
  ranatoli: ["alarmed", "dry_skeptical", "lecturing", "satisfied"],
  selene:   ["breaking", "cold_contempt"],
  kian:     ["knowing_smile", "pure_menace"],
  ndari:    ["regal_neutral", "scornful", "surprised"],
  nebu:     ["cruel_amusement", "fury"],
  dawn:     ["charismatic_warm_smile", "ideologue_intensity", "mask_slipping", "measured_neutral"],
  fergus:   ["false_sincerity", "unmasked_treachery"],
  ndara:    ["commanding", "grim", "military_neutral"],
  archbold: ["offering_peace", "righteous_fury"],
  khione:   ["ancient_sadness", "revelation", "serene_neutral"],
  mira:     [],
  tali:     []
};
