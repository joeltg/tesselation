export const vert = `
precision highp float;

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

export const frag = `
precision highp float;
uniform sampler2D texture;
varying vec2 uv;
void main() {
  gl_FragColor = texture2D(texture, uv);
}`;
