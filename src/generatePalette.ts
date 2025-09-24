import { Hsluv } from "hsluv";
import PRNG from "xoshiro-js";

const hsluv = new Hsluv();

export function generatePalette(prng: PRNG | bigint = 0n) {
  if (typeof prng === "bigint") {
    prng = new PRNG(prng);
  }

  const baseHue = prng.range(0, 360 - 1);
  const baseLightness = 30;

  const saturation = 30;

  const accentHue1 = baseHue + prng.range(20, 40);
  const accentHue2 = baseHue - prng.range(20, 40) + 360;
  return [
    hslToRgb(baseHue, saturation, baseLightness),
    hslToRgb(accentHue1, saturation, baseLightness + prng.range(20, 60)),
    hslToRgb(accentHue2, saturation, baseLightness + prng.range(20, 60)),
  ];
}

function hslToRgb(h: number, s: number, l: number) {
  hsluv.hsluv_h = h % 360;
  hsluv.hsluv_s = s;
  hsluv.hsluv_l = l;
  hsluv.hsluvToRgb();
  const [r, g, b] = [hsluv.rgb_r, hsluv.rgb_g, hsluv.rgb_b]
    .map((c) => Math.floor(255 * c))
    .map((byte) => byte.toString(16).padStart(2, "0"));
  return "#" + r + b + g;
}
