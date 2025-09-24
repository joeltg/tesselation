import { Delaunay } from "d3-delaunay";
import PRNG from "xoshiro-js";

import { generatePalette } from "./generatePalette.js";

export class VoronoiGenerator {
  canvas = new OffscreenCanvas(this.width, this.height);
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  generate(seed: bigint, palette?: string[]) {
    const ctx = this.canvas.getContext("2d");
    if (ctx === null) {
      throw new Error("failed to get source drawing context");
    }

    const prng = new PRNG(seed);
    const paletteSeed = prng.getBigUint64();
    const colorPalette = palette ?? generatePalette(paletteSeed);
    generateImage(ctx, this.width, this.height, colorPalette, prng);
  }
}

export function generateImage(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  colorPalette: string[],
  prng: PRNG | bigint = 0n,
) {
  if (typeof prng === "bigint") {
    prng = new PRNG(prng);
  }

  ctx.clearRect(0, 0, width, height);

  const margin = 2;
  const points: [number, number][] = [];

  const numPoints = 50;
  for (let i = 0; i < numPoints; i++) {
    const x = prng.range(margin, width - margin);
    const y = prng.range(margin, height - margin);
    points.push([x, y]);
  }

  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([0, 0, width, height]);

  for (let i = 0; i < points.length; i++) {
    const cell = voronoi.cellPolygon(i);
    if (!cell || cell.length < 3) continue;
    ctx.fillStyle = colorPalette[i % colorPalette.length];

    ctx.beginPath();
    ctx.moveTo(cell[0][0], cell[0][1]);

    for (let j = 1; j < cell.length; j++) {
      ctx.lineTo(cell[j][0], cell[j][1]);
    }

    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = "#404040";
  ctx.lineWidth = 1;

  for (let i = 0; i < points.length; i++) {
    const cell = voronoi.cellPolygon(i);
    if (!cell || cell.length < 3) continue;

    for (let j = 0; j < cell.length; j++) {
      const [x1, y1] = cell[j];
      const [x2, y2] = cell[(j + 1) % cell.length];

      if ((x1 % width || x2 % width) && (y1 % height || y2 % height)) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  }
}
