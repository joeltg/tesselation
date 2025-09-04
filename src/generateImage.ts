import { Delaunay } from "d3-delaunay";

export function generateImage(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  size: number,
  colorPalette: string[],
) {
  ctx.clearRect(0, 0, size, size);

  const margin = size / 20;
  const points: [number, number][] = [];

  const numPoints = 30 + Math.round(Math.random() * 20);
  for (let i = 0; i < numPoints; i++) {
    const x = margin + Math.random() * (size - margin * 2);
    const y = margin + Math.random() * (size - margin * 2);
    points.push([x, y]);
  }

  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([0, 0, size, size]);

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
      const vertex1 = cell[j];
      const vertex2 = cell[(j + 1) % cell.length];

      ctx.beginPath();
      ctx.moveTo(vertex1[0], vertex1[1]);
      ctx.lineTo(vertex2[0], vertex2[1]);
      ctx.stroke();
    }
  }
}
