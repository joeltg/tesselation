import REGL from "regl";

import { VoronoiGenerator } from "./generateImage.js";
import { Grid } from "./generateGrid.js";
import { WanderingAnt } from "./animate.js";
import { frag, vert } from "./shaders.js";
import { assert } from "./utils.js";
import { drawImage } from "./drawImage.js";

const sourceSize = 240;
const sourceWidth = sourceSize * devicePixelRatio;
const sourceHeight = sourceSize * devicePixelRatio;

const sourceContainer = document.getElementById("source-container");

const preview = document.getElementById("preview");
assert(preview instanceof HTMLCanvasElement, "missing #preview element");

const generator = new VoronoiGenerator(sourceWidth, sourceHeight);
generator.generate(1n);

preview.style.width = sourceSize + "px";
preview.style.height = sourceSize + "px";
preview.width = sourceWidth;
preview.height = sourceHeight;

const previewCtx = preview.getContext("2d");
assert(previewCtx !== null, "failed to get preview drawing context");

previewCtx.drawImage(generator.canvas, 0, 0);

const grid = new Grid(sourceSize);

const canvasContainer = document.getElementById("canvas-container");
if (canvasContainer === null) {
  throw new Error("missing canvas container element");
}

const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
if (canvas === null) {
  throw new Error("missing canvas element");
}

const regl = REGL({ canvas, extensions: ["ANGLE_instanced_arrays"] });

let width = canvasContainer!.offsetWidth * devicePixelRatio;
let height = canvasContainer!.offsetHeight * devicePixelRatio;

type Item = {
  position: [x: number, y: number];
  size: [width: number, height: number];
  angle?: number;
  flipX?: boolean;
  flipY?: boolean;
};

type Buffers = {
  position: REGL.Buffer;
  size: REGL.Buffer;
  flip: REGL.Buffer;
  angle: REGL.Buffer;
};

abstract class Renderer {
  protected static triangleVertexBuffer: [number, number][] = [
    [0.5, 0],
    [1, 1],
    [0, 1],
  ];

  protected static squareVertexBuffer: [number, number][] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0, 1],
    [1, 0],
  ];

  private static createBuffers(data: Item[]): Buffers {
    return {
      position: regl.buffer(data.map((d) => d.position)),
      size: regl.buffer(data.map((d) => d.size)),
      flip: regl.buffer(data.map((d) => [d.flipY ? 1 : 0, d.flipX ? 1 : 0])),
      angle: regl.buffer(data.map((d) => d.angle ?? 0)),
    };
  }

  private data: Item[];
  private buffers: Buffers;

  private uniforms = {
    resolution: () => [this.width, this.height],
    offset: () => {
      return [this.offsetX, this.offsetY];
    },
    texture: regl.texture({
      width: grid.gridWidth,
      height: grid.gridHeight,
      data: grid.generate(this.source),
      min: "linear",
      mag: "linear",
      // wrap: "repeat", // optional: for seamless scrolling
    }),
    sourceSize: grid.gridWidth,
  };

  protected abstract vertexBuffer: [number, number][];

  public animate: boolean = true;
  public offsetX: number = Math.random() * sourceSize;
  public offsetY: number = Math.random() * sourceSize;

  public abstract draw: REGL.DrawCommand;

  constructor(
    public width: number,
    public height: number,
    public source: CanvasImageSource,
  ) {
    this.data = Array.from(this.generate());
    this.buffers = Renderer.createBuffers(this.data);
  }

  public setOffset(offsetX: number, offsetY: number) {
    this.offsetX = clamp(offsetX, 0, sourceSize) * devicePixelRatio;
    this.offsetY = clamp(offsetY, 0, sourceSize) * devicePixelRatio;
  }

  public setResolution(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public destroy() {
    for (const buffer of Object.values(this.buffers)) {
      buffer.destroy();
    }
  }

  protected abstract generate(): Iterable<Item>;

  protected getDrawCommand(): REGL.DrawCommand {
    return regl({
      vert: vert,
      frag: frag,
      attributes: {
        position: { buffer: this.buffers.position, divisor: 1 },
        size: { buffer: this.buffers.size, divisor: 1 },
        flip: { buffer: this.buffers.flip, divisor: 1 },
        angle: { buffer: this.buffers.angle, divisor: 1 },
        vertex: this.vertexBuffer,
      },
      uniforms: this.uniforms,
      depth: { enable: false },
      count: this.vertexBuffer.length,
      instances: this.data.length,
    });
  }
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const sqrt3 = Math.sqrt(3);

class RendererPMM extends Renderer {
  private static tileWidth = 200 * sqrt3;
  private static tileHeight = 200;

  protected vertexBuffer = Renderer.squareVertexBuffer;

  public draw = this.getDrawCommand();

  protected *generate(): Iterable<Item> {
    const w = 100 * sqrt3;
    const h = 100;
    const size: [number, number] = [w, h];

    const tileCountX = Math.ceil(this.width / RendererPMM.tileWidth);
    const tileCountY = Math.ceil(this.height / RendererPMM.tileHeight);

    for (let j = 0; j < tileCountY; j++) {
      const y = j * RendererPMM.tileHeight;
      for (let i = 0; i < tileCountX; i++) {
        const x = i * RendererPMM.tileWidth;
        yield* [
          { position: [x + 0, y + 0], size },
          { position: [x + 0, y + h], size, flipX: true },
          { position: [x + w, y + 0], size, flipY: true },
          { position: [x + w, y + h], size, flipX: true, flipY: true },
        ];
      }
    }
  }
}

class RendererP4M extends Renderer {
  private static tileWidth = 200;
  private static tileHeight = 200;

  protected vertexBuffer = Renderer.triangleVertexBuffer;

  public draw = this.getDrawCommand();

  protected *generate(): Iterable<Item> {
    const w = 100 * Math.SQRT2;
    const h = 100 * Math.SQRT1_2;
    const size: [number, number] = [w, h];

    const tileCountX = Math.ceil(this.width / RendererP4M.tileWidth);
    const tileCountY = Math.ceil(this.height / RendererP4M.tileHeight);

    for (let j = 0; j < tileCountY; j++) {
      const y = j * RendererP4M.tileHeight;
      for (let i = 0; i < tileCountX; i++) {
        const x = i * RendererP4M.tileWidth;
        yield* [
          { position: [x + -50, y + 150], size, angle: Math.PI / 4 },
          {
            position: [x + 150, y + 150],
            size,
            angle: (5 * Math.PI) / 4,
            flipY: true,
          },
          {
            position: [x + 50, y + 150],
            size,
            angle: (3 * Math.PI) / 4,
            flipY: true,
          },
          { position: [x + 50, y + -50], size, angle: -Math.PI / 4 },
          { position: [x + 50, y + 50], size, angle: Math.PI / 4, flipY: true },
          { position: [x + 250, y + 50], size, angle: (5 * Math.PI) / 4 },
          { position: [x + 150, y + 250], size, angle: (6 * Math.PI) / 8 },
          {
            position: [x + 150, y + 50],
            size,
            angle: -(1 * Math.PI) / 4,
            flipY: true,
          },
        ];
      }
    }
  }
}

class RendererP3M1 extends Renderer {
  private static tileWidth = 100 * sqrt3;
  private static tileHeight = 150;

  protected vertexBuffer = Renderer.triangleVertexBuffer;

  public draw = this.getDrawCommand();

  protected *generate(): Iterable<Item> {
    const w = 100;
    const h = 100 * (sqrt3 / 2);
    const size: [number, number] = [w, h];

    const tileCountX = Math.ceil(this.width / RendererP3M1.tileWidth) + 1;
    const tileCountY = Math.ceil(this.height / RendererP3M1.tileHeight) + 1;

    for (let j = 0; j < tileCountY; j++) {
      const y = j * RendererP3M1.tileHeight;
      for (let i = 0; i < tileCountX; i++) {
        const offset = (j % 2) * 50 * sqrt3;
        let x = offset + i * RendererP3M1.tileWidth - 100;
        yield* [
          {
            position: [x + (-100 * sqrt3) / 4, y + 25],
            size,
            angle: Math.PI / 6,
          },
          {
            position: [x + 0, y + 50],
            size,
            angle: 3 * (Math.PI / 6),
            flipY: true,
          },
          {
            position: [x + 100 * sqrt3, y - 50],
            size,
            angle: 9 * (Math.PI / 6),
          },
          {
            position: [x + 75 * sqrt3, y - 25],
            size,
            angle: -(Math.PI / 6),
            flipY: true,
          },
          {
            position: [x + 75 * sqrt3, y + 175],
            size,
            angle: 5 * (Math.PI / 6),
          },
          {
            position: [x + 75 * sqrt3, y + 125],
            size,
            angle: 7 * (Math.PI / 6),
            flipY: true,
          },
        ];
      }
    }
  }
}

class RendererP6M extends Renderer {
  private static tileWidth = 200 * Math.sqrt(3);
  private static tileHeight = 300;

  protected vertexBuffer: [number, number][] = [
    [0, 0],
    [1, 0],
    [0, 1],
  ];

  public draw = this.getDrawCommand();

  protected *generate(): Iterable<Item> {
    const s = 100;
    const w = s * sqrt3;
    const h = s;
    const size: [number, number] = [w, h];

    const tileCountX = Math.ceil(this.width / RendererP6M.tileWidth) + 1;
    const tileCountY = Math.ceil(this.height / RendererP6M.tileHeight) + 1;

    for (let j = 0; j < tileCountY; j++) {
      const y = j * RendererP6M.tileHeight;
      for (let i = 0; i < tileCountX; i++) {
        const offset = (j % 2) * w;
        let x = i * RendererP6M.tileWidth - w - offset;

        yield* [
          { position: [x + w, y + 300], size, angle: Math.PI },
          {
            position: [x + 100 * sqrt3, y + 200],
            size,
            angle: (8 * Math.PI) / 6,
            flipX: true,
          },
          {
            position: [x + 2 * w, y + 300],
            size,
            angle: Math.PI,
            flipY: true,
          },
          { position: [x + 1.5 * w, y + 150], size, angle: -Math.PI / 3 },
          {
            position: [x + 2 * w, y + 300],
            size,
            angle: (2 * Math.PI) / 3,
            flipY: true,
          },
          {
            position: [x + 2.5 * w, y + 150],
            size,
            angle: (-2 * Math.PI) / 3,
          },
          {
            position: [x + 2 * w, y + 100],
            size,
            angle: Math.PI / 3,
            flipX: true,
          },
          {
            position: [x + 0.5 * w, y + 150],
            size,
            angle: (1 * Math.PI) / 3,
          },
          {
            position: [x + w, y + 200],
            size,
            angle: (2 * Math.PI) / 3,
            flipX: true,
          },
          {
            position: [x + 1.5 * w, y + 150],
            size,
            angle: (2 * Math.PI) / 3,
          },
          { position: [x + 2 * w, y], size },
          { position: [x + w, y], size, flipY: true },
        ];
      }
    }
  }
}

type RendererFactory = (
  width: number,
  height: number,
  source: CanvasImageSource,
) => Renderer;

const renderers: Record<string, RendererFactory> = {
  pmm: (width, height, source) => new RendererPMM(width, height, source),
  p4m: (width, height, source) => new RendererP4M(width, height, source),
  p3m1: (width, height, source) => new RendererP3M1(width, height, source),
  p6m: (width, height, source) => new RendererP6M(width, height, source),
};

const groupInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>("input[name='group']"),
);

const selectedGroupInput = groupInputs.find((input) => input.checked);

let group = selectedGroupInput?.value ?? "p6m";
let renderer = renderers[group](width, height, generator.canvas);

for (const input of groupInputs) {
  input.addEventListener("change", () => {
    group = input.value;
    renderer?.destroy();
    renderer = renderers[group](width, height, renderer.source);
  });
}

const randomImage = document.getElementById("random-image");
randomImage?.addEventListener("click", () => {
  const seed = BigInt(Math.round(Math.random() * 0xffffffff));
  generator.generate(seed);
  previewCtx.drawImage(generator.canvas, 0, 0);
  renderer?.destroy();
  renderer = renderers[group](width, height, generator.canvas);
});

const selectImage = document.getElementById("select-image");
assert(selectImage instanceof HTMLInputElement, "#select-image not found");
selectImage.addEventListener("change", () => {
  if (selectImage.files !== null) {
    const [file] = selectImage.files;
    console.log(file);
    // Create image bitmap from file (modern, performant approach)
    createImageBitmap(file).then((imageBitmap) => {
      const canvas = new OffscreenCanvas(sourceWidth, sourceHeight);
      drawImage(imageBitmap, canvas);

      renderer?.destroy();
      renderer = renderers[group](width, height, canvas);
    });
  }
});

const ant = new WanderingAnt(0.999, 0.0002, 0.02);
const v = 0.2;

const rangeX = sourceWidth * 2;
const rangeY = sourceHeight * 2;

previewCtx.lineWidth = 2;

function animate() {
  if (canvas === null) {
    throw new Error("missing canvas element");
  }

  width = canvasContainer!.offsetWidth * devicePixelRatio;
  height = canvasContainer!.offsetHeight * devicePixelRatio;
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setResolution(width, height);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = Math.floor(canvasContainer!.offsetWidth) + "px";
    canvas.style.height = Math.floor(canvasContainer!.offsetHeight) + "px";
    regl.poll();
  }

  if (renderer.animate) {
    const angle = ant.getAngle();
    const dx = v * Math.cos(angle);
    const dy = v * Math.sin(angle);

    renderer.offsetX += dx;
    renderer.offsetY += dy;
    if (renderer.offsetX < 0) renderer.offsetX += rangeX;
    if (renderer.offsetX > rangeX) renderer.offsetX -= rangeX;
    if (renderer.offsetY < 0) renderer.offsetY += rangeY;
    if (renderer.offsetY > rangeY) renderer.offsetY -= rangeY;
  }

  regl.clear({ color: [1, 1, 1, 1] });
  renderer.draw();

  if (previewCtx !== null) {
    previewCtx.clearRect(0, 0, sourceWidth, sourceHeight);
    previewCtx.drawImage(renderer.source, 0, 0);

    const isLeftSide = renderer.offsetX < sourceWidth;
    const isTopSide = renderer.offsetY < sourceHeight;

    const x = isLeftSide
      ? renderer.offsetX
      : 2 * sourceWidth - renderer.offsetX;

    const y = isTopSide
      ? renderer.offsetY
      : 2 * sourceHeight - renderer.offsetY;

    previewCtx.beginPath();
    previewCtx.arc(x, y, 10, 0, 2 * Math.PI);
    previewCtx.stroke();

    previewCtx.beginPath();
    if (isLeftSide && isTopSide) {
      previewCtx.arc(x, y, 10, 0, 2 * Math.PI);
    } else if (isLeftSide) {
      previewCtx.arc(x, y, 10, Math.PI, 0);
    } else if (isTopSide) {
      previewCtx.arc(x, y, 10, Math.PI / 2, (3 * Math.PI) / 2);
    }
    previewCtx.fill();
  }

  requestAnimationFrame(animate);
}

preview.addEventListener("mousemove", (evt) => {
  renderer.setOffset(evt.offsetX, evt.offsetY);
});

preview.addEventListener("mouseenter", (evt) => {
  renderer.animate = false;
});

preview.addEventListener("mouseleave", (evt) => {
  renderer.animate = true;
});

window.addEventListener("keydown", (evt) => {
  if (evt.key === "Escape") {
    if (sourceContainer) {
      if (sourceContainer.style.getPropertyValue("display") === "none") {
        sourceContainer.style.setProperty("display", null);
      } else {
        sourceContainer.style.setProperty("display", "none");
      }
    }
  }
});

animate();
