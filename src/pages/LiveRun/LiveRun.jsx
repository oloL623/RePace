import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import KakaoMap from "../../components/KakaoMap";
import { isBackendConfigured } from "../../api/apiClient";
import {
  finishServerRun,
  getServerRunFeedback,
  startServerRun,
} from "../../api/runs";
import {
  getAccessToken,
  isSupabaseConfigured,
} from "../../lib/supabase";
import {
  calculateDistanceMeters,
  calculatePacemakerComparison,
  calculateRollingPace,
  createPacemakerProfile,
} from "../../utils/pacemaker";
import {
  createComparisonCoachMessage,
  createFinishCoachMessage,
  createKilometerCoachMessage,
  createProgressCoachMessage,
  getTimeComparisonState,
  selectPreferredKoreanVoice,
} from "../../utils/voiceCoach";
import { createKilometerSplits } from "../../utils/runSplits";
import { loadRunPreferences } from "../../utils/runPreferences";
import { calculateActiveElapsedSeconds } from "../../utils/runTimer";
import "./LiveRun.css";

const MIN_MOVEMENT_METERS = 3;
const MAX_GPS_ACCURACY_METERS = 1000;
const MAX_RUNNING_SPEED_METERS_PER_SECOND = 12;
const VOICE_PROGRESS_INTERVAL_SECONDS = 5 * 60;
const COMPARISON_ANNOUNCEMENT_COOLDOWN_SECONDS = 60;
const COACH_AUDIO_BASE_PATH = "/audio/voice-coach";
const FIXED_COACH_AUDIO = {
  startPacer: {
    fileName: "coach_start_pacer.mp3",
    message: "좋아요, 음성 코칭을 시작할게요. 지난 기록과 비교하면서 안내해 드릴게요. 주변을 살피며 안전하게 달려요.",
  },
  startFree: {
    fileName: "coach_start_free.mp3",
    message: "좋아요, 음성 코칭을 시작할게요. 거리와 페이스를 안내해 드릴게요. 주변을 살피며 안전하게 달려요.",
  },
  pause: {
    fileName: "coach_pause.mp3",
    message: "러닝을 잠시 멈췄어요. 준비되면 다시 시작해 주세요.",
  },
  resume: {
    fileName: "coach_resume.mp3",
    message: "좋아요, 다시 달려볼게요.",
  },
  offCourse: {
    fileName: "coach_off_course.mp3",
    message: "코스에서 벗어났어요. 주변을 살피고 지도를 확인해 주세요.",
  },
  backOnCourse: {
    fileName: "coach_back_on_course.mp3",
    message: "코스로 돌아왔어요. 계속 달려볼게요.",
  },
  samePace: {
    fileName: "coach_same_pace.mp3",
    message: "지난번과 거의 같은 페이스예요. 지금 리듬 그대로 유지해 주세요.",
  },
  gpsUnstable: {
    fileName: "coach_gps_unstable.mp3",
    message: "GPS 신호가 불안정해요. 잠시 후 위치를 다시 확인할게요.",
  },
  gpsRecovered: {
    fileName: "coach_gps_recovered.mp3",
    message: "GPS 연결이 안정됐어요. 경로 기록을 계속할게요.",
  },
  finishIntro: {
    fileName: "coach_finish_intro.mp3",
    message: "오늘 러닝을 마쳤어요.",
  },
  finishOutro: {
    fileName: "coach_finish_outro.mp3",
    message: "오늘도 정말 수고 많았어요. 천천히 걸으면서 호흡을 정리해 주세요.",
  },
};

function isSpeechSynthesisSupported() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

function isCoachAudioSupported() {
  return typeof window !== "undefined" && "Audio" in window;
}

function formatElapsedTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

// 러닝 페이스의 소수는 10진수가 아니라 60초 단위로 바꿔 표시한다.
function formatPace(pace) {
  if (!Number.isFinite(pace)) {
    return "-";
  }

  let minutes = Math.floor(pace);
  let seconds = Math.round((pace - minutes) * 60);

  if (seconds === 60) {
    minutes += 1;
    seconds = 0;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")} 분/km`;
}

function formatTimeDifference(seconds) {
  const absoluteSeconds = Math.abs(Math.round(seconds));
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = absoluteSeconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}초`;
  }

  return `${minutes}분 ${remainingSeconds}초`;
}

function getInitialGpsStatus() {
  return typeof navigator !== "undefined" && navigator.geolocation
    ? "GPS 연결 시도 중..."
    : "이 브라우저는 GPS를 지원하지 않습니다.";
}

function loadSelectedPacer() {
  const savedPacer = localStorage.getItem("selectedPacerRecord");

  if (!savedPacer) {
    return null;
  }

  try {
    return JSON.parse(savedPacer);
  } catch (error) {
    console.error("과거 러닝 기록을 불러오지 못했습니다.", error);
    return null;
  }
}

function loadRunningRecords() {
  try {
    const records = JSON.parse(
      localStorage.getItem("runningRecords")
    );

    return Array.isArray(records) ? records : [];
  } catch (error) {
    console.error("저장된 러닝 기록을 불러오지 못했습니다.", error);
    return [];
  }
}

function updateRunningRecord(recordId, changes) {
  const records = loadRunningRecords();
  const nextRecords = records.map((record) =>
    record.id === recordId ? { ...record, ...changes } : record
  );

  localStorage.setItem("runningRecords", JSON.stringify(nextRecords));
}

function calculateAveragePace(distance, elapsedSeconds) {
  if (distance < 100 || elapsedSeconds <= 0) {
    return null;
  }

  return (elapsedSeconds / 60) / (distance / 1000);
}

function getGpsErrorMessage(error) {
  const messages = {
    1: "위치 권한이 거부되었습니다.",
    2: "현재 위치를 가져올 수 없습니다.",
    3: "GPS 요청 시간이 초과되었습니다.",
  };

  return messages[error.code] ?? error.message;
}

function LiveRun() {
  const navigate = useNavigate();
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    speed: null,
    accuracy: null,
  });
  const [distance, setDistance] = useState(0);
  const [averagePace, setAveragePace] = useState(null);
  const [gpsStatus, setGpsStatus] = useState(getInitialGpsStatus);
  const [selectedPacer] = useState(loadSelectedPacer);
  const [runPreferences] = useState(loadRunPreferences);
  const [path, setPath] = useState([]);
  const [isRunning, setIsRunning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime] = useState(Date.now);
  const [voiceCoachingEnabled, setVoiceCoachingEnabled] = useState(
    () => loadRunPreferences().voiceCoachingEnabled
  );
  const [lastVoiceCoachMessage, setLastVoiceCoachMessage] = useState("");
  const [serverStatus, setServerStatus] = useState(() =>
    isBackendConfigured && isSupabaseConfigured
      ? "서버 연결 확인 중..."
      : "로컬 기록 모드 (서버 환경변수 미설정)"
  );
  const [aiFeedback, setAiFeedback] = useState("");
  const [isSavingToServer, setIsSavingToServer] = useState(false);

  const lastAcceptedPosition = useRef(null);
  const totalDistance = useRef(0);
  const watchIdRef = useRef(null);
  const activeUtteranceRef = useRef(null);
  const activeCoachAudioRef = useRef(null);
  const preferredVoiceRef = useRef(null);
  const hasPlayedStartAudioRef = useRef(false);
  const lastProgressIntervalRef = useRef(0);
  const lastKilometerRef = useRef(0);
  const comparisonStateRef = useRef(null);
  const lastComparisonAnnouncementAtRef = useRef(0);
  const offCourseStateRef = useRef(false);
  const gpsUnstableStateRef = useRef(false);
  const runStartPromiseRef = useRef(null);
  const isPausedRef = useRef(false);
  const pausedAtRef = useRef(null);
  const totalPausedMillisecondsRef = useRef(0);

  const voiceCoachingSupported =
    isSpeechSynthesisSupported() || isCoachAudioSupported();

  const pacemakerProfile = useMemo(
    () => createPacemakerProfile(selectedPacer),
    [selectedPacer]
  );

  const currentPace = useMemo(
    () => calculateRollingPace(path, elapsedSeconds),
    [path, elapsedSeconds]
  );

  const pacemakerComparison = useMemo(() => {
    if (
      distance <= 0 ||
      location.latitude == null ||
      location.longitude == null
    ) {
      return null;
    }

    return calculatePacemakerComparison({
      profile: pacemakerProfile,
      currentPosition: location,
      currentDistance: distance,
      currentElapsedSeconds: elapsedSeconds,
    });
  }, [
    distance,
    elapsedSeconds,
    location,
    pacemakerProfile,
  ]);

  const routeWarningDistance = Math.max(
    30,
    (location.accuracy ?? 0) * 1.5
  );
  const isOffCourse =
    pacemakerComparison?.routeDistance != null &&
    pacemakerComparison.routeDistance > routeWarningDistance;

  // Chrome와 Safari는 음성 목록을 늦게 불러올 수 있어 변경 이벤트에서도 다시 선택한다.
  useEffect(() => {
    if (!isSpeechSynthesisSupported()) {
      return undefined;
    }

    const loadPreferredVoice = () => {
      preferredVoiceRef.current = selectPreferredKoreanVoice(
        window.speechSynthesis.getVoices()
      );
    };

    loadPreferredVoice();
    window.speechSynthesis.addEventListener("voiceschanged", loadPreferredVoice);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadPreferredVoice);
    };
  }, []);

  // React 개발 모드에서 effect가 두 번 실행되어도 러닝 시작 요청은 한 번만 보낸다.
  useEffect(() => {
    let isActive = true;

    if (!isBackendConfigured || !isSupabaseConfigured) {
      return undefined;
    }

    if (!runStartPromiseRef.current) {
      runStartPromiseRef.current = (async () => {
        const accessToken = await getAccessToken();

        if (!accessToken) {
          return null;
        }

        return startServerRun({ accessToken, courseId: null });
      })();
    }

    runStartPromiseRef.current
      .then((serverRun) => {
        if (!isActive) {
          return;
        }

        setServerStatus(
          serverRun?.id
            ? `서버 러닝 연결 완료 (#${serverRun.id})`
            : "로컬 기록 모드 (로그인 필요)"
        );
      })
      .catch((error) => {
        if (isActive) {
          console.error("서버 러닝을 시작하지 못했습니다.", error);
          setServerStatus(`로컬 기록 모드 (${error.message})`);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const stopCoachPlayback = useCallback(() => {
    activeUtteranceRef.current = null;

    if (isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }

    const activeAudio = activeCoachAudioRef.current;
    activeCoachAudioRef.current = null;

    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }
  }, []);

  // 새 안내가 이전 안내를 계속 끊지 않도록 일반 안내는 재생 중일 때 건너뛴다.
  // 코스 이탈과 종료처럼 중요한 안내만 interrupt 옵션으로 즉시 전달한다.
  const speakCoachMessage = useCallback((message, {
    interrupt = false,
    onEnd,
  } = {}) => {
    if (!message || !isSpeechSynthesisSupported()) {
      return false;
    }

    const speechSynthesis = window.speechSynthesis;

    if (interrupt) {
      stopCoachPlayback();
    } else if (
      (activeCoachAudioRef.current && !activeCoachAudioRef.current.ended) ||
      speechSynthesis.speaking ||
      speechSynthesis.pending
    ) {
      return false;
    }

    const utterance = new window.SpeechSynthesisUtterance(message);
    const koreanVoice = preferredVoiceRef.current ??
      selectPreferredKoreanVoice(speechSynthesis.getVoices());

    utterance.lang = "ko-KR";
    utterance.rate = 0.95;
    utterance.pitch = 1;

    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    // 일부 모바일 브라우저에서 객체가 일찍 정리되어 음성이 끊기는 것을 막는다.
    activeUtteranceRef.current = utterance;
    const handleSpeechEnd = () => {
      if (activeUtteranceRef.current !== utterance) {
        return;
      }

      activeUtteranceRef.current = null;
      onEnd?.();
    };
    utterance.onend = handleSpeechEnd;
    utterance.onerror = handleSpeechEnd;

    speechSynthesis.resume();
    speechSynthesis.speak(utterance);
    setLastVoiceCoachMessage(message);

    return true;
  }, [stopCoachPlayback]);

  // 고정 안내는 녹음된 MP3를 우선 사용하고, 재생이 막히면 기존 TTS로 안내한다.
  const playCoachAudio = useCallback((audioConfig, {
    interrupt = false,
    onEnd,
  } = {}) => {
    if (!audioConfig?.fileName || !audioConfig.message) {
      return false;
    }

    if (!isCoachAudioSupported()) {
      return speakCoachMessage(audioConfig.message, { interrupt, onEnd });
    }

    const speechSynthesis = isSpeechSynthesisSupported()
      ? window.speechSynthesis
      : null;

    if (interrupt) {
      stopCoachPlayback();
    } else if (
      (activeCoachAudioRef.current && !activeCoachAudioRef.current.ended) ||
      speechSynthesis?.speaking ||
      speechSynthesis?.pending
    ) {
      return false;
    }

    const audio = new window.Audio(
      `${COACH_AUDIO_BASE_PATH}/${audioConfig.fileName}`
    );
    audio.preload = "auto";
    activeCoachAudioRef.current = audio;

    const handleAudioEnd = () => {
      if (activeCoachAudioRef.current !== audio) {
        return;
      }

      activeCoachAudioRef.current = null;
      onEnd?.();
    };
    const handleAudioError = () => {
      if (activeCoachAudioRef.current !== audio) {
        return;
      }

      activeCoachAudioRef.current = null;
      audio.onended = null;
      audio.onerror = null;

      if (!speakCoachMessage(audioConfig.message, { onEnd })) {
        onEnd?.();
      }
    };

    audio.onended = handleAudioEnd;
    audio.onerror = handleAudioError;
    audio.play()?.catch(handleAudioError);
    setLastVoiceCoachMessage(audioConfig.message);

    return true;
  }, [speakCoachMessage, stopCoachPlayback]);

  // React 개발 모드의 effect 재실행을 피해 실제 러닝 시작 안내는 한 번만 재생한다.
  useEffect(() => {
    if (
      !voiceCoachingEnabled ||
      !isRunning ||
      hasPlayedStartAudioRef.current
    ) {
      return undefined;
    }

    const timerId = setTimeout(() => {
      const startAudio = selectedPacer && pacemakerProfile.mode !== "unavailable"
        ? FIXED_COACH_AUDIO.startPacer
        : FIXED_COACH_AUDIO.startFree;

      if (playCoachAudio(startAudio, { interrupt: true })) {
        hasPlayedStartAudioRef.current = true;
      }
    }, 0);

    return () => {
      clearTimeout(timerId);
    };
  }, [
    isRunning,
    pacemakerProfile.mode,
    playCoachAudio,
    selectedPacer,
    voiceCoachingEnabled,
  ]);

  // GPS 정확도가 낮거나 순간이동으로 판단되는 좌표는 경로와 거리에 반영하지 않는다.
  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const timestamp = position.timestamp || Date.now();

        // 일시정지 중 수신된 GPS 좌표와 이동거리는 러닝 기록에 포함하지 않는다.
        if (isPausedRef.current) {
          return;
        }

        const currentPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed,
          accuracy: position.coords.accuracy,
          timestamp,
        };

        setLocation(currentPosition);

        if (currentPosition.accuracy > MAX_GPS_ACCURACY_METERS) {
          setGpsStatus(
            `GPS 정확도 낮음 (±${currentPosition.accuracy.toFixed(0)}m)`
          );
          return;
        }

        setGpsStatus("GPS 연결 성공");

        let nextDistance = totalDistance.current;
        const previousPosition = lastAcceptedPosition.current;

        if (previousPosition) {
          const movedDistance = calculateDistanceMeters(
            previousPosition,
            currentPosition
          );
          const movedSeconds = Math.max(
            0.001,
            (timestamp - previousPosition.timestamp) / 1000
          );
          const measuredSpeed = movedDistance / movedSeconds;

          // 짧은 이동은 마지막 승인 위치를 유지해 다음 좌표와 합산되도록 한다.
          if (movedDistance < MIN_MOVEMENT_METERS) {
            return;
          }

          // 사람의 러닝 속도를 벗어난 순간이동은 GPS 튐으로 간주한다.
          if (measuredSpeed > MAX_RUNNING_SPEED_METERS_PER_SECOND) {
            setGpsStatus("GPS 위치가 불안정해 이동값을 제외했습니다.");
            return;
          }

          nextDistance += movedDistance;
        }

        const pointElapsedSeconds = calculateActiveElapsedSeconds({
          startTime,
          currentTime: timestamp,
          totalPausedMilliseconds: totalPausedMillisecondsRef.current,
        });
        const pathPoint = {
          latitude: currentPosition.latitude,
          longitude: currentPosition.longitude,
          timestamp,
          elapsedSeconds: pointElapsedSeconds,
          cumulativeDistance: nextDistance,
          accuracy: currentPosition.accuracy,
        };

        lastAcceptedPosition.current = currentPosition;
        totalDistance.current = nextDistance;
        setPath((previousPath) => [...previousPath, pathPoint]);
        setDistance(nextDistance);
        setAveragePace(
          calculateAveragePace(nextDistance, pointElapsedSeconds)
        );
      },
      (error) => {
        setGpsStatus(
          `GPS 오류 (${error.code}) : ${getGpsErrorMessage(error)}`
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    watchIdRef.current = watchId;

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [startTime]);

  // interval은 화면 갱신 신호로만 사용하고 실제 시간은 시작 시각과의 차이로 계산한다.
  useEffect(() => {
    if (!isRunning || isPaused) {
      return;
    }

    const timerId = setInterval(() => {
      setElapsedSeconds(
        calculateActiveElapsedSeconds({
          startTime,
          currentTime: Date.now(),
          totalPausedMilliseconds: totalPausedMillisecondsRef.current,
        })
      );
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [isPaused, isRunning, startTime]);

  // 5분마다 시간·거리·페이스와 과거 기록 비교를 한 번에 요약한다.
  useEffect(() => {
    if (!voiceCoachingEnabled || !isRunning || isPaused) {
      return;
    }

    const completedIntervals = Math.floor(
      elapsedSeconds / VOICE_PROGRESS_INTERVAL_SECONDS
    );

    if (
      completedIntervals <= 0 ||
      completedIntervals <= lastProgressIntervalRef.current
    ) {
      return;
    }

    const message = createProgressCoachMessage({
      elapsedSeconds,
      distance,
      currentPace,
      averagePace,
      comparison:
        getTimeComparisonState(pacemakerComparison?.timeDifference) === "even"
          ? null
          : pacemakerComparison,
    });

    if (speakCoachMessage(message)) {
      lastProgressIntervalRef.current = completedIntervals;
    }
  }, [
    averagePace,
    currentPace,
    distance,
    elapsedSeconds,
    isRunning,
    isPaused,
    pacemakerComparison,
    speakCoachMessage,
    voiceCoachingEnabled,
  ]);

  // 거리 이정표는 1km마다 알려 화면을 보지 않고도 진행 상황을 확인하게 한다.
  useEffect(() => {
    if (!voiceCoachingEnabled || !isRunning || isPaused) {
      return;
    }

    const completedKilometers = Math.floor(distance / 1000);

    if (
      completedKilometers <= 0 ||
      completedKilometers <= lastKilometerRef.current
    ) {
      return;
    }

    const message = createKilometerCoachMessage({
      completedKilometers,
      elapsedSeconds,
      averagePace,
      comparison:
        getTimeComparisonState(pacemakerComparison?.timeDifference) === "even"
          ? null
          : pacemakerComparison,
    });

    if (speakCoachMessage(message)) {
      lastKilometerRef.current = completedKilometers;
    }
  }, [
    averagePace,
    distance,
    elapsedSeconds,
    isRunning,
    isPaused,
    pacemakerComparison,
    speakCoachMessage,
    voiceCoachingEnabled,
  ]);

  // 앞섬·비슷함·뒤처짐 상태가 바뀐 경우에만 알려 반복 안내를 줄인다.
  useEffect(() => {
    if (
      !voiceCoachingEnabled ||
      !isRunning ||
      isPaused ||
      !pacemakerComparison
    ) {
      return;
    }

    const nextComparisonState = getTimeComparisonState(
      pacemakerComparison.timeDifference
    );

    const isFirstComparison = comparisonStateRef.current === null;

    if (isFirstComparison && nextComparisonState !== "even") {
      comparisonStateRef.current = nextComparisonState;
      return;
    }

    if (
      (!isFirstComparison &&
        nextComparisonState === comparisonStateRef.current) ||
      (!isFirstComparison &&
        elapsedSeconds - lastComparisonAnnouncementAtRef.current <
          COMPARISON_ANNOUNCEMENT_COOLDOWN_SECONDS)
    ) {
      return;
    }

    const message = createComparisonCoachMessage(pacemakerComparison);
    const didAnnounce = nextComparisonState === "even"
      ? playCoachAudio(FIXED_COACH_AUDIO.samePace)
      : speakCoachMessage(message);

    if (didAnnounce) {
      comparisonStateRef.current = nextComparisonState;
      lastComparisonAnnouncementAtRef.current = elapsedSeconds;
    }
  }, [
    elapsedSeconds,
    isRunning,
    isPaused,
    pacemakerComparison,
    playCoachAudio,
    speakCoachMessage,
    voiceCoachingEnabled,
  ]);

  // 코스 이탈은 즉시 안내하고, 다시 코스로 돌아왔을 때도 복귀를 알려준다.
  useEffect(() => {
    if (!voiceCoachingEnabled || !isRunning || isPaused) {
      return;
    }

    if (isOffCourse === offCourseStateRef.current) {
      return;
    }

    const audioConfig = isOffCourse
      ? FIXED_COACH_AUDIO.offCourse
      : FIXED_COACH_AUDIO.backOnCourse;

    if (playCoachAudio(audioConfig, { interrupt: isOffCourse })) {
      offCourseStateRef.current = isOffCourse;
    }
  }, [
    elapsedSeconds,
    isOffCourse,
    isRunning,
    isPaused,
    playCoachAudio,
    voiceCoachingEnabled,
  ]);

  // 정확도가 낮아졌다가 정상으로 돌아오는 순간에만 고정 음성을 한 번씩 재생한다.
  useEffect(() => {
    if (!voiceCoachingEnabled || !isRunning || isPaused) {
      return;
    }

    const isGpsUnstable =
      gpsStatus.startsWith("GPS 정확도 낮음") ||
      gpsStatus.startsWith("GPS 위치가 불안정");

    if (isGpsUnstable && !gpsUnstableStateRef.current) {
      if (playCoachAudio(FIXED_COACH_AUDIO.gpsUnstable)) {
        gpsUnstableStateRef.current = true;
      }
      return;
    }

    if (gpsStatus === "GPS 연결 성공" && gpsUnstableStateRef.current) {
      if (playCoachAudio(FIXED_COACH_AUDIO.gpsRecovered)) {
        gpsUnstableStateRef.current = false;
      }
    }
  }, [
    gpsStatus,
    isPaused,
    isRunning,
    playCoachAudio,
    voiceCoachingEnabled,
  ]);

  // 페이지를 벗어날 때 남아 있는 음성 재생도 함께 정리한다.
  useEffect(() => {
    return () => {
      stopCoachPlayback();
    };
  }, [stopCoachPlayback]);

  function handleToggleVoiceCoaching() {
    if (!voiceCoachingSupported) {
      return;
    }

    if (voiceCoachingEnabled) {
      stopCoachPlayback();
      setVoiceCoachingEnabled(false);
      setLastVoiceCoachMessage("음성 코칭을 껐습니다.");
      return;
    }

    // 사용자가 켠 시점 이전의 이정표를 뒤늦게 읽지 않도록 기준값을 맞춘다.
    lastProgressIntervalRef.current = Math.floor(
      elapsedSeconds / VOICE_PROGRESS_INTERVAL_SECONDS
    );
    lastKilometerRef.current = Math.floor(distance / 1000);
    comparisonStateRef.current = pacemakerComparison
      ? getTimeComparisonState(pacemakerComparison.timeDifference)
      : null;
    lastComparisonAnnouncementAtRef.current = elapsedSeconds;
    offCourseStateRef.current = isOffCourse;

    setVoiceCoachingEnabled(true);
    const startAudio = selectedPacer && pacemakerProfile.mode !== "unavailable"
      ? FIXED_COACH_AUDIO.startPacer
      : FIXED_COACH_AUDIO.startFree;
    hasPlayedStartAudioRef.current = true;
    playCoachAudio(startAudio, { interrupt: true });
  }

  function handleTestVoiceCoaching() {
    const isSamePace =
      getTimeComparisonState(pacemakerComparison?.timeDifference) === "even";
    const message = createProgressCoachMessage({
      elapsedSeconds,
      distance,
      currentPace,
      averagePace,
      comparison: isSamePace ? null : pacemakerComparison,
    });
    const playSamePaceAudio = isSamePace
      ? () => playCoachAudio(FIXED_COACH_AUDIO.samePace)
      : undefined;

    if (!speakCoachMessage(message, {
      interrupt: true,
      onEnd: playSamePaceAudio,
    })) {
      playSamePaceAudio?.();
    }
  }

  function handlePauseRunning() {
    if (!isRunning || isPausedRef.current) {
      return;
    }

    const pausedAt = Date.now();

    pausedAtRef.current = pausedAt;
    isPausedRef.current = true;
    lastAcceptedPosition.current = null;
    setElapsedSeconds(
      calculateActiveElapsedSeconds({
        startTime,
        currentTime: pausedAt,
        totalPausedMilliseconds: totalPausedMillisecondsRef.current,
      })
    );
    setIsPaused(true);
    setGpsStatus("러닝 일시정지");

    if (voiceCoachingEnabled) {
      playCoachAudio(FIXED_COACH_AUDIO.pause, { interrupt: true });
    } else {
      stopCoachPlayback();
    }
  }

  function handleResumeRunning() {
    if (!isRunning || !isPausedRef.current) {
      return;
    }

    const resumedAt = Date.now();

    totalPausedMillisecondsRef.current += Math.max(
      0,
      resumedAt - pausedAtRef.current
    );
    pausedAtRef.current = null;
    isPausedRef.current = false;
    // 재개 후 첫 좌표를 새 기준점으로 삼아 정지 중 이동이 거리에 포함되지 않게 한다.
    lastAcceptedPosition.current = null;
    setIsPaused(false);
    setGpsStatus("GPS 연결 재개 중...");

    if (voiceCoachingEnabled) {
      playCoachAudio(FIXED_COACH_AUDIO.resume, { interrupt: true });
    }
  }

  async function handleStopRunning() {
    if (!isRunning) {
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const endTime = Date.now();
    const finalElapsedSeconds = calculateActiveElapsedSeconds({
      startTime,
      currentTime: endTime,
      totalPausedMilliseconds: totalPausedMillisecondsRef.current,
      pausedAt: pausedAtRef.current,
    });
    const finalAveragePace = calculateAveragePace(
      totalDistance.current,
      finalElapsedSeconds
    );
    const lastPoint = path.at(-1);
    const recordedPath = lastPoint
      ? [
          ...path,
          {
            ...lastPoint,
            timestamp: endTime,
            elapsedSeconds: finalElapsedSeconds,
          },
        ]
      : path;
    const runRecord = {
      recordVersion: 2,
      id: Date.now(),
      startTime,
      endTime,
      elapsedTime: finalElapsedSeconds,
      distance: totalDistance.current,
      pace: finalAveragePace,
      path: recordedPath,
      createdAt: new Date().toISOString(),
    };
    const existingRecords = loadRunningRecords();

    existingRecords.push(runRecord);
    localStorage.setItem(
      "runningRecords",
      JSON.stringify(existingRecords)
    );

    setElapsedSeconds(finalElapsedSeconds);
    setIsRunning(false);
    setIsPaused(false);
    isPausedRef.current = false;
    pausedAtRef.current = null;
    setGpsStatus("러닝 종료 및 기록 저장 완료");

    if (voiceCoachingEnabled) {
      const finishMessage = createFinishCoachMessage({
        elapsedSeconds: finalElapsedSeconds,
        distance: totalDistance.current,
        averagePace: finalAveragePace,
      });
      const finishVoiceCoaching = () => {
        setVoiceCoachingEnabled(false);
      };
      const playFinishOutro = () => {
        if (!playCoachAudio(FIXED_COACH_AUDIO.finishOutro, {
          onEnd: finishVoiceCoaching,
        })) {
          finishVoiceCoaching();
        }
      };
      const speakFinishResult = () => {
        if (!speakCoachMessage(finishMessage, { onEnd: playFinishOutro })) {
          playFinishOutro();
        }
      };

      if (!playCoachAudio(FIXED_COACH_AUDIO.finishIntro, {
        interrupt: true,
        onEnd: speakFinishResult,
      })) {
        speakFinishResult();
      }
    }

    // 서버 저장에 실패해도 위에서 저장한 localStorage 기록은 유지한다.
    if (!isBackendConfigured || !isSupabaseConfigured) {
      setServerStatus("로컬 기록 저장 완료");
      return;
    }

    setIsSavingToServer(true);
    setServerStatus("서버에 러닝 기록 저장 중...");

    try {
      const serverRun = await runStartPromiseRef.current;
      const accessToken = await getAccessToken();

      if (!serverRun?.id || !accessToken) {
        setServerStatus("로컬 기록 저장 완료 (로그인 필요)");
        return;
      }

      const selectedGhostRunId = Number(
        selectedPacer?.serverRunId ?? selectedPacer?.backendRunId
      );

      await finishServerRun({
        accessToken,
        runId: serverRun.id,
        endTime: new Date(endTime).toISOString(),
        totalDistance: totalDistance.current,
        totalTime: finalElapsedSeconds,
        gpsPath: recordedPath.map((point) => [
          point.latitude,
          point.longitude,
        ]),
        splits: createKilometerSplits(recordedPath),
        ghostRunId: Number.isInteger(selectedGhostRunId)
          ? selectedGhostRunId
          : null,
        // 공개 범위 UI가 확정되기 전까지 러닝 기록은 비공개로 저장한다.
        isPublic: false,
      });

      const feedback = await getServerRunFeedback(serverRun.id);
      const feedbackText = feedback?.ai_feedback_text ?? "";

      updateRunningRecord(runRecord.id, {
        serverRunId: serverRun.id,
        serverSynced: true,
        aiFeedback: feedbackText,
        segmentAnalysis: feedback?.segment_analysis ?? [],
      });
      setAiFeedback(feedbackText);
      setServerStatus("서버 저장 및 AI 분석 완료");
    } catch (error) {
      console.error("서버에 러닝 기록을 저장하지 못했습니다.", error);
      updateRunningRecord(runRecord.id, {
        serverSynced: false,
        serverSyncError: error.message,
      });
      setServerStatus(`로컬 저장 완료 · 서버 저장 실패 (${error.message})`);
    } finally {
      setIsSavingToServer(false);
    }
  }

  const goalDistanceMeters = runPreferences.targetDistanceKilometers * 1000;
  const goalProgress = goalDistanceMeters > 0
    ? Math.min(100, (distance / goalDistanceMeters) * 100)
    : 0;
  const coachHeadline = isPaused
    ? "잠시 숨을 고르는 중"
    : pacemakerComparison?.timeDifference > 1
      ? `${formatTimeDifference(pacemakerComparison.timeDifference)} 앞서고 있어요`
      : pacemakerComparison?.timeDifference < -1
        ? "호흡을 정리하고 리듬을 찾아요"
        : selectedPacer
          ? "과거의 나와 나란히 달리는 중"
          : "나만의 페이스로 달리는 중";

  return (
    <main className="live-screen">
      <header className="live-header">
        <div className="live-brand"><span>R</span><strong>RePace</strong></div>
        <span className={`live-state ${isPaused ? "is-paused" : ""}`}>
          {isPaused ? "일시정지" : isRunning ? "LIVE" : "완료"}
        </span>
      </header>

      <section className="live-coach">
        <p>{gpsStatus}</p>
        <div className={`live-mascot ${isPaused ? "is-paused" : ""}`} aria-hidden="true">🐯</div>
        <h1>{coachHeadline}</h1>
        {isOffCourse && <div className="live-warning">코스에서 벗어났어요. 지도를 확인하세요.</div>}
      </section>

      <section className="live-metrics" aria-label="실시간 러닝 정보">
        <div><strong>{(distance / 1000).toFixed(2)}</strong><span>km</span><small>거리</small></div>
        <div><strong>{formatElapsedTime(elapsedSeconds)}</strong><span /><small>시간</small></div>
        <div><strong>{formatPace(currentPace).replace(" 분/km", "")}</strong><span>/km</span><small>현재 페이스</small></div>
      </section>

      <section className="live-progress-card">
        <div>
          <span>오늘의 목표</span>
          <strong>{runPreferences.targetDistanceKilometers} km · {runPreferences.targetPaceMinutes}분/km</strong>
        </div>
        <div className="live-progress-track"><span style={{ width: `${goalProgress}%` }} /></div>
        <small>{goalProgress.toFixed(0)}% 완료</small>
      </section>

      {selectedPacer && (
        <section className="live-comparison-card">
          <div>
            <span>과거의 나</span>
            <strong>{formatPace(selectedPacer.pace)}</strong>
          </div>
          {pacemakerComparison ? (
            <div className={pacemakerComparison.timeDifference >= 0 ? "is-ahead" : "is-behind"}>
              <span>{pacemakerComparison.timeDifference >= 0 ? "앞서는 중" : "따라가는 중"}</span>
              <strong>{formatTimeDifference(pacemakerComparison.timeDifference)}</strong>
            </div>
          ) : (
            <div><span>비교 준비</span><strong>GPS 확인 중</strong></div>
          )}
          {pacemakerProfile.mode === "estimated" && <p>좌표별 시간이 없어 전체 페이스로 비교해요.</p>}
          {pacemakerProfile.mode === "unavailable" && <p>선택한 기록에는 비교 가능한 GPS 경로가 없어요.</p>}
        </section>
      )}

      {voiceCoachingSupported && (
        <section className="live-voice-card">
          <button type="button" onClick={handleToggleVoiceCoaching}>
            <span aria-hidden="true">🔊</span>
            <div><strong>음성 코칭</strong><small>{voiceCoachingEnabled ? "자동 안내 켜짐" : "자동 안내 꺼짐"}</small></div>
          </button>
          <button type="button" onClick={handleTestVoiceCoaching}>현재 상태 듣기</button>
          {lastVoiceCoachMessage && <p>“{lastVoiceCoachMessage}”</p>}
        </section>
      )}

      <details className="live-map-card">
        <summary>실시간 경로와 GPS 상세 보기</summary>
        {/* 지도 선과 같은 색·모양을 사용해 팀원이 경로 종류를 바로 구분할 수 있게 한다. */}
        <div className="live-route-legend" aria-label="경로 범례">
          <span><i className="is-current" aria-hidden="true" />현재 경로</span>
          <span><i className="is-past" aria-hidden="true" />과거 경로</span>
        </div>
        <div className="live-map-wrap">
          <KakaoMap
            latitude={location.latitude}
            longitude={location.longitude}
            path={path}
            pastPath={selectedPacer?.path ?? []}
          />
        </div>
        <div className="live-gps-details">
          <span>위도 {location.latitude ?? "-"}</span>
          <span>경도 {location.longitude ?? "-"}</span>
          <span>속도 {location.speed != null ? location.speed.toFixed(2) : "-"} m/s</span>
          <span>정확도 {location.accuracy != null ? `±${location.accuracy.toFixed(0)}m` : "-"}</span>
        </div>
      </details>

      <p className="live-server-status">백엔드 연동 · {serverStatus}</p>

      {isRunning ? (
        <div className="live-controls">
          <button className="live-pause-button" type="button" onClick={isPaused ? handleResumeRunning : handlePauseRunning}>
            {isPaused ? "▶" : "Ⅱ"}<span>{isPaused ? "재개" : "일시정지"}</span>
          </button>
          <button className="live-stop-button" type="button" onClick={handleStopRunning}>러닝 종료</button>
        </div>
      ) : (
        <section className="live-finish-card">
          <span aria-hidden="true">✓</span>
          <h2>{isSavingToServer ? "기록을 서버에 저장하고 있어요." : "오늘의 러닝을 저장했어요."}</h2>
          <p>평균 페이스 {formatPace(averagePace)} · {formatElapsedTime(elapsedSeconds)}</p>
          {aiFeedback && <div className="live-ai-feedback"><strong>AI 러닝 분석</strong><p>{aiFeedback}</p></div>}
          <div className="live-finish-actions">
            <button type="button" onClick={() => navigate("/result")}>결과 확인</button>
            <button type="button" onClick={() => navigate("/run-ready")}>새 목표 설정</button>
          </div>
        </section>
      )}
    </main>
  );
}

export default LiveRun;
