// this generates a grid that reflects the source cell across
// alternating axes so that we get continuous wrap-around when
// trying to sample from beyond the border

export function generateGrid(source: CanvasImageSource, sourceSize: number) {
  const cell = new OffscreenCanvas(
    sourceSize * devicePixelRatio,
    sourceSize * devicePixelRatio,
  );

  const cellCtx = cell.getContext("2d");
  if (cellCtx === null) {
    throw new Error("failed to get canvas context");
  }

  const sourceWidth = sourceSize * devicePixelRatio;
  const sourceHeight = sourceSize * devicePixelRatio;

  // cellCtx.putImageData(ctx.getImageData(0, 0, sourceWidth, sourceHeight), 0, 0);

  const grid = new OffscreenCanvas(sourceWidth * 2, sourceHeight * 2);

  const gridCtx = grid.getContext("2d");
  if (gridCtx === null) {
    throw new Error("failed to get canvas context");
  }

  for (let row = 0; row < 2; row++) {
    const flipVertical = row % 2 === 1;
    for (let col = 0; col < 2; col++) {
      const flipHorizontal = col % 2 === 1;

      cellCtx.save();

      if (flipHorizontal && flipVertical) {
        cellCtx.translate(sourceWidth, sourceHeight);
        cellCtx.scale(-1, -1);
      } else if (flipVertical) {
        cellCtx.translate(0, sourceHeight);
        cellCtx.scale(1, -1);
      } else if (flipHorizontal) {
        cellCtx.translate(sourceWidth, 0);
        cellCtx.scale(-1, 1);
      }

      cellCtx.drawImage(source, 0, 0, sourceWidth, sourceHeight);
      cellCtx.restore();

      gridCtx.putImageData(
        cellCtx.getImageData(0, 0, sourceWidth, sourceHeight),
        col * sourceWidth,
        row * sourceHeight,
      );
    }
  }

  return grid;
}
