# Art sources

Original full-resolution renders as dropped by the artist, preserved
BEFORE any processing (a previous pipeline run destroyed its sources —
never again). The shipped game assets are derived from these:

- sprites/*_idle_src.png → public/assets/sprites/<class>/idle.png
  Pipeline: chroma-key the flat #FF00FF background, split the two
  equal-half frames, LANCZOS-downscale to house figure scale (body
  ≈28px in a 32×40 cell; over-head weapons total-fit to ≈38px, feet
  on the bottom edge), harden alpha to binary (≥96 → 255).

- sprites/<class>_<state>_src.png (walk, attack, hit, death) →
  public/assets/sprites/<class>/<state>.png
  Generated with Codex (GPT image) by scripts/art/gen_anim_sheets.py,
  each prompted with the class's idle frame as the reference: one row
  of poses on flat #FF00FF. Processed by scripts/art/process_anim_sheet.py:
  chroma-key with de-spill, one blob per pose, one scale per sheet
  (the idle's body height over the most upright pose), feet on the
  idle's foot row, legs over the idle's legs, premultiplied LANCZOS,
  alpha hardened to binary. Every sheet's flags are in
  scripts/art/rebuild_unit_sheets.sh, which rebuilds all 40 from here.
  The knight's attack was generated with the spearton's attack as a
  second, pose reference (its first render flipped the spear).

- obstacles/<id>_tall_src.png → public/assets/obstacles/tall/<id>.png
  Standing props for the ¾ board (Codex renders, the flat prop attached
  as a style reference). scripts/art/process_prop.py; the cell size is
  the argument (tree 40×56, pillar 20×60).

Regenerate any sheet by re-running the pipeline rather than editing the
outputs by hand.
