import { level } from './levels.js';
import { palette, floor, wall, player } from './sprites.js';
import { createState, transition, displayPosition } from './logic.js';

const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
let state = createState(level);

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

function render(now) {
  context.fillStyle = palette[0];
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < level.length; y += 1) {
    for (let x = 0; x < level[y].length; x += 1) {
      drawSprite(level[y][x] === '#' ? wall : floor, x * 16, 16 + y * 16);
    }
  }
  const position = displayPosition(state, now);
  drawSprite(player, Math.round(position.x * 16), 16 + Math.round(position.y * 16));
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
