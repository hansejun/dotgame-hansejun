import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { level } from '../src/levels.js';
import { palette, floor, wall, player, lanternOff, lanternOn, ghost, hudDigits } from '../src/sprites.js';
import { createState, transition, displayPosition, isMoving, isPassable, hudValues } from '../src/logic.js';
import { hudText } from '../src/strings.js';

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
      // Exercise every terrain edge independently; live ghost overlap is tested below.
      const initial = { ...createState(level), position: { x, y }, ghosts: [], nextGhostAt: Infinity };
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

const tick = (state, now, map = level) => transition(state, { type: 'tick' }, map, now);

test('AC-8/12/15: chapter 5 supplies five lanterns and one five-cell patrol, all passable', () => {
  const state = createState(level, 10000);
  assert.equal(state.lanterns.length, 5);
  assert.ok(state.lanterns.every((lantern) => !lantern.lit));
  assert.equal(state.ghosts.length, 1);
  assert.equal(state.ghosts[0].path.length, 5);
  assert.deepEqual(state.ghosts[0].position, state.ghosts[0].path[0]);
  assert.ok(state.ghosts[0].path.every((cell, index, path) => cell.y === path[0].y
    && cell.x === path[0].x + index && isPassable(level, cell.x, cell.y)));
  assert.ok(state.lanterns.every((cell) => isPassable(level, cell.x, cell.y)));
  assert.deepEqual(hudValues(state), { time: 60, score: 0, remaining: 5 });
  assert.equal(tick(state, 10399).ghosts[0].index, 0);
  assert.equal(tick(state, 10400).ghosts[0].index, 1);
  assert.throws(() => createState(['Paa', '..']), /rectangular/);
  assert.throws(() => createState(['PP']), /unique player start/);
  assert.throws(() => createState(['P?']), /known tiles/);
  for (const map of [['Pa'], ['Pa.a'], ['Paa', '..a']]) {
    assert.throws(() => createState(map), /continuous straight line/);
  }
});

test('AC-9/10/11: first logical contact earns 100 immediately; revisit earns zero', () => {
  const map = ['PLL'];
  const initial = createState(map);
  const snapshot = structuredClone(initial);
  let state = down(initial, 'ArrowRight', 0, map);
  assert.deepEqual(initial, snapshot);
  assert.equal(state.score, 100);
  assert.equal(hudValues(state).remaining, 1);
  assert.equal(state.lanterns[0].lit, true);
  assert.deepEqual(displayPosition(state, 0), { x: 0, y: 0 });
  assert.deepEqual(displayPosition(state, 60), { x: 0.5, y: 0 });
  assert.deepEqual(displayPosition(state, 120), { x: 1, y: 0 });
  state = up(state, 'ArrowRight', 0, map);
  state = down(state, 'ArrowLeft', 120, map);
  state = up(state, 'ArrowLeft', 120, map);
  state = down(state, 'ArrowRight', 240, map);
  assert.equal(state.score, 100);
  assert.equal(hudValues(state).remaining, 1);
});

test('AC-13/14: 400ms horizontal patrol reverses at endpoints without a wait', () => {
  const initial = createState(level);
  const origin = initial.ghosts[0].position;
  for (const [now, offset, direction] of [
    [399, 0, 1], [400, 1, 1], [800, 2, 1],
    [1600, 4, -1], [2000, 3, -1], [3200, 0, 1],
  ]) {
    const state = tick(initial, now);
    assert.deepEqual(state.ghosts[0].position, { x: origin.x + offset, y: origin.y });
    assert.equal(state.ghosts[0].direction, direction);
    assert.equal(state.status, 'playing');
  }
  assert.deepEqual(initial.ghosts[0].position, origin);
  const map = ['P.', '.a', '.a', '.a'];
  const vertical = createState(map);
  assert.deepEqual(tick(vertical, 400, map).ghosts[0].position, { x: 1, y: 2 });
  assert.deepEqual(tick(vertical, 800, map).ghosts[0].position, { x: 1, y: 3 });
  assert.deepEqual(tick(vertical, 1200, map).ghosts[0].position, { x: 1, y: 2 });
  const multiple = createState(['Paa.bb.cc']);
  assert.equal(multiple.ghosts.length, 3);
  assert.ok(tick(multiple, 400, ['Paa.bb.cc']).ghosts.every((patrol) => patrol.index === 1));
});

test('AC-15/16/17: real elapsed time, ceiling HUD and exact 60000ms timeout', () => {
  const map = ['P.'];
  const initial = createState(map, 10000);
  for (const [elapsed, time, status] of [
    [1, 60, 'playing'], [1000, 59, 'playing'],
    [59999, 1, 'playing'], [60000, 0, 'failed'], [60001, 0, 'failed'],
  ]) {
    const state = tick(initial, 10000 + elapsed, map);
    assert.equal(hudValues(state).time, time);
    assert.equal(state.status, status);
    if (status === 'failed') {
      assert.equal(state.failureReason, 'timeout');
      assert.equal(state.finishedAt, 70000);
    }
  }
  const blurred = transition(initial, { type: 'blur' }, map, 40000);
  assert.equal(blurred.remainingMs, 30000);
  assert.deepEqual(blurred.pressed, []);
  assert.equal(tick(blurred, 70001, map).status, 'failed');
  assert.equal(hudText({ time: 60, score: 0, remaining: 5 }), '시간 60   점수 0   등불 5');
});

test('AC-18/19: player enters ghost, ghost enters player, but adjacency is safe', () => {
  const map = ['Paaa.'];
  const initial = createState(map);
  assert.equal(down(initial, 'ArrowRight', 0, map).failureReason, 'collision');
  const waiting = { ...initial, position: { x: 2, y: 0 }, score: 100 };
  const failed = tick(waiting, 400, map);
  assert.equal(failed.failureReason, 'collision');
  assert.equal(failed.score, 100);
  const adjacent = { ...initial, position: { x: 4, y: 0 } };
  assert.equal(tick(adjacent, 400, map).status, 'playing');
  const visualOverlap = {
    ...initial, position: { x: 4, y: 0 },
    animation: { from: initial.ghosts[0].position, to: { x: 4, y: 0 }, startedAt: 0 },
  };
  assert.equal(tick(visualOverlap, 0, map).status, 'playing');
});

test('same-update exchange fails; equal deadline is coupled and never replayed', () => {
  const map = ['Paaaa.'];
  const waiting = { ...createState(map), position: { x: 2, y: 0 } };
  const swapped = down(waiting, 'ArrowLeft', 400, map);
  assert.equal(swapped.failureReason, 'collision');
  assert.deepEqual(swapped.position, { x: 1, y: 0 });
  assert.deepEqual(swapped.ghosts[0].position, { x: 2, y: 0 });
  const escape = down(waiting, 'ArrowRight', 400, map);
  assert.equal(escape.status, 'playing');
  assert.equal(escape.ghosts[0].index, 1);
  assert.equal(tick(escape, 400, map).ghosts[0].index, 1);
  const alreadyFailed = tick(waiting, 400, map);
  assert.equal(down(alreadyFailed, 'ArrowRight', 400, map), alreadyFailed);
});

test('catch-up checks each intermediate deadline and stops before a later input', () => {
  const map = ['Paaaa.'];
  const initial = { ...createState(map), position: { x: 2, y: 0 } };
  const snapshot = structuredClone(initial);
  const failed = down(initial, 'ArrowRight', 2000, map);
  assert.equal(failed.failureReason, 'collision');
  assert.equal(failed.finishedAt, 400);
  assert.equal(failed.ghosts[0].index, 1);
  assert.deepEqual(failed.position, initial.position);
  assert.equal(failed.remainingMs, 59600);
  assert.deepEqual(initial, snapshot);
});

test('AC-20/22: five lights earn 500 plus floor seconds times 10, once', () => {
  const map = ['PLLLLL'];
  for (const [remainingMs, shown, bonus] of [[12999, 13, 120], [13000, 13, 130], [1, 1, 0]]) {
    let state = createState(map);
    for (const now of [0, 120, 240, 360]) {
      state = down(state, 'ArrowRight', now, map);
      state = up(state, 'ArrowRight', now, map);
    }
    state = down(state, 'ArrowRight', 60000 - remainingMs, map);
    assert.equal(state.status, 'cleared');
    assert.deepEqual(hudValues(state), { time: shown, score: 500 + bonus, remaining: 0 });
    assert.equal(tick(state, 90000, map), state);
    assert.equal(down(state, 'ArrowLeft', 90000, map), state);
    assert.deepEqual(displayPosition(state, state.finishedAt), state.position);
    assert.deepEqual(displayPosition(state, 90000), state.position);
  }
});

test('last-light collision and timeout take priority: light remains but new score is zero', () => {
  const map = ['PLL', 'aaa'];
  let initial = createState(map);
  initial = down(initial, 'ArrowRight', 0, map);
  initial = up(initial, 'ArrowRight', 0, map);
  assert.equal(initial.score, 100);
  // Synthetic unit state exercises a shared light/ghost destination unavailable in the real map.
  const collisionState = {
    ...initial,
    ghosts: [{ ...initial.ghosts[0], path: [{ x: 2, y: 1 }, { x: 2, y: 0 }], position: { x: 2, y: 1 } }],
  };
  const collision = down(collisionState, 'ArrowRight', 400, map);
  assert.equal(collision.status, 'failed');
  assert.equal(collision.failureReason, 'collision');
  assert.equal(hudValues(collision).remaining, 0);
  assert.equal(collision.score, 100);
  const timeoutMap = ['PLL'];
  let timed = down(createState(timeoutMap), 'ArrowRight', 0, timeoutMap);
  timed = up(timed, 'ArrowRight', 0, timeoutMap);
  const timeout = down(timed, 'ArrowRight', 60000, timeoutMap);
  assert.equal(timeout.failureReason, 'timeout');
  assert.equal(hudValues(timeout).remaining, 0);
  assert.equal(timeout.score, 100);
  const late = down(timed, 'ArrowRight', 60001, timeoutMap);
  assert.equal(hudValues(late).remaining, 1);
  assert.equal(late.finishedAt, 60000);
});

test('AC-21/23: failure freezes score, patrol, clock, input and displayed animation', () => {
  const map = ['Paaa.'];
  const failed = down(createState(map), 'ArrowRight', 0, map);
  const snapshot = structuredClone(failed);
  for (const event of [{ type: 'tick' }, { type: 'blur' }, { type: 'keyup', key: 'ArrowRight' }, { type: 'keydown', key: 'ArrowRight', repeat: true }]) {
    assert.equal(transition(failed, event, map, 90000), failed);
  }
  assert.deepEqual(failed, snapshot);
  assert.deepEqual(displayPosition(failed, 0), failed.position);
  assert.deepEqual(displayPosition(failed, 90000), failed.position);
  assert.equal(isMoving(failed, 0), false);
  assert.throws(() => tick(tick(createState(map), 200, map), 199, map), /backwards/);
});

test('X1 / AC-20: final light shows the destination cell immediately, including upward movement', () => {
  for (const [map, key, target] of [
    [['L', 'P'], 'ArrowUp', { x: 0, y: 0 }],
    [['P', 'L'], 'ArrowDown', { x: 0, y: 1 }],
    [['LP'], 'ArrowLeft', { x: 0, y: 0 }],
    [['PL'], 'ArrowRight', { x: 1, y: 0 }],
  ]) {
    const initial = createState(map);
    const cleared = down(initial, key, 1000, map);
    assert.equal(cleared.status, 'cleared');
    assert.equal(cleared.score, 100 + 59 * 10);
    assert.deepEqual(cleared.position, target);
    for (const now of [1000, 1060, 1120, 90000]) {
      assert.deepEqual(displayPosition(cleared, now), target);
    }
    assert.deepEqual(displayPosition(initial, 1000), initial.position);
    assert.equal(tick(cleared, 90000, map), cleared);
  }
});

test('X2 / AC-16: fixed palette digits preserve the 4 crossbar and descending stem', () => {
  assert.equal(hudDigits.length, 10);
  assert.equal(new Set(hudDigits.map((digit) => JSON.stringify(digit))).size, 10);
  for (const digit of hudDigits) {
    assert.equal(digit.length, 7);
    assert.ok(digit.every((row) => row.length === 5 && row.every((pixel) => pixel === null || pixel === 6)));
  }
  const four = hudDigits[4];
  assert.ok(four[4].every((pixel) => pixel === 6));
  assert.ok(four.every((row) => row[3] === 6));
  for (const row of four.slice(5)) {
    assert.equal(row.filter((pixel) => pixel !== null).length, 1);
  }
  assert.equal(four[0][0], null);
  assert.equal(four[3][0], 6);
});
