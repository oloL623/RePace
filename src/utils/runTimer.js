// 일시정지 중인 시간을 제외한 실제 러닝 시간을 초 단위로 계산한다.
export function calculateActiveElapsedSeconds({
  startTime,
  currentTime,
  totalPausedMilliseconds = 0,
  pausedAt = null,
}) {
  const currentPauseMilliseconds =
    Number.isFinite(pausedAt) && currentTime > pausedAt
      ? currentTime - pausedAt
      : 0;
  const activeMilliseconds = Math.max(
    0,
    currentTime -
      startTime -
      totalPausedMilliseconds -
      currentPauseMilliseconds
  );

  return Math.floor(activeMilliseconds / 1000);
}
