# Art sources

Original full-resolution renders as dropped by the artist, preserved
BEFORE any processing (a previous pipeline run destroyed its sources —
never again). The shipped game assets are derived from these:

- sprites/*_idle_src.png → public/assets/sprites/<class>/idle.png
  Pipeline: chroma-key the flat #FF00FF background, split the two
  equal-half frames, LANCZOS-downscale to house figure scale (body
  ≈28px in a 32×40 cell; over-head weapons total-fit to ≈38px, feet
  on the bottom edge), harden alpha to binary (≥96 → 255).

Regenerate any sheet by re-running the pipeline in the session notes /
commit messages rather than editing the 64×40 outputs by hand.
