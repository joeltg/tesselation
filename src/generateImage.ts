import { Delaunay } from "d3-delaunay";

export function generateImage(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  colorPalette: string[],
) {
  ctx.clearRect(0, 0, width, height);

  const margin = 2;
  const points: [number, number][] = [];

  const numPoints = 30 + Math.round(Math.random() * 20);
  for (let i = 0; i < numPoints; i++) {
    const x = margin + Math.round(Math.random() * (width - margin * 2));
    const y = margin + Math.round(Math.random() * (height - margin * 2));
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

  const e = 1;

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
