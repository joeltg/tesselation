import REGL from "regl";

import { generatePalette } from "./generatePalette.js";
import { generateImage } from "./generateImage.js";
import { Grid } from "./generateGrid.js";

const sourceSize = 240;
const sourceWidth = sourceSize * devicePixelRatio;
const sourceHeight = sourceSize * devicePixelRatio;

export const source = document.getElementById("source") as HTMLCanvasElement;
if (source === null) {
  throw new Error("missing source element");
}

source.style.width = sourceSize + "px";
source.style.height = sourceSize + "px";
source.width = sourceWidth;
source.height = sourceHeight;

function generateRandomImage() {
  const colorPalette = generatePalette();

  const ctx = source.getContext("2d");
  if (ctx === null) {
    throw new Error("failed to get source drawing context");
  }

  generateImage(ctx, sourceSize * devicePixelRatio, colorPalette);
}

generateRandomImage();

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

const vert = `
precision mediump float;

attribute vec2 vertex;
attribute vec2 position;
attribute vec2 size;
attribute vec2 flip;
attribute float angle;

uniform float sourceSize;
uniform vec2 resolution;
uniform vec2 offset;
varying vec2 uv;

void main() {
  vec2 p = size * vertex;
  vec2 f = mix(p, size - p, flip);
  vec2 v = vec2(
    cos(angle) * f.x + sin(angle) * f.y,
    -sin(angle) * f.x + cos(angle) * f.y
  );
  uv = (p + offset) / sourceSize;
  vec2 clipPos = ((v + position) / resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipPos.x, -clipPos.y, 0, 1);
}`;

const frag = `
precision mediump float;
uniform sampler2D texture;
varying vec2 uv;
void main() {
  gl_FragColor = texture2D(texture, uv);
}`;

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
    offset: () => [this.offsetX, this.offsetY],
    texture: regl.texture({
      width: grid.gridWidth,
      height: grid.gridHeight,
      data: grid.generate(source),
    }),
    sourceSize: grid.gridWidth,
  };

  protected abstract vertexBuffer: [number, number][];

  public offsetX: number = Math.random() * sourceSize;
  public offsetY: number = Math.random() * sourceSize;
  public abstract draw: REGL.DrawCommand;

  constructor(
    public width: number,
    public height: number,
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
      vert,
      frag,
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

const renderers: Record<string, (width: number, height: number) => Renderer> = {
  pmm: (width: number, height: number) => new RendererPMM(width, height),
  p4m: (width: number, height: number) => new RendererP4M(width, height),
  p3m1: (width: number, height: number) => new RendererP3M1(width, height),
  p6m: (width: number, height: number) => new RendererP6M(width, height),
};

const groupInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>("input[name='group']"),
);

const selectedGroupInput = groupInputs.find((input) => input.checked);
const initialGroup = selectedGroupInput?.value ?? "pmm";

let renderer = renderers[initialGroup](width, height);

for (const input of groupInputs) {
  input.addEventListener("change", () => {
    const group = input.value;
    renderer?.destroy();
    renderer = renderers[group](width, height);
  });
}

const randomImageButton = document.getElementById("random-image");
randomImageButton?.addEventListener("click", () => {
  const selectedGroupInput = groupInputs.find((input) => input.checked);
  const group = selectedGroupInput?.value ?? "pmm";
  generateRandomImage();
  renderer?.destroy();
  renderer = renderers[group](width, height);
});

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

  regl.clear({ color: [1, 1, 1, 1] });
  renderer.draw();
  requestAnimationFrame(animate);
}

source.addEventListener("mousemove", (evt) => {
  renderer.setOffset(evt.offsetX, evt.offsetY);
});

animate();
