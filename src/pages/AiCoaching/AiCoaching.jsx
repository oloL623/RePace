import { useMemo } from "react";
import PageShell from "../../components/PageShell";
import { createKilometerSplits } from "../../utils/runSplits";
import "./AiCoaching.css";

function loadLatestRun() {
  try {
    const records = JSON.parse(localStorage.getItem("runningRecords"));
    return Array.isArray(records) ? records.at(-1) ?? null : null;
  } catch { return null; }
}

function formatPace(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  return `${Math.floor(seconds / 60)}'${String(Math.round(seconds % 60)).padStart(2, "0")}"`;
}

function AiCoaching() {
  const run = useMemo(() => loadLatestRun(), []);
  const splits = useMemo(() => createKilometerSplits(run?.path ?? []), [run]);
  const slowest = splits.length
    ? splits.reduce((slow, item) => item.pace > slow.pace ? item : slow, splits[0])
    : null;
  const fastest = splits.length
    ? splits.reduce((fast, item) => item.pace < fast.pace ? item : fast, splits[0])
    : null;
  const paceGap = slowest && fastest ? slowest.pace - fastest.pace : 0;

  return (
    <PageShell className="ai-coaching-screen">
      <p className="page-kicker">AI COACHING GUIDE</p>
      <h1 className="page-title">구간별 페이스 분석</h1>
      <p className="page-description">완주 기록의 GPS 경로를 바탕으로 구간별 페이스를 분석해요.</p>

      <section className="ai-chart-card">
        <div className="ai-chart-heading"><h2>구간 페이스 ({splits.length}km 분석)</h2>{paceGap > 0 && <span>{paceGap}초 페이스 차이</span>}</div>
        {splits.length ? <><div className="ai-bars">
          {splits.map((split) => {
            const isSlow = split.km === slowest.km;
            const height = Math.max(38, 128 - (split.pace - 320) * .65);
            return <div key={split.km} className={isSlow ? "is-slow" : ""}><small>{formatPace(split.pace)}</small><i style={{ height }} /><strong>{split.km * 1000}m</strong></div>;
          })}
        </div>
        <p className="ai-warning">⚠ {slowest.km}km 구간이 가장 느렸어요. 다음 러닝에서 이 구간의 리듬을 지켜보세요.</p></> : <p className="ai-empty">1km 이상 GPS 경로가 저장된 러닝을 완주하면 실제 구간 분석이 표시됩니다.</p>}
      </section>

      <section className="ai-live-card">
        <div><h2>〽 실시간 음성 코치</h2><span>LIVE</span></div>
        <p>{slowest ? `${slowest.km}km 구간 진입 시 페이스를 유지할 수 있게 실시간 음성 가이드를 제공합니다.` : "과거 기록이 쌓이면 페이스가 흔들리는 구간에서 실시간 안내를 제공합니다."}</p>
        <article><small>🐈 LIVE 코칭 {slowest ? "예상 메시지" : "준비 중"}</small><strong>{slowest ? <>“{slowest.km}km 구간입니다. 호흡을 유지하면서 현재 페이스를 지켜보세요.”</> : "분석할 GPS 러닝 기록이 아직 없습니다."}</strong></article>
      </section>
    </PageShell>
  );
}
export default AiCoaching;

