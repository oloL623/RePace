const COMPARISON_DISTANCE_THRESHOLD_METERS = 20;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

// TTS가 소수점을 어색하게 읽지 않도록 거리를 킬로미터와 미터 단위로 나눈다.
export function formatDistanceForSpeech(distanceMeters) {
  const safeDistance = Math.max(
    0,
    isFiniteNumber(distanceMeters) ? Math.round(distanceMeters) : 0
  );
  const kilometers = Math.floor(safeDistance / 1000);
  const meters = safeDistance % 1000;

  if (kilometers === 0) {
    return `${meters} 미터`;
  }

  if (meters === 0) {
    return `${kilometers} 킬로미터`;
  }

  return `${kilometers} 킬로미터 ${meters} 미터`;
}

// 화면용 00:00 형식 대신 음성으로 자연스럽게 들리는 시간 문장을 만든다.
export function formatDurationForSpeech(totalSeconds) {
  const safeSeconds = Math.max(
    0,
    isFiniteNumber(totalSeconds) ? Math.round(totalSeconds) : 0
  );
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}시간`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}분`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}초`);
  }

  return parts.join(" ");
}

export function formatPaceForSpeech(pace) {
  if (!isFiniteNumber(pace) || pace <= 0) {
    return null;
  }

  let minutes = Math.floor(pace);
  let seconds = Math.round((pace - minutes) * 60);

  if (seconds === 60) {
    minutes += 1;
    seconds = 0;
  }

  return `${minutes}분 ${seconds}초`;
}

export function getComparisonState(distanceDifference) {
  if (!isFiniteNumber(distanceDifference)) {
    return "unavailable";
  }

  if (distanceDifference > COMPARISON_DISTANCE_THRESHOLD_METERS) {
    return "ahead";
  }

  if (distanceDifference < -COMPARISON_DISTANCE_THRESHOLD_METERS) {
    return "behind";
  }

  return "even";
}

export function createComparisonCoachMessage(comparison) {
  const difference = comparison?.distanceDifference;
  const state = getComparisonState(difference);

  if (state === "unavailable") {
    return "";
  }

  if (state === "ahead") {
    return `좋습니다. 과거의 나보다 ${Math.round(difference)} 미터 앞서고 있습니다.`;
  }

  if (state === "behind") {
    return `과거의 나보다 ${Math.abs(Math.round(difference))} 미터 뒤에 있습니다. 무리하지 말고 호흡과 리듬을 유지하세요.`;
  }

  return "과거의 나와 비슷한 거리입니다. 현재 리듬을 유지하세요.";
}

export function createProgressCoachMessage({
  elapsedSeconds,
  distance,
  currentPace,
  averagePace,
  comparison,
}) {
  if (!isFiniteNumber(distance) || distance < 3) {
    return `현재 경과 시간은 ${formatDurationForSpeech(elapsedSeconds)}입니다. 아직 이동 경로가 기록되지 않았습니다. GPS 상태를 확인해 주세요.`;
  }

  const pace = formatPaceForSpeech(currentPace ?? averagePace);
  const messages = [
    `현재 경과 시간은 ${formatDurationForSpeech(elapsedSeconds)}입니다`,
    `현재 이동 거리는 ${formatDistanceForSpeech(distance)}입니다`,
  ];

  if (pace) {
    messages.push(`현재 페이스는 킬로미터당 ${pace}입니다`);
  }

  const comparisonMessage = createComparisonCoachMessage(comparison);

  if (comparisonMessage) {
    messages.push(comparisonMessage);
  }

  return messages.join(". ");
}

export function createKilometerCoachMessage({
  completedKilometers,
  elapsedSeconds,
  averagePace,
  comparison,
}) {
  const messages = [
    `${completedKilometers} 킬로미터를 통과했습니다`,
    `경과 시간은 ${formatDurationForSpeech(elapsedSeconds)}입니다`,
  ];
  const pace = formatPaceForSpeech(averagePace);

  if (pace) {
    messages.push(`평균 페이스는 킬로미터당 ${pace}입니다`);
  }

  const comparisonMessage = createComparisonCoachMessage(comparison);

  if (comparisonMessage) {
    messages.push(comparisonMessage);
  }

  return messages.join(". ");
}

export function createFinishCoachMessage({
  elapsedSeconds,
  distance,
  averagePace,
}) {
  const messages = [
    "러닝을 종료합니다",
    `총 거리는 ${formatDistanceForSpeech(distance)}입니다`,
    `총 시간은 ${formatDurationForSpeech(elapsedSeconds)}입니다`,
  ];
  const pace = formatPaceForSpeech(averagePace);

  if (pace) {
    messages.push(`평균 페이스는 킬로미터당 ${pace}입니다`);
  }

  messages.push("수고하셨습니다.");

  return messages.join(". ");
}
