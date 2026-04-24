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
// Exception: when a refined `<character>_neutral.png` exists alongside an
// older base file, list the character in DEFAULT_USES_NEUTRAL_VARIANT below.
// The manifest will then load `<character>_neutral.png` whenever code asks
// for `portrait:<character>` (the default).

export const DEFAULT_USES_NEUTRAL_VARIANT: ReadonlySet<string> = new Set([
  "amar", "leo", "lucian", "ranatoli"
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
