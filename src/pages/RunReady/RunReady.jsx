import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import { loadRunPreferences, saveRunPreferences } from "../../utils/runPreferences";
import "./RunReady.css";

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

  return `${minutes}'${String(seconds).padStart(2, "0")}`;
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
    <PageShell className="ready-screen">
      <p className="page-kicker">READY TO RUN</p>
      <h1 className="page-title">달리기 준비 완료</h1>
      <p className="page-description">오늘의 목표를 확인하고 나만의 페이스로 출발하세요.</p>

      <section className="ready-goals" aria-label="러닝 목표 설정">
        <label>
          <span>목표 거리</span>
          <div>
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
            <strong>km</strong>
          </div>
        </label>
        <label>
          <span>목표 페이스</span>
          <div>
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
            <strong>분/km</strong>
          </div>
        </label>
      </section>

      <section className="ready-card">
        <div className="ready-card__heading">
          <div>
            <span>PACE MAKER</span>
            <h2>{selectedPacer ? "과거의 나와 함께 달려요" : "새로운 기록을 만들어요"}</h2>
          </div>
          <span className="ready-card__icon" aria-hidden="true">🐯</span>
        </div>

        {selectedPacer ? (
          <>
            <div className="ready-pacer-stats">
              <div><strong>{(selectedPacer.distance / 1000).toFixed(2)}</strong><span>km</span></div>
              <div><strong>{Math.floor(selectedPacer.elapsedTime / 60)}</strong><span>분</span></div>
              <div><strong>{formatPace(selectedPacer.pace)}</strong><span>페이스</span></div>
            </div>
            <button className="ready-link-button" type="button" onClick={handleRemovePacer}>
              과거 기록 비교 해제
            </button>
          </>
        ) : (
          <p>비교 기록 없이 자유롭게 달립니다. 종료 후 오늘 기록을 다음 페이스메이커로 선택할 수 있어요.</p>
        )}
      </section>

      <section className="ready-voice-card">
        <div>
          <span aria-hidden="true">🔊</span>
          <div>
            <strong>음성 페이스 코칭</strong>
            <p>기록 차이와 페이스 변화를 달리는 중 알려드려요.</p>
          </div>
        </div>
        <label className="switch" aria-label="음성 코칭 사용">
          <input
            type="checkbox"
            checked={preferences.voiceCoachingEnabled}
            onChange={(event) => updatePreference("voiceCoachingEnabled", event.target.checked)}
          />
          <span />
        </label>
      </section>

      <button className="primary-button full-button ready-start" type="button" onClick={handleStartRunning}>
        달리기 시작
      </button>
    </PageShell>
  );
}

export default RunReady;
