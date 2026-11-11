import { level } from './levels.js';
import { palette, floor, wall, player, lanternOff, lanternOn, ghost, hudDigits } from './sprites.js';
import { createState, transition, displayPosition, hudValues } from './logic.js';
import { hudText } from './strings.js';

const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
let state = createState(level, performance.now());
const hudCanvas = document.createElement('canvas');
hudCanvas.width = 240;
hudCanvas.height = 16;
const hudContext = hudCanvas.getContext('2d', { willReadFrequently: true });
let previousHud = null;
let hudPixels = [];

function drawHud() {
  const text = hudText(hudValues(state));
  if (text !== previousHud) {
    hudContext.clearRect(0, 0, 240, 16);
    hudContext.font = '10px monospace';
    hudContext.fillStyle = palette[6];
    let cursor = 3;
    for (const character of text) {
      if (/^[0-9]$/.test(character)) {
        const sprite = hudDigits[Number(character)];
        for (let y = 0; y < sprite.length; y += 1) {
          for (let x = 0; x < sprite[y].length; x += 1) {
            if (sprite[y][x] !== null) hudContext.fillRect(cursor + x, 4 + y, 1, 1);
          }
        }
        cursor += 6;
      } else {
        hudContext.fillText(character, cursor, 11);
        cursor += character === ' ' ? 3 : 10;
      }
    }
    const { data } = hudContext.getImageData(0, 0, 240, 16);
    hudPixels = [];
    // Threshold label glyphs; bitmap digits already have fully opaque pixels.
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 240; x += 1) {
        if (data[(y * 240 + x) * 4 + 3] >= 128) hudPixels.push({ x, y });
      }
    }
    previousHud = text;
  }
  context.fillStyle = palette[6];
  for (const { x, y } of hudPixels) context.fillRect(x, y, 1, 1);
}

function drawSprite(sprite, x, y) {
  for (let row = 0; row < sprite.length; row += 1) {
    for (let column = 0; column < sprite[row].length; column += 1) {
      const index = sprite[row][column];
      if (index === null) continue;
      context.fillStyle = palette[index];
      context.fillRect(x + column, y + row, 1, 1);
    }
  }
}

for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, (event) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    state = transition(state, event, level, performance.now());
  });
}
window.addEventListener('blur', () => {
  state = transition(state, { type: 'blur' }, level, performance.now());
});

function render() {
  const now = performance.now();
  state = transition(state, { type: 'tick' }, level, now);
  context.fillStyle = palette[0];
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < level.length; y += 1) {
    for (let x = 0; x < level[y].length; x += 1) {
      drawSprite(level[y][x] === '#' ? wall : floor, x * 16, 16 + y * 16);
    }
  }
  for (const lantern of state.lanterns) {
    drawSprite(lantern.lit ? lanternOn : lanternOff, lantern.x * 16, 16 + lantern.y * 16);
  }
  for (const patrol of state.ghosts) {
    drawSprite(ghost, patrol.position.x * 16, 16 + patrol.position.y * 16);
  }
  const position = displayPosition(state, now);
  drawSprite(player, Math.round(position.x * 16), 16 + Math.round(position.y * 16));
  drawHud();
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
