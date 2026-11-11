import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { levels } from '../src/levels.js';
import { palette, floor, wall, player, lanternOff, lanternOn, ghost, hudDigits } from '../src/sprites.js';
import { createState as createGameState, createTitleState as createGameTitle, transition as transitionGame, transitionEffects, displayPosition, isMoving, isPassable, hudValues } from '../src/logic.js';
import { hudText, screenLines as gameScreenLines } from '../src/strings.js';
import { createAudio } from '../src/audio.js';
import { createBestScoreStore } from '../src/storage.js';

const level = levels[0].map;
// Single-level fixtures retain the chapter 2 60-second baseline for core-rule regressions.
const definitions = (map) => [{ map, duration: 60000 }];
const createState = (map, now = 0) => createGameState(definitions(map), now);
const createTitleState = (map) => createGameTitle(definitions(map));
const transition = (state, event, map, now) => transitionGame(state, event, definitions(map), now);
const screenLines = (state) => gameScreenLines(state, 0);

const down = (state, key, now, map = level, repeat = false) => transition(state, { type: 'keydown', key, repeat }, map, now);
const up = (state, key, now, map = level) => transition(state, { type: 'keyup', key }, map, now);

test('AC-1: actual map and palette match chapters 5 and 6', () => {
  const design = readFileSync(new URL('../GAME_DESIGN.md', import.meta.url), 'utf8');
  const chapter = design.split('## 5 레벨 맵')[1].split('## 6 팔레트')[0];
  assert.deepEqual(level, chapter.split('### 레벨 1')[1].split('### 레벨 2')[0].match(/```text\n([\s\S]*?)\n```/)[1].split('\n'));
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

test('input lifecycle tracks Enter without restarting play and recovers from missing keyup on blur', () => {
  const initial = createState(level);
  const entered = down(initial, 'Enter', 0);
  assert.deepEqual(entered, { ...initial, enterPressed: true });
  assert.deepEqual(up(entered, 'Enter', 0), initial);
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
    assert.equal(state.status, 'final');
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
  for (const event of [{ type: 'tick' }, { type: 'keyup', key: 'ArrowRight' }, { type: 'keydown', key: 'ArrowRight', repeat: true }]) {
    assert.equal(transition(failed, event, map, 90000), failed);
  }
  assert.deepEqual(transition(failed, { type: 'blur' }, map, 90000), { ...failed, pressed: [] });
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
    assert.equal(cleared.status, 'final');
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

test('AC-24/25: title waits beyond 60000ms; fresh Enter starts a new full 60 seconds', () => {
  const title = createTitleState(level);
  const snapshot = structuredClone(title);
  assert.equal(tick(title, 60000), title);
  assert.equal(down(title, 'ArrowRight', 60000), title);
  assert.equal(up(title, 'ArrowRight', 60000), title);
  assert.equal(title.startedAt, null);
  assert.equal(title.nextGhostAt, Infinity);
  assert.deepEqual(screenLines(title), ['폭풍 전의 등불', 'ENTER로 시작', '최고 점수 0']);
  const playing = down(title, 'Enter', 60000);
  assert.equal(playing.status, 'playing');
  assert.equal(playing.startedAt, 60000);
  assert.equal(playing.updatedAt, 60000);
  assert.equal(playing.nextGhostAt, 60400);
  assert.deepEqual(hudValues(playing), { time: 60, score: 0, remaining: 5 });
  assert.deepEqual(playing.position, title.position);
  assert.deepEqual(playing.pressed, []);
  assert.equal(playing.animation, null);
  assert.equal(playing.enterPressed, true);
  assert.deepEqual(title, snapshot);
  assert.equal(tick(playing, 119999).status, 'playing');
  assert.equal(tick(playing, 120000).failureReason, 'timeout');
});

test('AC-26: play Enter advances real time but cannot restart, pause, or skip failure', () => {
  let state = down(createTitleState(level), 'Enter', 10000);
  state = down(state, 'Enter', 10400, level, true);
  assert.equal(state.startedAt, 10000);
  assert.equal(state.ghosts[0].index, 1);
  assert.equal(state.remainingMs, 59600);
  state = up(state, 'Enter', 10400);
  state = down(state, 'Enter', 10800);
  assert.equal(state.startedAt, 10000);
  assert.equal(state.ghosts[0].index, 2);
  assert.equal(state.remainingMs, 59200);
  state = up(state, 'Enter', 10800);
  // A fresh press received while playing must not be reused on the failure it discovers.
  state = down(state, 'Enter', 70000);
  assert.equal(state.status, 'failed');
  assert.equal(state.failureReason, 'timeout');
  assert.equal(state.enterPressed, true);
  assert.equal(down(state, 'Enter', 70001, level, true).status, 'failed');
});

test('AC-28/29: scored timeout returns to zero-score title; next start resets the whole level', () => {
  let state = down(createTitleState(level), 'Enter', 1000);
  state = up(state, 'Enter', 1000);
  for (const now of [1000, 1120, 1240, 1360]) {
    state = down(state, 'ArrowRight', now);
    state = up(state, 'ArrowRight', now);
  }
  assert.equal(state.score, 100);
  assert.equal(hudValues(state).remaining, 4);
  const failed = tick(state, 61000);
  const failedSnapshot = structuredClone(failed);
  assert.deepEqual(screenLines(failed), ['폭풍이 왔다', '점수 100', 'ENTER로 타이틀']);
  assert.equal(down(failed, 'ArrowLeft', 61001), failed);
  state = down(failed, 'Enter', 61001);
  assert.equal(state.status, 'title');
  assert.equal(state.score, 0);
  assert.equal(state.failureReason, null);
  assert.equal(state.finishedAt, null);
  assert.equal(state.animation, null);
  assert.deepEqual(state.pressed, []);
  assert.equal(state.startedAt, null);
  assert.equal(state.lanterns.filter((lantern) => lantern.lit).length, 0);
  assert.deepEqual(failed, failedSnapshot);
  assert.equal(down(state, 'Enter', 62000, level, true).status, 'title');
  assert.equal(down(state, 'Enter', 62000).status, 'title');
  state = up(state, 'Enter', 62001);
  state = down(state, 'Enter', 63000);
  assert.equal(state.status, 'playing');
  assert.equal(state.startedAt, 63000);
  assert.equal(state.nextGhostAt, 63400);
  assert.deepEqual(hudValues(state), { time: 60, score: 0, remaining: 5 });
  assert.deepEqual(state.position, createTitleState(level).position);
  assert.equal(state.ghosts[0].index, 0);
  assert.equal(state.ghosts[0].direction, 1);
  assert.deepEqual(state.ghosts[0].position, state.ghosts[0].path[0]);
  assert.deepEqual(state.pressed, []);
  assert.equal(state.animation, null);
});

test('AC-41/42: last-level final freezes 620 points and a fresh Enter returns only to title', () => {
  const map = ['PLLLLL'];
  let state = down(createTitleState(map), 'Enter', 0, map);
  state = up(state, 'Enter', 0, map);
  for (const now of [0, 120, 240, 360, 47001]) {
    state = down(state, 'ArrowRight', now, map);
    state = up(state, 'ArrowRight', now, map);
  }
  const cleared = structuredClone(state);
  assert.equal(state.status, 'final');
  assert.deepEqual(gameScreenLines(state, 620), ['모든 등불을 켰다', '점수 620', '최고 점수 620', 'ENTER로 타이틀']);
  assert.equal(tick(state, 90000, map), state);
  assert.equal(down(state, 'ArrowLeft', 90000, map), state);
  assert.equal(down(state, 'Enter', 90000, map, true).status, 'final');
  state = down(state, 'Enter', 90001, map);
  assert.equal(state.status, 'title');
  assert.equal(state.score, 0);
  assert.equal(down(state, 'Enter', 90002, map).status, 'title');
  assert.equal(down(state, 'Enter', 90002, map, true).status, 'title');
  state = down(up(state, 'Enter', 90003, map), 'Enter', 90004, map);
  assert.equal(state.status, 'playing');
  assert.equal(state.score, 0);
  assert.deepEqual(state.pressed, []);
  assert.equal(state.animation, null);
  assert.equal(cleared.score, 620);
});

test('AC-28/31: held Enter cannot pass through collision failure and title in one press', () => {
  const map = ['Paaa.'];
  const playing = down(createTitleState(map), 'Enter', 0, map);
  const failed = down(playing, 'ArrowRight', 1, map);
  assert.equal(failed.failureReason, 'collision');
  assert.deepEqual(screenLines(failed), ['유령에게 잡혔다', '점수 0', 'ENTER로 타이틀']);
  assert.equal(down(failed, 'Enter', 500, map, true).status, 'failed');
  assert.equal(down(failed, 'Enter', 500, map).status, 'failed');
  const released = up(failed, 'Enter', 501, map);
  const title = down(released, 'Enter', 502, map);
  assert.equal(title.status, 'title');
  assert.equal(title.score, 0);
  assert.equal(down(title, 'Enter', 1000, map, true).status, 'title');
  assert.equal(down(title, 'Enter', 1000, map).status, 'title');
  assert.equal(down(title, 'ArrowRight', 1000, map), title);
  const restarted = down(up(title, 'Enter', 1001, map), 'Enter', 1002, map);
  assert.equal(restarted.status, 'playing');
  assert.deepEqual(restarted.pressed, []);
  assert.equal(restarted.animation, null);
});

test('AC-32: blur clears both key lifetimes without pausing time or accepting auto-repeat', () => {
  let state = down(createTitleState(level), 'Enter', 10000);
  state = down(state, 'ArrowRight', 10001);
  state = transition(state, { type: 'blur' }, level, 69999);
  assert.equal(state.status, 'playing');
  assert.equal(state.remainingMs, 1);
  assert.equal(state.enterPressed, false);
  assert.deepEqual(state.pressed, []);
  const failed = transition(state, { type: 'blur' }, level, 70000);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.failureReason, 'timeout');
  assert.equal(failed.finishedAt, 70000);
  assert.deepEqual(screenLines(failed), ['폭풍이 왔다', '점수 0', 'ENTER로 타이틀']);
  const repeated = down(failed, 'Enter', 70001, level, true);
  assert.equal(repeated.status, 'failed');
  state = down(up(repeated, 'Enter', 70002), 'Enter', 70003);
  state = transition(state, { type: 'blur' }, level, 90000);
  assert.equal(state.status, 'title');
  assert.equal(state.enterPressed, false);
  assert.equal(down(state, 'Enter', 90000, level, true).status, 'title');
});

test('AC-24~32: only documented strings appear; keypress and unknown controls do not transition', () => {
  const title = createTitleState(level);
  assert.equal(transition(title, { type: 'keypress', key: 'Enter' }, level, 60000), title);
  assert.equal(down(title, 'Escape', 60000), title);
  assert.equal(down(title, ' ', 60000), title);
  const playing = down(title, 'Enter', 60000);
  assert.deepEqual(screenLines(playing), []);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(!/[가-힣]/.test(main), 'Korean UI copy belongs in strings.js, not the renderer');
});

const gameKey = (state, type, key, now, repeat = false, campaign = levels) => transitionGame(state, { type, key, repeat }, campaign, now);
const gameTick = (state, now, campaign = levels) => transitionGame(state, { type: 'tick' }, campaign, now);
const steps = [['ArrowUp', 0, -1], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0], ['ArrowRight', 1, 0]];

function safeRoute(map, origin, target) {
  const queue = [{ ...origin, keys: [] }];
  const visited = new Set([`${origin.x},${origin.y}`]);
  for (const { x, y, keys } of queue) {
    if (x === target.x && y === target.y) return keys;
    for (const [key, dx, dy] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      const id = `${nx},${ny}`;
      if (!isPassable(map, nx, ny) || 'abc'.includes(map[ny][nx]) || visited.has(id)) continue;
      visited.add(id);
      queue.push({ x: nx, y: ny, keys: [...keys, key] });
    }
  }
  assert.fail('Every approved lantern must be reachable without entering a patrol path');
}

function clearActualLevel(initial) {
  let state = initial;
  let now = state.startedAt;
  const map = levels[state.levelIndex].map;
  for (const target of initial.lanterns) {
    if (state.lanterns.find((lamp) => lamp.x === target.x && lamp.y === target.y).lit) continue;
    for (const key of safeRoute(map, state.position, target)) {
      state = gameKey(state, 'keydown', key, now);
      state = gameKey(state, 'keyup', key, now);
      assert.notEqual(state.status, 'failed');
      now += 240;
    }
  }
  assert.equal(state.status, state.levelIndex === 2 ? 'final' : 'cleared');
  assert.ok(state.finishedAt - state.startedAt < levels[state.levelIndex].duration);
  return state;
}

test('AC-33/34: every actual map matches its chapter 5 grid, counts, connectivity and straight patrols', () => {
  const design = readFileSync(new URL('../GAME_DESIGN.md', import.meta.url), 'utf8');
  const chapter = design.split('## 5 레벨 맵')[1].split('## 6 팔레트')[0];
  assert.equal(levels.length, 3);
  for (const [index, { map, duration }] of levels.entries()) {
    const section = chapter.split(`### 레벨 ${index + 1}`)[1].split('### 레벨 ')[0];
    assert.deepEqual(map, section.match(/```text\n([\s\S]*?)\n```/)[1].split('\n'));
    assert.equal(duration, [60000, 75000, 90000][index]);
    assert.equal(map.length, 11);
    assert.ok(map.every((row) => row.length === 15 && /^[#.PLa-c]+$/.test(row)));
    assert.ok(map[0] === '#'.repeat(15) && map[10] === '#'.repeat(15));
    assert.ok(map.every((row) => row[0] === '#' && row[14] === '#'));
    assert.equal(map.join('').split('P').length - 1, 1);
    const state = createGameState(levels, 10000, index);
    assert.equal(state.lanterns.length, [5, 7, 9][index]);
    assert.equal(state.ghosts.length, [1, 2, 3][index]);
    assert.deepEqual(hudValues(state), { time: [60, 75, 90][index], score: 0, remaining: [5, 7, 9][index] });
    for (const patrol of state.ghosts) {
      const label = map[patrol.path[0].y][patrol.path[0].x];
      assert.equal(patrol.path.length, { a: 5, b: 3, c: 4 }[label]);
      assert.equal(patrol.index, 0);
      assert.equal(patrol.direction, 1);
      assert.deepEqual(patrol.position, patrol.path[0]);
      assert.ok(patrol.path.every((cell, offset) => cell.y === patrol.path[0].y && cell.x === patrol.path[0].x + offset));
    }
    const seen = new Set([`${state.position.x},${state.position.y}`]);
    const queue = [state.position];
    for (const { x, y } of queue) {
      for (const [, dx, dy] of steps) {
        const id = `${x + dx},${y + dy}`;
        if (isPassable(map, x + dx, y + dy) && !seen.has(id)) {
          seen.add(id);
          queue.push({ x: x + dx, y: y + dy });
        }
      }
    }
    assert.equal(seen.size, [...map.join('')].filter((tile) => tile !== '#').length);
    for (const lamp of state.lanterns) assert.ok(safeRoute(map, state.position, lamp).length > 0);
  }
});

test('AC-34/38/40: 75/90-second clocks and every catch-up deadline use the active level from nonzero start', () => {
  for (const [index, duration] of [[1, 75000], [2, 90000]]) {
    const initial = createGameState(levels, 10000, index, 620);
    const snapshot = structuredClone(initial);
    for (const elapsed of [duration - 1, duration, duration + 1]) {
      const state = gameTick(initial, 10000 + elapsed);
      assert.equal(state.status, elapsed < duration ? 'playing' : 'failed');
      assert.equal(hudValues(state).time, elapsed < duration ? 1 : 0);
      assert.equal(state.remainingMs, elapsed < duration ? 1 : 0);
      assert.equal(state.score, 620);
      if (elapsed >= duration) {
        assert.equal(state.failureReason, 'timeout');
        assert.equal(state.finishedAt, 10000 + duration);
        assert.equal(gameTick(state, 999999), state);
      }
    }
    const blurred = transitionGame(initial, { type: 'blur' }, levels, 10000 + duration + 1);
    assert.equal(blurred.finishedAt, 10000 + duration);
    assert.equal(blurred.status, 'failed');
    assert.deepEqual(initial, snapshot);
  }
});

test('AC-34: all due ghosts move together with 5/3/4-cell periods and no endpoint wait', () => {
  const initial = createGameState(levels, 10000, 2);
  for (const [elapsed, indices] of [
    [399, [0, 0, 0]], [400, [1, 1, 1]], [800, [2, 2, 2]],
    [1200, [3, 1, 3]], [1600, [4, 0, 2]], [2000, [3, 1, 1]],
    [2400, [2, 2, 0]], [3200, [0, 0, 2]],
  ]) {
    const state = gameTick(initial, 10000 + elapsed);
    const byLabel = Object.fromEntries(state.ghosts.map((patrol) => [levels[2].map[patrol.path[0].y][patrol.path[0].x], patrol.index]));
    assert.deepEqual([byLabel.a, byLabel.b, byLabel.c], indices);
    assert.equal(state.status, 'playing');
  }
  assert.deepEqual(initial.ghosts.map((patrol) => patrol.index), [0, 0, 0]);
});

test('AC-38: b/c collisions and swaps cannot be hidden by the first ghost or a late input', () => {
  for (const label of ['b', 'c']) {
    const base = createGameState(levels, 10000, 2, 1440);
    const patrol = base.ghosts.find((ghost) => levels[2].map[ghost.path[0].y][ghost.path[0].x] === label);
    const initial = { ...base, position: patrol.path[1] };
    const snapshot = structuredClone(initial);
    for (const state of [gameTick(initial, 10400), gameKey(initial, 'keydown', 'ArrowLeft', 10400), gameKey(initial, 'keydown', 'ArrowRight', 12000)]) {
      assert.equal(state.failureReason, 'collision');
      assert.equal(state.finishedAt, 10400);
      assert.equal(state.remainingMs, 89600);
      assert.equal(state.score, 1440);
      assert.ok(state.ghosts.every((patrol) => patrol.index === 1));
      assert.equal(gameTick(state, 20000), state);
    }
    assert.deepEqual(initial, snapshot);
  }
});

test('AC-35/36/37/41/42: actual campaign clears safely, carries score and ends at final', () => {
  let state = gameKey(createGameTitle(levels), 'keydown', 'Enter', 10000);
  state = gameKey(state, 'keyup', 'Enter', 10000);
  for (let index = 0; index < 3; index += 1) {
    const previousScore = state.score;
    const cleared = clearActualLevel(state);
    const expected = previousScore + [500, 700, 900][index] + Math.floor(cleared.remainingMs / 1000) * 10;
    assert.equal(cleared.score, expected);
    assert.equal(cleared.levelIndex, index);
    assert.equal(hudValues(cleared).remaining, 0);
    const lines = index < 2 ? ['등불을 모두 켰다', `점수 ${expected}`, 'ENTER로 다음 레벨']
      : ['모든 등불을 켰다', `점수 ${expected}`, `최고 점수 ${expected}`, 'ENTER로 타이틀'];
    assert.deepEqual(gameScreenLines(cleared, expected), lines);
    const now = cleared.finishedAt + 100000;
    assert.equal(gameTick(cleared, now), cleared);
    assert.equal(gameKey(cleared, 'keydown', 'ArrowRight', now), cleared);
    const snapshot = structuredClone(cleared);
    state = gameKey(cleared, 'keydown', 'Enter', now);
    assert.deepEqual(cleared, snapshot);
    if (index === 2) {
      assert.equal(state.status, 'title');
      assert.equal(state.score, 0);
      assert.equal(state.levelIndex, 0);
      assert.equal(gameKey(state, 'keydown', 'Enter', now + 1, true).status, 'title');
      continue;
    }
    assert.equal(state.score, expected);
    assert.equal(state.status, 'playing');
    assert.equal(state.levelIndex, index + 1);
    assert.equal(state.startedAt, now);
    assert.equal(state.updatedAt, now);
    assert.equal(state.nextGhostAt, now + 400);
    assert.equal(state.remainingMs, [75000, 90000][index]);
    assert.deepEqual(state.position, createGameState(levels, now, index + 1).position);
    assert.deepEqual(state.pressed, []);
    assert.equal(state.animation, null);
    assert.ok(state.lanterns.every((lamp) => !lamp.lit));
    assert.ok(state.ghosts.every((patrol) => patrol.index === 0 && patrol.direction === 1));
    state = gameKey(state, 'keydown', 'Enter', now, true);
    state = gameKey(state, 'keydown', 'Enter', now);
    assert.equal(state.levelIndex, index + 1);
    assert.equal(state.score, expected);
    state = gameKey(state, 'keyup', 'Enter', now);
  }
});

test('AC-35/37: documented 12999ms bonus accumulates 620 to 1440 to 2460 exactly once', () => {
  const campaign = [5, 7, 9].map((count, index) => ({ map: [`P${'L'.repeat(count)}`], duration: [60000, 75000, 90000][index] }));
  let state = createGameState(campaign, 10000);
  for (let index = 0; index < 3; index += 1) {
    state = gameKey(state, 'keyup', 'Enter', state.startedAt, false, campaign);
    for (let lamp = 0; lamp < [5, 7, 9][index]; lamp += 1) {
      const now = state.startedAt + (lamp === [4, 6, 8][index] ? campaign[index].duration - 12999 : lamp * 240);
      state = gameKey(state, 'keydown', 'ArrowRight', now, false, campaign);
      state = gameKey(state, 'keyup', 'ArrowRight', now, false, campaign);
    }
    assert.equal(state.status, index === 2 ? 'final' : 'cleared');
    assert.deepEqual(hudValues(state), { time: 13, score: [620, 1440, 2460][index], remaining: 0 });
    assert.equal(gameTick(state, state.finishedAt + 100000, campaign), state);
    if (index < 2) {
      const next = gameKey(state, 'keydown', 'Enter', state.finishedAt + 100000, false, campaign);
      assert.equal(next.score, [620, 1440][index]);
      state = next;
    }
  }
  assert.equal(state.status, 'final');
  assert.equal(state.levelIndex, 2);
});

test('AC-38/36: later-level failure resets to level one and a late Enter cannot skip its result', () => {
  for (const index of [1, 2]) {
    const playing = createGameState(levels, 10000, index, 620);
    const now = 10000 + [60000, 75000, 90000][index];
    const failed = gameKey(playing, 'keydown', 'Enter', now + 1);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.finishedAt, now);
    assert.equal(failed.score, 620);
    assert.equal(gameKey(failed, 'keydown', 'Enter', now + 2, true).status, 'failed');
    const title = gameKey(gameKey(failed, 'keyup', 'Enter', now + 3), 'keydown', 'Enter', now + 4);
    assert.equal(title.status, 'title');
    assert.equal(title.levelIndex, 0);
    assert.equal(title.score, 0);
    assert.equal(gameKey(title, 'keydown', 'Enter', now + 5).status, 'title');
    const restarted = gameKey(gameKey(title, 'keyup', 'Enter', now + 6), 'keydown', 'Enter', now + 7);
    assert.equal(restarted.levelIndex, 0);
    assert.deepEqual(hudValues(restarted), { time: 60, score: 0, remaining: 5 });
    assert.equal(restarted.animation, null);
    assert.deepEqual(restarted.pressed, []);
  }
});

test('AC-38: exact 75/90-second final light loses to timeout and cannot earn new points', () => {
  for (const duration of [75000, 90000]) {
    const campaign = [{ map: ['PLL'], duration }];
    let state = createGameState(campaign, 10000, 0, 620);
    state = gameKey(state, 'keydown', 'ArrowRight', 10000, false, campaign);
    state = gameKey(state, 'keyup', 'ArrowRight', 10000, false, campaign);
    assert.equal(state.score, 720);
    const exact = gameKey(state, 'keydown', 'ArrowRight', 10000 + duration, false, campaign);
    assert.equal(exact.failureReason, 'timeout');
    assert.equal(hudValues(exact).remaining, 0);
    assert.equal(exact.score, 720);
    const late = gameKey(state, 'keydown', 'ArrowRight', 10000 + duration + 1, false, campaign);
    assert.equal(hudValues(late).remaining, 1);
    assert.equal(late.finishedAt, 10000 + duration);
    assert.equal(late.score, 720);
  }
});

function fakeAudioContext(state = 'running') {
  const context = { state, currentTime: 10, destination: {}, gains: [], oscillators: [], resumes: 0 };
  context.createGain = () => {
    const node = {
      gain: {
        value: 1, events: [],
        setValueAtTime(value, at) { this.events.push(['set', value, at]); },
        linearRampToValueAtTime(value, at) { this.events.push(['ramp', value, at]); },
      },
      connect(target) { this.target = target; },
      disconnect() { this.disconnected = true; },
    };
    context.gains.push(node);
    return node;
  };
  context.createOscillator = () => {
    const node = {
      frequency: { events: [], setValueAtTime(value, at) { this.events.push([value, at]); } },
      starts: [], stops: [],
      connect(target) { this.target = target; },
      disconnect() { this.disconnected = true; },
      start(at) { this.starts.push(at); },
      stop(at) { this.stops.push(at); },
    };
    context.oscillators.push(node);
    return node;
  };
  context.resume = async () => { context.resumes += 1; context.state = 'running'; };
  return context;
}

test('AC-43: four synthesized sounds use the chapter 7 wave, frequencies, attack and durations', () => {
  for (const [name, wave, frequencies, duration] of [
    ['lantern', 'sine', [880], 0.08], ['cleared', 'sine', [660, 880], 0.08],
    ['failed', 'triangle', [220, 110], 0.1], ['final', 'sine', [660, 880, 1100], 0.1],
  ]) {
    const context = fakeAudioContext();
    let creations = 0;
    const audio = createAudio(() => { creations += 1; return context; });
    audio.play(name);
    assert.equal(creations, 0, 'No AudioContext before the actual gesture boundary unlocks it');
    audio.unlock();
    audio.unlock();
    assert.equal(creations, 1);
    audio.play(name);
    assert.equal(context.gains[0].gain.value, 0.10);
    assert.equal(context.gains[0].target, context.destination);
    assert.equal(context.oscillators.length, frequencies.length);
    for (const [index, oscillator] of context.oscillators.entries()) {
      const at = 10 + index * duration;
      assert.equal(oscillator.type, wave);
      assert.deepEqual(oscillator.frequency.events, [[frequencies[index], at]]);
      assert.deepEqual(oscillator.starts, [at]);
      assert.deepEqual(oscillator.stops, [at + duration]);
      const gain = context.gains[index + 1];
      assert.equal(oscillator.target, gain);
      assert.equal(gain.target, context.gains[0]);
      assert.deepEqual(gain.gain.events, [['set', 0, at], ['ramp', 1, at + 0.005], ['ramp', 0, at + duration]]);
      oscillator.onended();
      assert.equal(oscillator.disconnected, true);
      assert.equal(gain.disconnected, true);
    }
    assert.ok(Math.abs(context.oscillators.at(-1).stops[0] - (10 + frequencies.length * duration)) < 1e-10);
  }
});

test('AC-44: replacing a sound cancels every old voice and suspension cannot queue stale audio', () => {
  const context = fakeAudioContext();
  const audio = createAudio(() => context);
  audio.unlock();
  audio.play('final');
  const old = [...context.oscillators];
  audio.play('lantern');
  assert.ok(old.every((node) => node.stops.length === 2 && node.disconnected));
  const current = context.oscillators.at(-1);
  old.forEach((node) => node.onended());
  context.state = 'suspended';
  context.onstatechange();
  assert.equal(current.disconnected, true);
  assert.equal(current.stops.length, 2);
  audio.play('failed');
  assert.equal(context.oscillators.length, 4);
  context.state = 'running';
  context.onstatechange();
  assert.equal(context.oscillators.length, 4, 'Resuming must not replay a dropped sound');
  audio.play('failed');
  assert.equal(context.oscillators.length, 6);
});

test('AC-43/44: unavailable, rejected or still-pending audio never queues or throws into gameplay', async () => {
  const missing = createAudio(() => { throw new Error('unsupported'); });
  assert.doesNotThrow(() => { missing.play('failed'); missing.unlock(); missing.play('final'); });
  const context = fakeAudioContext('suspended');
  context.resume = () => { context.resumes += 1; return Promise.reject(new Error('denied')); };
  const audio = createAudio(() => context);
  audio.unlock();
  audio.unlock();
  audio.play('final');
  assert.equal(context.resumes, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(context.oscillators.length, 0);
  context.resume = async () => { context.resumes += 1; context.state = 'running'; };
  audio.unlock();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(context.resumes, 2);
  assert.equal(context.oscillators.length, 0);
  audio.play('lantern');
  assert.equal(context.oscillators.length, 1);
  context.createOscillator = () => { throw new Error('audio creation failure'); };
  assert.doesNotThrow(() => audio.play('failed'));
  assert.ok(context.gains.slice(1).every((node) => node.disconnected));
});

test('AC-45/47: only canonical decimal best scores from 0 through the documented 4350 bound load', () => {
  for (const value of [null, '', ' ', '-1', '1.5', 'NaN', 'Infinity', '{}', '1e3', '01', '+100', '4351', '9007199254740992']) {
    let reads = 0;
    const store = createBestScoreStore(() => ({ getItem(key) { reads += 1; assert.equal(key, 'dotgame.bestScore'); return value; }, setItem() { assert.fail('No write on startup'); } }));
    assert.equal(store.value, 0);
    assert.equal(store.value, 0);
    assert.equal(reads, 1);
  }
  for (const value of ['0', '620', '1440', '2460', '4350']) {
    const store = createBestScoreStore(() => ({ getItem: () => value }));
    assert.equal(store.value, Number(value));
  }
});

test('AC-45/46: one key, startup read once, strictly higher writes only and reload reads the durable best', () => {
  const data = new Map();
  const writes = [];
  let reads = 0;
  const storage = {
    getItem(key) { reads += 1; return data.get(key) ?? null; },
    setItem(key, value) { writes.push([key, value]); data.set(key, value); },
  };
  const store = createBestScoreStore(() => storage);
  assert.equal(store.record(620), 620);
  assert.equal(store.record(620), 620);
  assert.equal(store.record(100), 620);
  assert.equal(store.record(2460), 2460);
  assert.deepEqual(writes, [['dotgame.bestScore', '620'], ['dotgame.bestScore', '2460']]);
  assert.equal(reads, 1);
  assert.equal(data.size, 1);
  const loaded = createBestScoreStore(() => storage);
  assert.equal(loaded.value, 2460);
  assert.equal(reads, 2);
  assert.deepEqual(gameScreenLines(createGameTitle(levels), loaded.value), ['폭풍 전의 등불', 'ENTER로 시작', '최고 점수 2460']);
});

test('AC-47: storage getter/read/write exceptions preserve tab best without repeat retries', () => {
  for (const getStorage of [() => { throw new Error('SecurityError'); }, () => ({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } })]) {
    const store = createBestScoreStore(getStorage);
    assert.equal(store.value, 0);
    assert.equal(store.record(100), 100);
  }
  let attempts = 0;
  const storage = { getItem: () => '620', setItem() { attempts += 1; throw new Error('QuotaExceededError'); } };
  const store = createBestScoreStore(() => storage);
  assert.equal(store.record(1440), 1440);
  assert.equal(store.record(1440), 1440);
  assert.equal(store.record(620), 1440);
  assert.equal(attempts, 1);
  assert.equal(store.record(2460), 2460);
  assert.equal(attempts, 2);
  assert.equal(createBestScoreStore(() => storage).value, 620, 'Failed writes cannot survive reload');
});

test('AC-43/44/46: terminal effects beat last-light sound and middle clears never save', () => {
  const campaign = [{ map: ['PLL'], duration: 60000 }, { map: ['PL'], duration: 75000 }];
  let state = createGameState(campaign);
  const first = gameKey(state, 'keydown', 'ArrowRight', 0, false, campaign);
  assert.deepEqual(transitionEffects(state, first), { sound: 'lantern', recordScore: null });
  state = gameKey(first, 'keyup', 'ArrowRight', 0, false, campaign);
  assert.deepEqual(transitionEffects(first, state), { sound: null, recordScore: null });
  const cleared = gameKey(state, 'keydown', 'ArrowRight', 120, false, campaign);
  assert.equal(cleared.status, 'cleared');
  assert.deepEqual(transitionEffects(state, cleared), { sound: 'cleared', recordScore: null });
  const finalStart = createGameState(campaign, 10000, 1, 620);
  const final = gameKey(finalStart, 'keydown', 'ArrowRight', 72001, false, campaign);
  assert.deepEqual(transitionEffects(finalStart, final), { sound: 'final', recordScore: 840 });
  assert.deepEqual(transitionEffects(final, gameTick(final, 999999, campaign)), { sound: null, recordScore: null });
  const timedStart = createGameState(campaign, 10000, 1, 620);
  const failed = gameKey(timedStart, 'keydown', 'ArrowRight', 85000, false, campaign);
  assert.equal(failed.failureReason, 'timeout');
  assert.equal(hudValues(failed).remaining, 0);
  assert.deepEqual(transitionEffects(timedStart, failed), { sound: 'failed', recordScore: 620 });
});

test('AC-44/46: a late keyup discovers one 75-second failure sound/write and no successor repeats it', () => {
  const context = fakeAudioContext();
  const audio = createAudio(() => context);
  audio.unlock();
  const writes = [];
  const store = createBestScoreStore(() => ({ getItem: () => null, setItem: (...args) => writes.push(args) }));
  let state = createGameState(levels, 10000, 1, 100);
  function dispatch(event, now) {
    const previous = state;
    state = transitionGame(state, event, levels, now);
    const effects = transitionEffects(previous, state);
    if (effects.recordScore !== null) store.record(effects.recordScore);
    if (effects.sound !== null) audio.play(effects.sound);
  }
  dispatch({ type: 'keyup', key: 'ArrowRight' }, 85001);
  assert.equal(state.finishedAt, 85000);
  assert.equal(state.failureReason, 'timeout');
  assert.equal(context.oscillators.length, 2);
  assert.deepEqual(context.oscillators.map((node) => node.frequency.events[0][0]), [220, 110]);
  assert.deepEqual(writes, [['dotgame.bestScore', '100']]);
  for (const event of [{ type: 'tick' }, { type: 'keyup', key: 'ArrowRight' }, { type: 'keydown', key: 'Enter' }, { type: 'keydown', key: 'Enter', repeat: true }, { type: 'blur' }]) dispatch(event, 85002);
  assert.equal(context.oscillators.length, 2);
  assert.equal(writes.length, 1);
  assert.equal(store.value, 100);
});
