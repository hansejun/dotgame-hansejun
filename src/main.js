import { levels } from './levels.js';
import { palette, floor, wall, player, lanternOff, lanternOn, ghost, hudDigits } from './sprites.js';
import { createTitleState, transition, transitionEffects, displayPosition, hudValues } from './logic.js';
import { hudText, screenLines } from './strings.js';
import { createAudio } from './audio.js';
import { createBestScoreStore } from './storage.js';

const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
let state = createTitleState(levels);
const audio = createAudio();
const bestScore = createBestScoreStore();
const textCanvas = document.createElement('canvas');
textCanvas.width = 240;
textCanvas.height = 16;
const textContext = textCanvas.getContext('2d', { willReadFrequently: true });
const textCache = new Map();

function textMask(text, fontSize) {
  const cacheKey = `${fontSize}:${text}`;
  if (textCache.has(cacheKey)) return textCache.get(cacheKey);
  textContext.clearRect(0, 0, 240, 16);
  textContext.font = `${fontSize}px monospace`;
  textContext.fillStyle = palette[6];
  const digitScale = fontSize === 14 ? 2 : 1;
  const digitTop = digitScale === 2 ? 1 : 4;
  let cursor = 0;
  for (const character of text) {
    if (/^[0-9]$/.test(character)) {
      const sprite = hudDigits[Number(character)];
      for (let y = 0; y < sprite.length; y += 1) {
        for (let x = 0; x < sprite[y].length; x += 1) {
          if (sprite[y][x] !== null) {
            textContext.fillRect(cursor + x * digitScale, digitTop + y * digitScale, digitScale, digitScale);
          }
        }
      }
      cursor += 6 * digitScale;
    } else {
      textContext.fillText(character, cursor, fontSize + 1);
      cursor += character === ' ' ? 3 : /^[A-Za-z]$/.test(character) ? Math.ceil(fontSize * 0.6) : fontSize;
    }
  }
  const { data } = textContext.getImageData(0, 0, 240, 16);
  const pixels = [];
  // Threshold label glyphs; bitmap digits already have fully opaque pixels.
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 240; x += 1) {
      if (data[(y * 240 + x) * 4 + 3] >= 128) pixels.push({ x, y });
    }
  }
  const mask = { pixels, width: cursor };
  textCache.set(cacheKey, mask);
  return mask;
}

function drawText(text, x, y, fontSize) {
  const { pixels, width } = textMask(text, fontSize);
  const left = x === null ? Math.floor((canvas.width - width) / 2) : x;
  context.fillStyle = palette[6];
  for (const pixel of pixels) context.fillRect(left + pixel.x, y + pixel.y, 1, 1);
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

function dispatch(event, now) {
  const previous = state;
  state = transition(previous, event, levels, now);
  const navigated = (previous.status === 'title' || previous.status === 'cleared')
    ? state.status === 'playing' : state.status === 'title';
  if (event.isTrusted && event.type === 'keydown' && event.key === 'Enter'
    && !event.repeat && !previous.enterPressed && navigated) audio.unlock();
  const effects = transitionEffects(previous, state);
  if (effects.recordScore !== null) bestScore.record(effects.recordScore);
  if (effects.sound !== null) audio.play(effects.sound);
}

for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, (event) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    dispatch(event, performance.now());
  });
}
window.addEventListener('blur', () => {
  dispatch({ type: 'blur' }, performance.now());
});

function render() {
  const now = performance.now();
  dispatch({ type: 'tick' }, now);
  context.fillStyle = palette[0];
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (state.status === 'playing') {
    const level = levels[state.levelIndex].map;
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
    drawText(hudText(hudValues(state)), 3, 0, 10);
  } else {
    const lines = screenLines(state, bestScore.value);
    const top = lines.length === 2 ? 64 : 48;
    for (let index = 0; index < lines.length; index += 1) {
      drawText(lines[index], null, top + index * 32, 14);
    }
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
