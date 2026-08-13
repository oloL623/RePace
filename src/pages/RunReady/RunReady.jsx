import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadRunPreferences,
  saveRunPreferences,
} from "../../utils/runPreferences";

function loadSelectedPacer() {
  try {
    const saved = localStorage.getItem("selectedPacerRecord");

    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("선택한 과거 기록을 불러오지 못했습니다.", error);
    return null;
  }
}

function formatPace(pace) {
  if (!Number.isFinite(pace)) {
    return "-";
  }

  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);

  return `${minutes}:${String(seconds).padStart(2, "0")} 분/km`;
}

function RunReady() {
  const navigate = useNavigate();
  const [selectedPacer, setSelectedPacer] = useState(loadSelectedPacer);
  const [preferences, setPreferences] = useState(loadRunPreferences);

  function updatePreference(name, value) {
    setPreferences((current) => ({ ...current, [name]: value }));
  }

  function handleRemovePacer() {
    localStorage.removeItem("selectedPacerRecord");
    setSelectedPacer(null);
  }

  function handleStartRunning() {
    saveRunPreferences(preferences);
    navigate("/live-run");
  }

  return (
    <main>
      <h1>달리기 준비 완료</h1>

      {selectedPacer ? (
        <section>
          <h2>과거 기록에 도전</h2>
          <p>거리 : {(selectedPacer.distance / 1000).toFixed(2)} km</p>
          <p>시간 : {Math.floor(selectedPacer.elapsedTime / 60)}분</p>
          <p>평균 페이스 : {formatPace(selectedPacer.pace)}</p>
          <button type="button" onClick={handleRemovePacer}>
            과거 기록 비교 해제
          </button>
        </section>
      ) : (
        <p>과거 기록 비교 없이 새로운 러닝을 시작합니다.</p>
      )}

      <section>
        <h2>러닝 목표</h2>
        <label>
          목표 거리(km)
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={preferences.targetDistanceKilometers}
            onChange={(event) =>
              updatePreference(
                "targetDistanceKilometers",
                Math.max(0.1, Number(event.target.value) || 0.1)
              )
            }
          />
        </label>
        <br />
        <label>
          목표 페이스(분/km)
          <input
            type="number"
            min="2"
            max="20"
            step="0.1"
            value={preferences.targetPaceMinutes}
            onChange={(event) =>
              updatePreference(
                "targetPaceMinutes",
                Math.max(2, Number(event.target.value) || 2)
              )
            }
          />
        </label>
      </section>

      <section>
        <h2>음성 코칭</h2>
        <label>
          <input
            type="checkbox"
            checked={preferences.voiceCoachingEnabled}
            onChange={(event) =>
              updatePreference("voiceCoachingEnabled", event.target.checked)
            }
          />
          러닝 중 자동 음성 안내 사용
        </label>
      </section>

      <hr />
      <button type="button" onClick={() => navigate("/home")}>
        뒤로 가기
      </button>{" "}
      <button type="button" onClick={handleStartRunning}>
        달리기 시작
      </button>
    </main>
  );
}

export default RunReady;
