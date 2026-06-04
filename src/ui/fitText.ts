import Phaser from "phaser";

// Auto-fit a dialogue body into a fixed-height text box.
//
// The problem this solves: dialogue beats used to be chunked into pages of
// N lines and clicked through, which left orphan pages with one or two
// trailing words. Instead we shrink the font size (and its proportional
// line spacing) just enough that the whole beat's wrapped text fits inside
// the box in a single pass — no pagination, no overhang.
//
// `textObj` must already have its wordWrap width configured; we only touch
// the font size, line spacing, and (transiently) the text contents to
// measure. The returned `text` is the wrapped lines joined with explicit
// newlines so the typewriter reveal doesn't reflow as characters appear.

export interface FitResult {
  text: string;
  fontSize: number;
}

export const fitBodyText = (
  textObj: Phaser.GameObjects.Text,
  body: string,
  maxHeight: number,
  baseSize: number,
  minSize: number
): FitResult => {
  // Proportional line spacing: keeps the airy feel of the base style
  // (21px font / 10px spacing ≈ 0.48) at every size we step down to.
  const spacingFor = (size: number): number => Math.round(size * 0.48);

  // Floor the minimum at 1px: Phaser's setFontSize(0) renders nothing (and
  // negative throws), so guard against a caller passing a non-positive
  // minSize. Current callers pass 14, so this is pure defense-in-depth.
  const floorSize = Math.max(1, minSize);
  let chosen = floorSize;
  for (let size = baseSize; size >= floorSize; size--) {
    textObj.setFontSize(size);
    textObj.setLineSpacing(spacingFor(size));
    textObj.setText(body); // re-wraps at the object's current wordWrap width
    if (textObj.height <= maxHeight) {
      chosen = size;
      break;
    }
    // If we reach minSize without fitting, accept it (the box clips at most
    // a hair — only the very longest beats hit this, and minSize is picked
    // so even those fit in practice).
    chosen = size;
  }

  textObj.setFontSize(chosen);
  textObj.setLineSpacing(spacingFor(chosen));
  const wrapped = textObj.getWrappedText(body);
  textObj.setText("");
  return { text: wrapped.length ? wrapped.join("\n") : body, fontSize: chosen };
};
