const STORAGE_KEY = "currentRunPreferences";

export const DEFAULT_RUN_PREFERENCES = {
  targetDistanceKilometers: 5,
  targetPaceMinutes: 6,
  voiceCoachingEnabled: true,
};

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
