const directions = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

export const moveDuration = 120;

export function createState(map) {
  for (let y = 0; y < map.length; y += 1) {
    const x = map[y].indexOf('P');
    if (x !== -1) {
      return { position: { x, y }, pressed: [], animation: null };
    }
  }
  throw new Error('Map requires a player start');
}

export function isPassable(map, x, y) {
  return y >= 0 && y < map.length && x >= 0 && x < map[y].length
    && (map[y][x] === '.' || map[y][x] === 'P');
}

export function isMoving(state, now) {
  return state.animation !== null && now - state.animation.startedAt < moveDuration;
}

export function transition(state, event, map, now) {
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

export function displayPosition(state, now) {
  if (!state.animation) return { ...state.position };
  const { from, to, startedAt } = state.animation;
  const progress = Math.max(0, Math.min(1, (now - startedAt) / moveDuration));
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}
