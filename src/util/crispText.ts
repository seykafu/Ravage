import Phaser from "phaser";

/**
 * Boost Phaser Text resolution + force LINEAR texture sampling so text
 * stays crisp on high-DPI / retina displays.
 *
 * The global `pixelArt: true` config in main.ts forces NEAREST sampling on
 * every texture, which is correct for the chunky 32x40 unit sprites but
 * turns canvas-rendered text into jaggy garbage when the game canvas is
 * Phaser.Scale.FIT-scaled up to a 2x or 3x retina window. We monkey-patch
 * GameObjectFactory.text so every `scene.add.text(...)` call gets:
 *
 *   - resolution = devicePixelRatio (capped at 3x), so the glyph canvas is
 *     rendered at higher pixel density before being uploaded as a texture.
 *   - LINEAR filter on the resulting texture, so the downsample from the
 *     high-density glyph canvas to the on-screen size is bilinear-smooth
 *     instead of nearest-neighbor jagged.
 *
 * Combined: glyphs render at 2x or 3x density, sample down smoothly. The
 * net effect roughly matches what browser-native text looks like on the
 * same display — serifs stay sharp, anti-aliased edges stay clean, no
 * pixelation when the game canvas is upscaled to fit the window.
 *
 * Memory impact: each text texture grows ~4x (2x in each dimension) on a
 * retina display. Most text textures are small (a few KB each), so total
 * cost is on the order of 1–2MB across the whole game — acceptable.
 *
 * Must be called BEFORE `new Phaser.Game(config)` so the override is in
 * place by the time any scene's create() runs and starts spawning text.
 */
export const installCrispText = (): void => {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  if (dpr === 1) {
    // 1:1 display — current default is fine; skip the override to avoid
    // inflating texture memory for users on non-retina screens.
    return;
  }

  // Capture the original factory method so we can delegate to it. The
  // patched version runs every `scene.add.text(x, y, content, style?)` call
  // through the same path it always used, then mutates the result.
  const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (
      x: number, y: number,
      text: string | string[],
      style?: Phaser.Types.GameObjects.Text.TextStyle
    ) => Phaser.GameObjects.Text;
  };
  const originalText = factory.text;

  factory.text = function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number, y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle
  ): Phaser.GameObjects.Text {
    const t = originalText.call(this, x, y, text, style);
    t.setResolution(dpr);
    // The text's texture is constructed during the constructor's initial
    // updateText() call, so it exists by the time we get here. Subsequent
    // setText() calls re-render into the same texture, so the filter mode
    // we set now persists for the lifetime of the Text object.
    if (t.texture) {
      t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    return t;
  };
};
