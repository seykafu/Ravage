import Phaser from "phaser";

// A real bloom for the battle camera: only the bright parts glow, the glow
// is ADDED on top, and the frame's own alpha passes through untouched.
//
// This replaces Phaser's built-in Bloom FX, which is not a bloom in that
// sense. Its final step is `mix(original, blurred * strength, 0.5)` — a
// 50/50 blend of the frame with a dimmed, blurred copy of itself (and each
// of its blur passes loses ~4% because the tap weights sum to 0.96). For an
// opaque board that works out to alpha ≈ 0.75 and colour at ~75%, softened
// by half a blur. Drawn over black, as battles always were, that read as
// every battle being a quarter darker and noticeably blurrier than its art
// — the murk in every baseline capture. Drawn over the ¾ board's backdrop
// scene, it made the board see-through.
//
// One pass, one shader. A first version chained bright-pass → blur →
// combine through Phaser's intermediate targets and switched programs
// mid-pipeline; the attribute bindings didn't survive the switch and the
// screen came out as a grey smear split along the quad's diagonal. Two
// rings of thresholded taps in a single fragment shader give a soft,
// highlight-only glow with nothing to go out of sync, and make the alpha
// guarantee structural: the output alpha IS the input alpha.

const FRAG = `
#define SHADER_NAME RAVAGE_BLOOM_FS
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uStrength;
uniform float uRadius;
varying vec2 outTexCoord;

vec3 bright (vec2 uv) {
  vec3 c = texture2D(uMainSampler, uv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return c * smoothstep(uThreshold, uThreshold + 0.28, l);
}

void main () {
  vec4 base = texture2D(uMainSampler, outTexCoord);
  vec2 r1 = uTexel * uRadius;
  vec2 r2 = r1 * 2.3;
  vec3 glow = bright(outTexCoord) * 0.16;
  // Eight directions, two rings. Weights sum to 1 (0.16 + 8·0.075 + 8·0.03).
  glow += (bright(outTexCoord + vec2( 1.0,  0.0) * r1) + bright(outTexCoord + vec2(-1.0,  0.0) * r1)
         + bright(outTexCoord + vec2( 0.0,  1.0) * r1) + bright(outTexCoord + vec2( 0.0, -1.0) * r1)
         + bright(outTexCoord + vec2( 0.707,  0.707) * r1) + bright(outTexCoord + vec2(-0.707,  0.707) * r1)
         + bright(outTexCoord + vec2( 0.707, -0.707) * r1) + bright(outTexCoord + vec2(-0.707, -0.707) * r1)) * 0.075;
  glow += (bright(outTexCoord + vec2( 1.0,  0.0) * r2) + bright(outTexCoord + vec2(-1.0,  0.0) * r2)
         + bright(outTexCoord + vec2( 0.0,  1.0) * r2) + bright(outTexCoord + vec2( 0.0, -1.0) * r2)
         + bright(outTexCoord + vec2( 0.707,  0.707) * r2) + bright(outTexCoord + vec2(-0.707,  0.707) * r2)
         + bright(outTexCoord + vec2( 0.707, -0.707) * r2) + bright(outTexCoord + vec2(-0.707, -0.707) * r2)) * 0.03;
  // Additive on premultiplied colour, alpha untouched: over the board this
  // only ever brightens; over empty sky a torch's halo still spills onto
  // the backdrop, because premultiplied colour with zero alpha composites
  // additively.
  gl_FragColor = vec4(base.rgb + glow * uStrength, base.a);
}
`;

export const BLOOM_PIPELINE = "RavageBloom";

export class BloomPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  /** Luminance (0-1) where glow starts. Snow and marble sit just under it. */
  threshold = 0.74;
  /** How much of the glow is added back. */
  strength = 0.5;
  /** Inner ring radius in buffer pixels (outer ring is 2.3×). */
  radius = 5;

  constructor(game: Phaser.Game) {
    super({ game, name: BLOOM_PIPELINE, fragShader: FRAG });
  }

  onPreRender(): void {
    this.set2f("uTexel", 1 / this.renderer.width, 1 / this.renderer.height);
    this.set1f("uThreshold", this.threshold);
    this.set1f("uStrength", this.strength);
    this.set1f("uRadius", this.radius);
  }
}

export const ensureBloomPipeline = (game: Phaser.Game): boolean => {
  if (game.renderer.type !== Phaser.WEBGL) return false;
  (game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.addPostPipeline(BLOOM_PIPELINE, BloomPipeline);
  return true;
};
