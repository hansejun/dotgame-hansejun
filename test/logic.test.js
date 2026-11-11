import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { level } from '../src/levels.js';
import { palette, floor, wall, player } from '../src/sprites.js';
import { createState, transition, displayPosition, isMoving, isPassable } from '../src/logic.js';

const down = (state, key, now, map = level, repeat = false) => transition(state, { type: 'keydown', key, repeat }, map, now);
const up = (state, key, now, map = level) => transition(state, { type: 'keyup', key }, map, now);

test('AC-1: actual map and palette match chapters 5 and 6', () => {
  const design = readFileSync(new URL('../GAME_DESIGN.md', import.meta.url), 'utf8');
  assert.deepEqual(level, design.match(/```text\n([\s\S]*?)\n```/)[1].split('\n'));
  assert.equal(level.length, 11);
  assert.ok(level.every((row) => row.length === 15 && /^[#.P]+$/.test(row)));
  assert.equal(level.join('').split('P').length - 1, 1);
  assert.deepEqual(palette, ['#101820', '#233B4D', '#49616C', '#78909A', '#E3C39D', '#D69A3A', '#F6E7B0', '#9FD6D2']);
  const state = createState(level);
  assert.equal(level[state.position.y][state.position.x], 'P');
  assert.ok(isPassable(level, state.position.x, state.position.y));
  const reached = new Set([`${state.position.x},${state.position.y}`]);
  const queue = [state.position];
  for (const { x, y } of queue) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${x + dx},${y + dy}`;
      if (isPassable(level, x + dx, y + dy) && !reached.has(key)) {
        reached.add(key);
        queue.push({ x: x + dx, y: y + dy });
      }
    }
  }
  assert.equal(reached.size, [...level.join('')].filter((cell) => cell !== '#').length);
  for (const [sprite, allowed] of [[floor, [0, 1]], [wall, [0, 1, 2, 3]], [player, [null, 0, 4, 5, 6]]]) {
    assert.equal(sprite.length, 16);
    assert.ok(sprite.every((row) => row.length === 16 && row.every((pixel) => allowed.includes(pixel))));
  }
  assert.ok(player.flat().includes(null));
});

test('AC-2/3: immediate four-direction logical movement, display-only 120ms interpolation', () => {
  const map = ['...', '.P.', '...'];
  for (const [key, dx, dy] of [['ArrowUp', 0, -1], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0], ['ArrowRight', 1, 0]]) {
    const initial = createState(map);
    const snapshot = structuredClone(initial);
    Object.freeze(initial.position);
    Object.freeze(initial.pressed);
    Object.freeze(initial);
    const moved = down(initial, key, 100, map);
    assert.deepEqual(initial, snapshot);
    assert.deepEqual(moved.position, { x: 1 + dx, y: 1 + dy });
    assert.deepEqual(displayPosition(moved, 100), { x: 1, y: 1 });
    assert.deepEqual(displayPosition(moved, 160), { x: 1 + dx / 2, y: 1 + dy / 2 });
    assert.deepEqual(displayPosition(moved, 220), moved.position);
    assert.deepEqual(displayPosition(moved, 1000), moved.position);
    assert.deepEqual(displayPosition(moved, 99), initial.position);
    assert.ok(isMoving(moved, 219));
    assert.equal(isMoving(moved, 220), false);
  }
});

test('AC-4: locked inputs are discarded and held keys never replay', () => {
  let state = down(createState(level), 'ArrowRight', 0);
  state = down(state, 'ArrowDown', 119);
  state = up(state, 'ArrowRight', 119);
  const target = state.position;
  assert.deepEqual(down(state, 'ArrowDown', 120).position, target);
  assert.deepEqual(down(state, 'ArrowDown', 500, level, true).position, target);
  state = up(state, 'ArrowDown', 120);
  const moved = down(state, 'ArrowDown', 120);
  assert.deepEqual(moved.position, { x: target.x, y: target.y + 1 });
  assert.equal(moved.animation.startedAt, 120);
  assert.deepEqual(displayPosition(state, 500), target);
});

test('AC-5: holding does not repeat; release/repress does, including release while moving', () => {
  let state = down(createState(level), 'ArrowRight', 0);
  const target = state.position;
  assert.deepEqual(down(state, 'ArrowRight', 1000, level, true).position, target);
  assert.deepEqual(down(state, 'ArrowRight', 1000).position, target);
  state = up(state, 'ArrowRight', 60);
  assert.deepEqual(down(state, 'ArrowRight', 120).position, { x: target.x + 1, y: target.y });
  const repeatedWithoutPress = down(createState(level), 'ArrowRight', 0, level, true);
  assert.deepEqual(repeatedWithoutPress.position, createState(level).position);
  assert.deepEqual(down(repeatedWithoutPress, 'ArrowRight', 200).position, createState(level).position);
});

test('AC-6: every actual adjacent wall rejects without animation/lock and a fresh open key works', () => {
  for (let y = 0; y < level.length; y += 1) {
    for (let x = 0; x < level[y].length; x += 1) {
      if (!isPassable(level, x, y)) continue;
      const initial = { ...createState(level), position: { x, y } };
      for (const [key, dx, dy] of [['ArrowUp', 0, -1], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0], ['ArrowRight', 1, 0]]) {
        if (isPassable(level, x + dx, y + dy)) continue;
        const blocked = down(initial, key, 0);
        assert.deepEqual(blocked.position, initial.position);
        assert.equal(blocked.animation, null);
        assert.equal(isMoving(blocked, 0), false);
        for (const [openKey, ox, oy] of [['ArrowUp', 0, -1], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0], ['ArrowRight', 1, 0]]) {
          if (isPassable(level, x + ox, y + oy)) {
            assert.deepEqual(down(blocked, openKey, 0).position, { x: x + ox, y: y + oy });
          }
        }
      }
    }
  }
});

test('AC-6: open-edge fixture exercises actual bounds branch in all four directions', () => {
  for (const [map, key, openKey] of [
    [['P.'], 'ArrowLeft', 'ArrowRight'],
    [['.P'], 'ArrowRight', 'ArrowLeft'],
    [['P', '.'], 'ArrowUp', 'ArrowDown'],
    [['.', 'P'], 'ArrowDown', 'ArrowUp'],
  ]) {
    const initial = createState(map);
    const blocked = down(initial, key, 0, map);
    assert.deepEqual(blocked.position, initial.position);
    assert.equal(blocked.animation, null);
    assert.equal(isMoving(blocked, 0), false);
    assert.notDeepEqual(down(blocked, openKey, 0, map).position, initial.position);
  }
});

test('input lifecycle ignores other controls and recovers from missing keyup on blur', () => {
  const initial = createState(level);
  assert.equal(down(initial, 'Enter', 0), initial);
  assert.equal(transition(initial, { type: 'keypress', key: 'ArrowRight' }, level, 0), initial);
  let state = down(initial, 'ArrowRight', 0);
  state = transition(state, { type: 'blur' }, level, 60);
  assert.deepEqual(state.pressed, []);
  assert.deepEqual(state.position, { x: initial.position.x + 1, y: initial.position.y });
  assert.deepEqual(down(state, 'ArrowRight', 200, level, true).position, state.position);
  assert.deepEqual(down(state, 'ArrowRight', 200).position, { x: state.position.x + 1, y: state.position.y });
  assert.throws(() => createState(['...']), /player start/);
});

test('AC-6: expired animation followed by wall cannot restart animation or lock', () => {
  let state = down(createState(level), 'ArrowRight', 0);
  state = up(state, 'ArrowRight', 60);
  const blocked = down(state, 'ArrowUp', 120);
  assert.deepEqual(blocked.position, state.position);
  assert.equal(blocked.animation, state.animation);
  assert.equal(isMoving(blocked, 120), false);
  assert.deepEqual(displayPosition(blocked, 120), state.position);
  assert.deepEqual(displayPosition(blocked, 1000), state.position);
  const moved = down(blocked, 'ArrowRight', 120);
  assert.deepEqual(moved.position, { x: state.position.x + 1, y: state.position.y });
  assert.equal(moved.animation.startedAt, 120);
});
