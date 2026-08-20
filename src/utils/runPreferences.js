const STORAGE_KEY = "currentRunPreferences";

export const DEFAULT_RUN_PREFERENCES = {
  targetDistanceKilometers: 5,
  targetPaceMinutes: 6,
  voiceCoachingEnabled: true,
};

export function isValidTargetDistanceInput(value) {
  return typeof value === "string" && /^(?:\d{1,2}(?:\.\d{0,2})?)?$/.test(value);
}

export function parseTargetPaceMinutes(minutesInput, secondsInput) {
  if (!/^\d{1,2}$/.test(minutesInput) || !/^\d{1,2}$/.test(secondsInput)) {
    return null;
  }

  const minutes = Number(minutesInput);
  const seconds = Number(secondsInput);

  if (minutes <= 0 || seconds > 59) {
    return null;
  }

  return minutes + seconds / 60;
}

export function loadRunPreferences() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));

    return {
      ...DEFAULT_RUN_PREFERENCES,
      ...(saved && typeof saved === "object" ? saved : {}),
    };
  } catch (error) {
    console.error("러닝 준비 설정을 불러오지 못했습니다.", error);
    return { ...DEFAULT_RUN_PREFERENCES };
  }
}

export function saveRunPreferences(preferences) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
