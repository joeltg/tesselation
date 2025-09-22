import REGL from "regl";

// this generates a grid that reflects the source cell across
// alternating axes so that we get continuous wrap-around when
// trying to sample from beyond the border

export class Grid {
  cellWidth: number;
  cellHeight: number;
  gridWidth: number;
  gridHeight: number;

  cell: OffscreenCanvas;
  grid: OffscreenCanvas;

  constructor(readonly size: number) {
    this.cellWidth = size * devicePixelRatio;
    this.cellHeight = size * devicePixelRatio;
    this.gridWidth = this.cellWidth * 3;
    this.gridHeight = this.cellHeight * 3;
    this.cell = new OffscreenCanvas(this.cellWidth, this.cellHeight);
    this.grid = new OffscreenCanvas(this.gridWidth, this.gridHeight);
  }

  generate(source: CanvasImageSource): REGL.TextureImageData {
    const cellCtx = this.cell.getContext("2d");
    if (cellCtx === null) {
      throw new Error("failed to get cell canvas context");
    }

    const gridCtx = this.grid.getContext("2d");
    if (gridCtx === null) {
      throw new Error("failed to get grid canvas context");
    }

    for (let row = 0; row < 3; row++) {
      const flipVertical = row % 2 === 1;
      for (let col = 0; col < 3; col++) {
        const flipHorizontal = col % 2 === 1;

        cellCtx.save();

        if (flipHorizontal && flipVertical) {
          cellCtx.translate(this.cellWidth, this.cellHeight);
          cellCtx.scale(-1, -1);
        } else if (flipVertical) {
          cellCtx.translate(0, this.cellHeight);
          cellCtx.scale(1, -1);
        } else if (flipHorizontal) {
          cellCtx.translate(this.cellWidth, 0);
          cellCtx.scale(-1, 1);
        }

        cellCtx.drawImage(source, 0, 0, this.cellWidth, this.cellHeight);
        cellCtx.restore();

        gridCtx.putImageData(
          cellCtx.getImageData(0, 0, this.cellWidth, this.cellHeight),
          col * this.cellWidth,
          row * this.cellHeight,
        );
      }
    }

    return this.grid as unknown as REGL.TextureImageData;
  }
}
