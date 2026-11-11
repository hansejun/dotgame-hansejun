export function hudText({ time, score, remaining }) {
  return `시간 ${time}   점수 ${score}   등불 ${remaining}`;
}

export function screenLines({ status, failureReason, score }) {
  if (status === 'title') return ['폭풍 전의 등불', 'ENTER로 시작'];
  if (status === 'cleared') return ['등불을 모두 켰다', `점수 ${score}`];
  if (status === 'failed') {
    const message = failureReason === 'timeout' ? '폭풍이 왔다' : '유령에게 잡혔다';
    return [message, `점수 ${score}`, 'ENTER로 타이틀'];
  }
  return [];
}
