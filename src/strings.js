export function hudText({ time, score, remaining }) {
  return `시간 ${time}   점수 ${score}   등불 ${remaining}`;
}

export function screenLines({ status, failureReason, score }, bestScore) {
  if (status === 'title') return ['폭풍 전의 등불', 'ENTER로 시작', `최고 점수 ${bestScore}`];
  if (status === 'cleared') {
    return ['등불을 모두 켰다', `점수 ${score}`, 'ENTER로 다음 레벨'];
  }
  if (status === 'final') return ['모든 등불을 켰다', `점수 ${score}`, `최고 점수 ${bestScore}`, 'ENTER로 타이틀'];
  if (status === 'failed') {
    const message = failureReason === 'timeout' ? '폭풍이 왔다' : '유령에게 잡혔다';
    return [message, `점수 ${score}`, 'ENTER로 타이틀'];
  }
  return [];
}
