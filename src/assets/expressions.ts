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

export const PORTRAIT_EXPRESSIONS: Record<string, readonly string[]> = {
  amar:     ["quiet_rage", "resolute", "shocked", "warm_half_smile", "wounded"],
  lucian:   ["dying", "fatherly_smile", "grim_resolve"],
  ning:     [],
  maya:     ["calculating_side_glance", "soft_genuine_smile", "steel_cold_confession_face", "tearful"],
  leo:      [],
  ranatoli: [],
  selene:   [],
  kian:     [],
  ndari:    [],
  nebu:     [],
  dawn:     [],
  fergus:   [],
  ndara:    [],
  archbold: [],
  khione:   [],
  mira:     [],
  tali:     []
};
