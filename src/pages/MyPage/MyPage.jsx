import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import "./MyPage.css";

function loadRuns() {
  try {
    const value = JSON.parse(localStorage.getItem("runningRecords"));
    return Array.isArray(value) ? [...value].reverse() : [];
  } catch {
    return [];
  }
}

function formatPace(record) {
  if (!Number.isFinite(record?.pace)) {
    return "-";
  }

  const minutes = Math.floor(record.pace);
  const seconds = Math.round((record.pace % 1) * 60);
  return `${minutes}'${String(seconds).padStart(2, "0")}"/km`;
}

function formatTime(seconds = 0) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function MyPage() {
  const navigate = useNavigate();
  const records = useMemo(() => loadRuns(), []);
  const latest = records[0];
  const previous = records[1];
  const best = [...records]
    .filter((record) => Number.isFinite(record.pace))
    .sort((recordA, recordB) => recordA.pace - recordB.pace)[0];
  const timeDifference = latest && previous
    ? previous.elapsedTime - latest.elapsedTime
    : null;
  const totalDistance = records.reduce(
    (sum, record) => sum + (record.distance || 0),
    0
  );

  function challengeRecord(record) {
    localStorage.setItem("selectedPacerRecord", JSON.stringify(record));
    navigate("/run-ready");
  }

  return (
    <PageShell className="my-page-screen">
      <p className="page-kicker">MY RUNNING</p>
      <h1 className="page-title">러닝 기록</h1>
      <p className="page-description">달린 거리와 이전 기록을 한눈에 확인해요.</p>

      <section className="my-summary">
        <div>
          <strong>{(totalDistance / 1000).toFixed(1)}</strong>
          <span>총 거리 · km</span>
        </div>
        <div>
          <strong>{records.length}</strong>
          <span>달린 횟수</span>
        </div>
        <div>
          <strong>{best ? formatTime(best.elapsedTime) : "-"}</strong>
          <span>최고 기록</span>
        </div>
      </section>

      <section className="my-last">
        <span>LAST CHALLENGE</span>
        <h2>지난 기록과 비교</h2>
        {latest && previous ? (
          <>
            <div>
              <strong>{formatTime(previous.elapsedTime)}</strong>
              <b>→</b>
              <strong className={timeDifference >= 0 ? "is-green" : "is-orange"}>
                {formatTime(latest.elapsedTime)}
              </strong>
            </div>
            <p>
              {timeDifference === 0
                ? "지난 기록과 같은 시간으로 완주했어요."
                : `${Math.abs(timeDifference)}초 ${timeDifference > 0 ? "더 빠르게" : "더 느리게"} 완주했어요.`}
            </p>
          </>
        ) : (
          <p className="my-empty-copy">비교하려면 완주한 러닝 기록이 2개 이상 필요해요.</p>
        )}
      </section>

      <section className="my-feedback">
        <span>AI RUN REVIEW</span>
        <h2>이번 러닝 피드백</h2>
        {latest ? (
          <>
            <strong>{latest.aiFeedback || "AI 분석 결과를 기다리고 있어요."}</strong>
            <p>
              {latest.aiFeedback
                ? "러닝 결과 화면에서 구간별 페이스 분석을 확인할 수 있어요."
                : "서버 AI 분석이 완료되면 이곳에 실제 피드백이 표시됩니다."}
            </p>
            {latest.path?.length > 1 && (
              <div className="my-line-chart" aria-hidden="true">
                <i /><i /><i /><i /><i />
              </div>
            )}
            <small>다음 목표 · GPS 기록을 바탕으로 안내합니다.</small>
          </>
        ) : (
          <p className="my-empty-copy">완주 기록이 생기면 AI 러닝 피드백을 확인할 수 있어요.</p>
        )}
      </section>

      <section className="my-history">
        <h2>최근 달리기</h2>
        {records.slice(0, 3).map((record) => (
          <article key={record.id}>
            <div>
              <strong>
                {new Date(record.startTime).toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                })} 러닝
              </strong>
              <span>{(record.distance / 1000).toFixed(2)}km · {formatPace(record)}</span>
            </div>
            <div className="my-history__action">
              <b>{formatTime(record.elapsedTime)}</b>
              <button type="button" onClick={() => challengeRecord(record)}>
                이 기록과 달리기
              </button>
            </div>
          </article>
        ))}
        {!records.length && <p>아직 저장된 러닝 기록이 없습니다.</p>}
      </section>
    </PageShell>
  );
}

export default MyPage;
