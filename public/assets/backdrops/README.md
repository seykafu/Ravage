# Backdrops — `public/assets/backdrops/`

Full-scene background paintings for prep screens, story scenes, and
battles. These sit *behind* the tile grid in BattleScene and span the
whole canvas in BattlePrepScene / StoryScene.

## Spec

| Property | Value |
|---|---|
| Dimensions | **1280 × 720 px** (matches `GAME_WIDTH × GAME_HEIGHT`) |
| Format | PNG, opaque |
| Style | Painterly background — softer than sprites/tiles. Distant + atmospheric |
| Lighting | Mood-driven: night, dusk, fog, fire, etc. See per-file notes below |

Backdrops are the **only** asset class where soft gradients and painterly
brushwork are encouraged. Sprites and tiles stay crisp; backdrops can blur.

## Filenames + mood

| File | Scene | Mood |
|---|---|---|
| `palaceCoup.png` | Opening palace siege | Night, fire glow, dark + dramatic |
| `thuling.png` | Thuling fields | Dusk, foggy, cool blues with warm horizon |
| `farmland.png` | Farmland skirmish | Warm sunset, golden, low ridges |
| `mountain.png` | Mountain pass | Moonlit, snow, deep shadow, cold |
| `swamp.png` | Murky swamp | Sickly green, fog, low light |
| `caravan.png` | Caravan ambush | Warm desert dusk, dust haze |
| `monastery.png` | Monastery interior/exterior | Candlelit, somber, indigo |
| `orinhal.png` | Orinhal — burning city | Fire-lit, orange + black, smoke |
| `cliffs.png` | Coastal cliffs | Stormy, blue-grey, fog at base |
| `grude.png` | Grude — moonlit fortress | Night, moonlit, blue-violet |
| `finalBoss.png` | Final boss arena | Hellish red, fire, deep shadow, foreboding |

## Composition rules

- **Horizon line at ~y=420** (just below screen middle). Battles render the
  tile grid in the lower 2/3 of the canvas — keep that area readable, don't
  paint anything bright/busy there.
- **Vignette** — darken the corners. The procedural fallback adds one; if
  your real backdrop is already vignetted, that's fine, the engine doesn't
  add another.
- **No characters or units in the backdrop.** Those go on the unit layer.
- **No UI elements.** No banners, frames, text.

## Don't

- Don't do parallax layers in separate files. We render one flat backdrop;
  parallax was considered and cut.
- Don't paint at 4K and downscale — paint at native 1280×720 so the chunky
  pixel feel matches the foreground.
- Don't include any frame counter or signature in the image itself.
