import { level } from './levels.js';
import { palette, floor, wall, player, lanternOff, lanternOn, ghost } from './sprites.js';
import { strings } from './strings.js';
import {
  createState, transition, tick, displayPosition, ghostCell, isLit, hudSeconds, remainingLanterns,
} from './logic.js';

const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
let state = createState(level, performance.now());

// 글자는 안티앨리어싱 없이 팔레트 한 색으로만 찍기 위해 따로 그린 뒤 알파를 이진화한다
const textCanvas = document.createElement('canvas');
textCanvas.width = canvas.width;
textCanvas.height = 16;
const textContext = textCanvas.getContext('2d', { willReadFrequently: true });
let hudCache = { text: null, pixels: [] };

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

function hudPixels(items) {
  const text = items.join('|');
  if (hudCache.text === text) return hudCache.pixels;
  textContext.clearRect(0, 0, textCanvas.width, textCanvas.height);
  textContext.font = '12px sans-serif';
  textContext.textBaseline = 'middle';
  textContext.fillStyle = '#000';
  const slot = textCanvas.width / items.length;
  items.forEach((item, i) => {
    textContext.textAlign = 'center';
    textContext.fillText(item, slot * i + slot / 2, 8);
  });
  const { data } = textContext.getImageData(0, 0, textCanvas.width, textCanvas.height);
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= 128) pixels.push([(i / 4) % textCanvas.width, Math.floor(i / 4 / textCanvas.width)]);
  }
  hudCache = { text, pixels };
  return pixels;
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

function render(now) {
  state = tick(state, level, now);
  context.fillStyle = palette[0];
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < level.length; y += 1) {
    for (let x = 0; x < level[y].length; x += 1) {
      drawSprite(level[y][x] === '#' ? wall : floor, x * 16, 16 + y * 16);
      if (level[y][x] === 'L') drawSprite(isLit(state, x, y) ? lanternOn : lanternOff, x * 16, 16 + y * 16);
    }
  }
  for (const each of state.ghosts) {
    const cell = ghostCell(each);
    drawSprite(ghost, cell.x * 16, 16 + cell.y * 16);
  }
  const position = displayPosition(state, now);
  drawSprite(player, Math.round(position.x * 16), 16 + Math.round(position.y * 16));
  context.fillStyle = palette[6];
  for (const [x, y] of hudPixels([
    `${strings.hudTime} ${hudSeconds(state, now)}`,
    `${strings.hudScore} ${state.score}`,
    `${strings.hudLanterns} ${remainingLanterns(state)}`,
  ])) {
    context.fillRect(x, y, 1, 1);
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
