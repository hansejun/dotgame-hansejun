const directions = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

export const moveDuration = 120;
export const ghostInterval = 400;
export const timeLimit = 60000;
export const lanternScore = 100;
export const bonusPerSecond = 10;

const ghostLetters = ['a', 'b', 'c'];

const sameCell = (a, b) => a.x === b.x && a.y === b.y;
const cellKey = ({ x, y }) => `${x},${y}`;

// 격자를 행 순서로 읽으므로 가로 경로는 맨 왼쪽, 세로 경로는 맨 위 칸이 path[0]이 된다
function findGhosts(map) {
  const ghosts = [];
  for (const letter of ghostLetters) {
    const path = [];
    for (let y = 0; y < map.length; y += 1) {
      for (let x = 0; x < map[y].length; x += 1) {
        if (map[y][x] === letter) path.push({ x, y });
      }
    }
    if (path.length > 0) ghosts.push({ path, index: 0, step: 1 });
  }
  return ghosts;
}

export function createState(map, now = 0) {
  for (let y = 0; y < map.length; y += 1) {
    const x = map[y].indexOf('P');
    if (x !== -1) {
      return {
        position: { x, y },
        pressed: [],
        animation: null,
        startedAt: now,
        ghosts: findGhosts(map),
        ghostTicks: 0,
        lit: [],
        lanternCount: [...map.join('')].filter((cell) => cell === 'L').length,
        score: 0,
        status: 'playing',
        failReason: null,
        endedAt: null,
      };
    }
  }
  throw new Error('Map requires a player start');
}

export function isPassable(map, x, y) {
  return y >= 0 && y < map.length && x >= 0 && x < map[y].length && map[y][x] !== '#';
}

export function isMoving(state, now) {
  return state.animation !== null && now - state.animation.startedAt < moveDuration;
}

export function ghostCell(ghost) {
  return ghost.path[ghost.index];
}

// 끝 칸에 도착하면 방향만 바꾸고, 다음 기한에 반대쪽 인접 칸으로 간다
function moveGhost(ghost) {
  if (ghost.path.length === 1) return ghost;
  const index = ghost.index + ghost.step;
  const atEnd = index === 0 || index === ghost.path.length - 1;
  return { ...ghost, index, step: atEnd ? -ghost.step : ghost.step };
}

export function remainingLanterns(state) {
  return state.lanternCount - state.lit.length;
}

export function isLit(state, x, y) {
  return state.lit.includes(cellKey({ x, y }));
}

export function remainingMs(state, now) {
  const at = state.endedAt ?? now;
  return Math.max(0, timeLimit - (at - state.startedAt));
}

export function hudSeconds(state, now) {
  return Math.ceil(remainingMs(state, now) / 1000);
}

// 시각 t의 갱신 1회. 유령 기한·입력 이동·시간 소진을 함께 판정하고 실패를 클리어보다 우선한다
function step(state, map, t, target) {
  const ghostDue = t === state.startedAt + ghostInterval * (state.ghostTicks + 1);
  const ghosts = ghostDue ? state.ghosts.map(moveGhost) : state.ghosts;
  const before = state.position;
  const position = target ?? before;
  const collided = ghosts.some((ghost, i) => sameCell(ghostCell(ghost), position)
    || (sameCell(ghostCell(state.ghosts[i]), position) && sameCell(ghostCell(ghost), before)));
  const timeUp = t - state.startedAt >= timeLimit;
  const failed = collided || timeUp;
  const key = cellKey(position);
  const newlyLit = map[position.y][position.x] === 'L' && !state.lit.includes(key);
  const lit = newlyLit ? [...state.lit, key] : state.lit;
  let score = state.score + (newlyLit && !failed ? lanternScore : 0);
  const cleared = !failed && newlyLit && lit.length === state.lanternCount;
  if (cleared) {
    score += Math.floor((timeLimit - (t - state.startedAt)) / 1000) * bonusPerSecond;
  }
  let status = state.status;
  if (failed) status = 'failed';
  else if (cleared) status = 'cleared';
  return {
    ...state,
    position,
    animation: target ? { from: before, to: position, startedAt: t } : state.animation,
    ghosts,
    ghostTicks: ghostDue ? state.ghostTicks + 1 : state.ghostTicks,
    lit,
    score,
    status,
    failReason: failed ? (collided ? 'ghost' : 'time') : null,
    endedAt: status === 'playing' ? null : t,
  };
}

// now 이전(inclusive면 now 포함)의 미처리 기한을 시간순으로 처리하고 최초 terminal에서 멈춘다
function advance(state, map, now, inclusive) {
  let current = state;
  while (current.status === 'playing') {
    const nextGhost = current.startedAt + ghostInterval * (current.ghostTicks + 1);
    const t = Math.min(nextGhost, current.startedAt + timeLimit);
    if (t > now || (t === now && !inclusive)) break;
    current = step(current, map, t, null);
  }
  return current;
}

export function tick(state, map, now) {
  return advance(state, map, now, true);
}

export function transition(state, event, map, now) {
  if (event.type === 'blur') return { ...state, pressed: [] };
  if (!Object.hasOwn(directions, event.key)) return state;
  if (event.type === 'keyup') {
    return { ...state, pressed: state.pressed.filter((key) => key !== event.key) };
  }
  if (event.type !== 'keydown') return state;
  const wasPressed = state.pressed.includes(event.key);
  const pressed = wasPressed ? state.pressed : [...state.pressed, event.key];
  const next = { ...advance(state, map, now, false), pressed };
  if (next.status !== 'playing' || wasPressed || event.repeat || isMoving(next, now)) {
    return tick(next, map, now);
  }
  const [dx, dy] = directions[event.key];
  const position = { x: next.position.x + dx, y: next.position.y + dy };
  if (!isPassable(map, position.x, position.y)) return tick(next, map, now);
  return step(next, map, now, position);
}

export function displayPosition(state, now) {
  if (!state.animation) return { ...state.position };
  const { from, to, startedAt } = state.animation;
  const progress = Math.max(0, Math.min(1, (now - startedAt) / moveDuration));
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}
