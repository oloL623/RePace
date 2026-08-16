const COMPARISON_TIME_THRESHOLD_SECONDS = 1;
const NATURAL_KOREAN_VOICE_KEYWORDS = [
  "natural",
  "google",
  "siri",
  "yuna",
  "sunhi",
  "injun",
  "heami",
];

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

// 기기마다 음성 이름이 달라 자연음 계열을 우선 찾고, 없으면 첫 한국어 음성을 사용한다.
export function selectPreferredKoreanVoice(voices = []) {
  const koreanVoices = voices.filter((voice) =>
    voice.lang?.toLowerCase().startsWith("ko")
  );

  return NATURAL_KOREAN_VOICE_KEYWORDS.reduce(
    (selectedVoice, keyword) =>
      selectedVoice ??
      koreanVoices.find((voice) => voice.name.toLowerCase().includes(keyword)),
    null
  ) ?? koreanVoices[0] ?? null;
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

// 양수는 같은 지점에 지난번보다 빨리 도착했고, 음수는 늦게 도착했다는 뜻이다.
export function getTimeComparisonState(timeDifference) {
  if (!isFiniteNumber(timeDifference)) {
    return "unavailable";
  }

  if (timeDifference > COMPARISON_TIME_THRESHOLD_SECONDS) {
    return "ahead";
  }

  if (timeDifference < -COMPARISON_TIME_THRESHOLD_SECONDS) {
    return "behind";
  }

  return "even";
}

export function createComparisonCoachMessage(comparison) {
  const timeDifference = comparison?.timeDifference;
  const state = getTimeComparisonState(timeDifference);

  if (state === "unavailable") {
    return "";
  }

  if (state === "ahead") {
    return `좋아요! 같은 지점에서 지난번보다 ${formatDurationForSpeech(timeDifference)} 빨라요. 지금 리듬 그대로 가면 지난 기록을 앞설 수 있어요.`;
  }

  if (state === "behind") {
    return `같은 지점에서 지난번보다 ${formatDurationForSpeech(Math.abs(timeDifference))} 늦어요. 무리하지 말고, 호흡을 유지하면서 조금씩 속도를 올려 볼게요.`;
  }

  return "지난번과 거의 같은 페이스예요. 지금 리듬 그대로 유지해 볼게요.";
}

export function createProgressCoachMessage({
  elapsedSeconds,
  distance,
  currentPace,
  averagePace,
  comparison,
}) {
  if (!isFiniteNumber(distance) || distance < 3) {
    return `${formatDurationForSpeech(elapsedSeconds)} 동안 달리고 있어요. 아직 이동 경로가 잡히지 않았으니 GPS 상태를 확인해 주세요.`;
  }

  const pace = formatPaceForSpeech(currentPace ?? averagePace);
  const messages = [
    `지금까지 ${formatDurationForSpeech(elapsedSeconds)} 동안 ${formatDistanceForSpeech(distance)} 달렸어요`,
  ];

  if (pace) {
    messages.push(`페이스는 킬로미터당 ${pace}예요`);
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
    `${completedKilometers} 킬로미터 지점을 지났어요`,
    `지금까지 ${formatDurationForSpeech(elapsedSeconds)} 달렸어요`,
  ];
  const pace = formatPaceForSpeech(averagePace);

  if (pace) {
    messages.push(`평균 페이스는 킬로미터당 ${pace}예요`);
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
    `총 ${formatDistanceForSpeech(distance)}를 ${formatDurationForSpeech(elapsedSeconds)} 동안 달렸어요`,
  ];
  const pace = formatPaceForSpeech(averagePace);

  if (pace) {
    messages.push(`평균 페이스는 킬로미터당 ${pace}예요`);
  }

  return messages.join(". ");
}
