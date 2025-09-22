import { Hsluv } from "hsluv";

const hsluv = new Hsluv();

export function generatePalette() {
  const baseHue = Math.floor(Math.random() * 360);
  const baseLightness = 30;

  const saturation = 30;

  const accentHue1 = baseHue + 20 + Math.random() * 20;
  const accentHue2 = baseHue - 20 - Math.random() * 20;
  return [
    hslToRgb(baseHue, saturation, baseLightness),
    hslToRgb(
      accentHue1 % 360,
      saturation,
      baseLightness + 20 + Math.random() * 40,
    ),
    hslToRgb(
      (accentHue2 + 360) % 360,
      saturation,
      baseLightness + 20 + Math.random() * 40,
    ),
  ];
}

function hslToRgb(h: number, s: number, l: number) {
  hsluv.hsluv_h = h;
  hsluv.hsluv_s = s;
  hsluv.hsluv_l = l;
  hsluv.hsluvToRgb();
  const [r, g, b] = [hsluv.rgb_r, hsluv.rgb_g, hsluv.rgb_b]
    .map((c) => Math.floor(255 * c))
    .map((byte) => byte.toString(16).padStart(2, "0"));
  return "#" + r + b + g;
}
