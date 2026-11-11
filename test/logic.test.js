import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { level } from '../src/levels.js';
import { palette, floor, wall, player, lanternOff, lanternOn, ghost } from '../src/sprites.js';
import {
  createState, transition, tick, displayPosition, isMoving, isPassable,
  ghostCell, isLit, remainingLanterns, remainingMs, hudSeconds,
} from '../src/logic.js';

const down = (state, key, now, map = level, repeat = false) => transition(state, { type: 'keydown', key, repeat }, map, now);
const up = (state, key, now, map = level) => transition(state, { type: 'keyup', key }, map, now);

test('AC-1: actual map and palette match chapters 5 and 6', () => {
  const design = readFileSync(new URL('../GAME_DESIGN.md', import.meta.url), 'utf8');
  assert.deepEqual(level, design.match(/```text\n([\s\S]*?)\n```/)[1].split('\n'));
  assert.equal(level.length, 11);
  assert.ok(level.every((row) => row.length === 15 && /^[#.PLa]+$/.test(row)));
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
  for (const [sprite, allowed] of [
    [floor, [0, 1]], [wall, [0, 1, 2, 3]], [player, [null, 0, 4, 5, 6]],
    [lanternOff, [null, 0, 2, 3]], [lanternOn, [null, 0, 5, 6]], [ghost, [null, 0, 7]],
  ]) {
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

// goal-2: 기대값은 GAME_DESIGN.md 2장·9장의 숫자(100점, 400ms, 60,000ms, floor(남은 초)×10)에서 가져온다
const press = (state, key, now, map = level) => up(down(state, key, now, map), key, now, map);

test('AC-8/12: level 1 has 5 unlit lanterns, one ghost at leftmost a, passable lantern/path cells', () => {
  const state = createState(level);
  const lanterns = [];
  const path = [];
  level.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === 'L') lanterns.push({ x, y });
    if (cell === 'a') path.push({ x, y });
  }));
  assert.equal(lanterns.length, 5);
  assert.equal(remainingLanterns(state), 5);
  assert.ok(lanterns.every(({ x, y }) => !isLit(state, x, y) && isPassable(level, x, y)));
  assert.equal(state.ghosts.length, 1);
  assert.equal(path.length, 5);
  assert.ok(path.every(({ x, y }, i) => y === path[0].y && x === path[0].x + i && isPassable(level, x, y)));
  assert.deepEqual(ghostCell(state.ghosts[0]), path[0]);
  assert.equal(state.score, 0);
  assert.equal(hudSeconds(state, 0), 60);
});

test('AC-9/10/11: lantern lights at the logical input instant, +100 once, revisit adds nothing', () => {
  let state = createState(level);
  for (const now of [0, 200, 400]) state = press(state, 'ArrowRight', now);
  assert.equal(state.score, 0);
  state = press(state, 'ArrowRight', 600);
  assert.deepEqual(state.position, { x: 5, y: 1 });
  assert.ok(isLit(state, 5, 1));
  assert.deepEqual(displayPosition(state, 600), { x: 4, y: 1 });
  assert.ok(isMoving(state, 719));
  assert.equal(state.score, 100);
  assert.equal(remainingLanterns(state), 4);
  state = press(press(state, 'ArrowLeft', 800), 'ArrowRight', 1000);
  assert.deepEqual(state.position, { x: 5, y: 1 });
  assert.equal(state.score, 100);
  assert.equal(remainingLanterns(state), 4);
  assert.equal(state.status, 'playing');
});

test('AC-12: walls still block on the level 1 map', () => {
  const state = press(createState(level), 'ArrowUp', 0);
  assert.deepEqual(state.position, createState(level).position);
  assert.equal(state.animation, null);
});

test('AC-13/14: ghost steps every 400ms and bounces on the 5-cell path without waiting', () => {
  const start = createState(level);
  const x = (now) => ghostCell(tick(start, level, now).ghosts[0]).x;
  assert.equal(x(0), 5);
  assert.equal(x(399), 5);
  assert.equal(x(400), 6);
  assert.equal(x(800), 7);
  assert.equal(x(1600), 9);
  assert.equal(x(1999), 9);
  assert.equal(x(2000), 8);
  assert.equal(x(3200), 5);
  assert.equal(x(3600), 6);
  for (let now = 0; now <= 20000; now += 400) {
    const cell = ghostCell(tick(start, level, now).ghosts[0]);
    assert.equal(level[cell.y][cell.x], 'a');
  }
  assert.equal(ghostCell(tick(start, level, 1000).ghosts[0]).x, ghostCell(tick(tick(start, level, 500), level, 1000).ghosts[0]).x);
});

test('AC-15/16/17: HUD time is ceil(remaining ms / 1000) and time runs out at exactly 60,000ms', () => {
  const start = createState(level, 1000);
  assert.equal(hudSeconds(start, 1000), 60);
  assert.equal(hudSeconds(start, 1001), 60);
  assert.equal(hudSeconds(start, 2000), 59);
  assert.equal(hudSeconds(start, 2001), 59);
  const before = tick(start, level, 60999);
  assert.equal(before.status, 'playing');
  assert.equal(remainingMs(before, 60999), 1);
  assert.equal(hudSeconds(before, 60999), 1);
  for (const state of [tick(start, level, 61000), tick(start, level, 61001), tick(before, level, 61001)]) {
    assert.equal(state.status, 'failed');
    assert.equal(state.failReason, 'time');
    assert.equal(state.endedAt, 61000);
    assert.equal(hudSeconds(state, 99999), 0);
    assert.equal(state.ghostTicks, 150);
  }
});

const strip = ['#PLLLLL#'];
const lightFour = () => {
  let state = createState(strip);
  for (const now of [0, 200, 400, 600]) state = press(state, 'ArrowRight', now, strip);
  assert.equal(state.score, 400);
  return state;
};

test('AC-20/22: clear bonus floor(remaining ms / 1000) x 10 is added once', () => {
  const at12999 = press(lightFour(), 'ArrowRight', 47001, strip);
  assert.equal(at12999.status, 'cleared');
  assert.equal(remainingLanterns(at12999), 0);
  assert.equal(hudSeconds(at12999, 47001), 13);
  assert.equal(at12999.score, 620);
  const at13000 = press(lightFour(), 'ArrowRight', 47000, strip);
  assert.equal(at13000.score, 500 + 130);
  const at1 = press(lightFour(), 'ArrowRight', 59999, strip);
  assert.equal(at1.status, 'cleared');
  assert.equal(hudSeconds(at1, 59999), 1);
  assert.equal(at1.score, 500);
  const later = press(tick(at12999, strip, 90000), 'ArrowLeft', 90000, strip);
  assert.equal(later.score, 620);
  assert.equal(later.status, 'cleared');
  assert.deepEqual(later.position, at12999.position);
  assert.equal(hudSeconds(later, 90000), 13);
});

test('last lantern exactly at 60,000ms fails: lantern lit, no 100 points, no bonus', () => {
  const state = press(lightFour(), 'ArrowRight', 60000, strip);
  assert.equal(state.status, 'failed');
  assert.equal(state.failReason, 'time');
  assert.equal(remainingLanterns(state), 0);
  assert.equal(state.score, 400);
  assert.equal(hudSeconds(state, 60000), 0);
});

test('AC-18: entering the ghost cell or the ghost entering the player cell fails immediately', () => {
  const map = ['#aaaaa#', '#P....#'];
  const intoGhost = press({ ...createState(map), position: { x: 1, y: 1 } }, 'ArrowUp', 100, map);
  assert.equal(intoGhost.status, 'failed');
  assert.equal(intoGhost.failReason, 'ghost');
  const waiting = { ...createState(map), position: { x: 3, y: 0 } };
  assert.equal(tick(waiting, map, 799).status, 'playing');
  const caught = tick(waiting, map, 800);
  assert.equal(caught.status, 'failed');
  assert.equal(caught.endedAt, 800);
  // 지연 호출도 중간 기한의 충돌을 건너뛰지 않고 최초 terminal에서 멈춘다
  const delayed = tick(waiting, map, 5000);
  assert.deepEqual(delayed, caught);
  assert.equal(press(waiting, 'ArrowDown', 5000, map).endedAt, 800);
});

test('same-update swap with the ghost fails using before/after logical cells', () => {
  const map = ['#aa#', '#P.#'];
  const state = { ...createState(map), position: { x: 2, y: 0 } };
  const swapped = press(state, 'ArrowLeft', 400, map);
  assert.deepEqual(swapped.position, { x: 1, y: 0 });
  assert.deepEqual(ghostCell(swapped.ghosts[0]), { x: 2, y: 0 });
  assert.equal(swapped.status, 'failed');
  assert.equal(swapped.failReason, 'ghost');
  const after = press(state, 'ArrowLeft', 401, map);
  assert.equal(after.status, 'failed');
  assert.equal(after.endedAt, 400);
});

test('last lantern together with a collision fails: lantern lit, no 100 points, no bonus', () => {
  const map = ['PL', '..'];
  const state = { ...createState(map), ghosts: [{ path: [{ x: 1, y: 1 }, { x: 1, y: 0 }], index: 0, step: 1 }] };
  const result = press(state, 'ArrowRight', 400, map);
  assert.equal(result.status, 'failed');
  assert.equal(result.failReason, 'ghost');
  assert.ok(isLit(result, 1, 0));
  assert.equal(remainingLanterns(result), 0);
  assert.equal(result.score, 0);
});

test('AC-19/21/23: after failure the score, time, ghost and position stay frozen', () => {
  let state = createState(level);
  for (const now of [0, 200, 400, 600]) state = press(state, 'ArrowRight', now);
  assert.equal(state.score, 100);
  const timedOut = tick(state, level, 60000);
  assert.equal(timedOut.status, 'failed');
  assert.equal(timedOut.score, 100);
  let later = tick(timedOut, level, 70000);
  for (const key of ['ArrowDown', 'ArrowLeft']) later = press(later, key, 70000);
  assert.equal(later.score, 100);
  assert.deepEqual(later.position, timedOut.position);
  assert.deepEqual(later.ghosts, timedOut.ghosts);
  assert.equal(hudSeconds(later, 70000), 0);
  // 실맵 유령 경로 위에서 충돌해도 이전 점수 100은 유지된다
  const onPath = { ...state, position: { x: 7, y: 4 } };
  const caught = press(onPath, 'ArrowDown', 800);
  assert.equal(caught.status, 'failed');
  assert.equal(caught.failReason, 'ghost');
  assert.equal(caught.score, 100);
  const frozen = press(tick(caught, level, 5000), 'ArrowUp', 5000);
  assert.deepEqual(frozen.position, caught.position);
  assert.deepEqual(frozen.ghosts, caught.ghosts);
  assert.equal(hudSeconds(frozen, 5000), hudSeconds(caught, 800));
});
