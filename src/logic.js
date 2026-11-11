const directions = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

export const moveDuration = 120;
export const ghostInterval = 400;
export const levelDuration = 60000;

const sameCell = (a, b) => a.x === b.x && a.y === b.y;

export function createState(map, now = 0) {
  const starts = [];
  const lanterns = [];
  const paths = new Map();
  if (!map.length || !map[0].length || map.some((row) => row.length !== map[0].length || /[^#.PLa-c]/.test(row))) {
    throw new Error('Map requires rectangular rows and known tiles');
  }
  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[y].length; x += 1) {
      const tile = map[y][x];
      if (tile === 'P') starts.push({ x, y });
      if (tile === 'L') lanterns.push({ x, y, lit: false });
      if ('abc'.includes(tile)) {
        if (!paths.has(tile)) paths.set(tile, []);
        paths.get(tile).push({ x, y });
      }
    }
  }
  if (starts.length !== 1) throw new Error('Map requires a unique player start');
  const ghosts = [...paths.values()].map((path) => {
    const horizontal = path.every((cell) => cell.y === path[0].y);
    const vertical = path.every((cell) => cell.x === path[0].x);
    if (path.length < 2 || (!horizontal && !vertical)
      || path.some((cell, index) => index > 0
        && Math.abs(cell.x - path[index - 1].x) + Math.abs(cell.y - path[index - 1].y) !== 1)) {
      throw new Error('Ghost path requires a continuous straight line of at least two cells');
    }
    return { path, index: 0, direction: 1, position: path[0] };
  });
  return {
    position: starts[0], pressed: [], animation: null,
    lanterns, ghosts, score: 0, remainingMs: levelDuration,
    status: 'playing', failureReason: null,
    startedAt: now, updatedAt: now,
    nextGhostAt: ghosts.length ? now + ghostInterval : Infinity,
    finishedAt: null,
  };
}

export function isPassable(map, x, y) {
  return y >= 0 && y < map.length && x >= 0 && x < map[y].length
    && '.PLabc'.includes(map[y][x]);
}

export function isMoving(state, now) {
  return state.status === 'playing' && state.animation !== null
    && now - state.animation.startedAt < moveDuration;
}

function movePlayer(state, event, map, now) {
  if (event.type === 'blur') return { ...state, pressed: [] };
  if (!Object.hasOwn(directions, event.key)) return state;
  if (event.type === 'keyup') {
    return { ...state, pressed: state.pressed.filter((key) => key !== event.key) };
  }
  if (event.type !== 'keydown') return state;
  const wasPressed = state.pressed.includes(event.key);
  const next = wasPressed ? state : { ...state, pressed: [...state.pressed, event.key] };
  if (wasPressed || event.repeat || isMoving(state, now)) return next;
  const [dx, dy] = directions[event.key];
  const position = { x: state.position.x + dx, y: state.position.y + dy };
  if (!isPassable(map, position.x, position.y)) return next;
  return {
    ...next,
    position,
    animation: { from: state.position, to: position, startedAt: now },
  };
}

function update(state, event, map, now) {
  const moved = movePlayer(state, event, map, now);
  const ghostDue = state.nextGhostAt === now;
  const ghosts = ghostDue ? state.ghosts.map((ghost) => {
    const index = ghost.index + ghost.direction;
    const direction = index === 0 ? 1 : index === ghost.path.length - 1 ? -1 : ghost.direction;
    return { ...ghost, index, direction, position: ghost.path[index] };
  }) : state.ghosts;
  let newLights = 0;
  const lanterns = moved.lanterns.map((lantern) => {
    if (lantern.lit || !sameCell(lantern, moved.position)) return lantern;
    newLights += 1;
    return { ...lantern, lit: true };
  });
  const remainingMs = Math.max(0, levelDuration - (now - state.startedAt));
  const collision = ghosts.some((ghost, index) => sameCell(ghost.position, moved.position)
    || (sameCell(state.position, ghost.position)
      && sameCell(moved.position, state.ghosts[index].position)));
  const failureReason = remainingMs === 0 ? 'timeout' : collision ? 'collision' : null;
  const cleared = !failureReason && lanterns.length > 0 && lanterns.every((lantern) => lantern.lit);
  return {
    ...moved, ghosts, lanterns, remainingMs,
    nextGhostAt: ghostDue ? state.nextGhostAt + ghostInterval : state.nextGhostAt,
    score: state.score + (failureReason ? 0 : newLights * 100)
      + (cleared ? Math.floor(remainingMs / 1000) * 10 : 0),
    status: failureReason ? 'failed' : cleared ? 'cleared' : 'playing',
    failureReason,
    updatedAt: now,
    finishedAt: failureReason || cleared ? now : null,
  };
}

export function transition(state, event, map, now) {
  if (state.status !== 'playing') return state;
  if (event.type !== 'tick' && event.type !== 'blur'
    && !((event.type === 'keydown' || event.type === 'keyup') && Object.hasOwn(directions, event.key))) return state;
  if (now < state.updatedAt) throw new Error('Time must not move backwards');
  let next = state;
  let due = Math.min(next.nextGhostAt, next.startedAt + levelDuration);
  while (due < now) {
    next = update(next, { type: 'tick' }, map, due);
    if (next.status !== 'playing') return next;
    due = Math.min(next.nextGhostAt, next.startedAt + levelDuration);
  }
  return update(next, event, map, now);
}

export function hudValues(state) {
  return {
    time: Math.ceil(state.remainingMs / 1000),
    score: state.score,
    remaining: state.lanterns.filter((lantern) => !lantern.lit).length,
  };
}

export function displayPosition(state, now) {
  if (!state.animation || state.status !== 'playing') return { ...state.position };
  const { from, to, startedAt } = state.animation;
  const progress = Math.max(0, Math.min(1, (now - startedAt) / moveDuration));
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}
