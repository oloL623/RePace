import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import KakaoMap from "../../components/KakaoMap";
import "./CourseMap.css";

const FALLBACK_COURSE = {
  title: "여의도 한강공원 왕복",
  description: "강변을 따라 달리는 평지 코스",
  distanceKilometers: 5,
  targetPace: "5'08\"/km",
  recordTime: "30:00",
  altitude: "12m",
  runner: "러너김민수",
};

function loadCourse() {
  try {
    return JSON.parse(sessionStorage.getItem("selectedSharedCourse")) ?? FALLBACK_COURSE;
  } catch {
    return FALLBACK_COURSE;
  }
}

function CourseMap() {
  const navigate = useNavigate();
  const [course] = useState(loadCourse);
  const firstPoint = course.path?.[0] ?? null;

  function startCourse() {
    sessionStorage.setItem("selectedSharedCourse", JSON.stringify(course));
    navigate("/run-ready");
  }

  return (
    <PageShell className="course-map-screen">
      <section className="course-map-art" aria-label="선택한 러닝 코스 지도">
        {firstPoint ? <KakaoMap latitude={firstPoint.latitude} longitude={firstPoint.longitude} path={course.path} /> : <>
        <span className="map-river" />
        <span className="map-road map-road--one" />
        <span className="map-road map-road--two" />
        <span className="course-line" />
        <span className="course-pin course-pin--start">S</span>
        <span className="course-pin course-pin--finish">F</span>
        <span className="course-current" />
        </>}
      </section>

      <section className="course-detail-card">
        <div className="course-detail-card__handle" />
        <div className="course-detail-card__title">
          <div>
            <h1>{course.title}</h1>
            <p>{course.runner ?? "러너김민수"}<small>인기 추천 코스 크리에이터</small></p>
          </div>
          <button type="button" aria-label="코스 공유">⌯</button>
        </div>
        <div className="course-detail-stats">
          <div><span>총 거리</span><strong>{Math.round((course.distanceKilometers ?? 5) * 1000)}m</strong></div>
          <div><span>기준 페이스</span><strong>{course.targetPace ?? "5'08\"/km"}</strong></div>
          <div><span>고도</span><strong>{course.altitude ?? "12m"}</strong></div>
        </div>
        <button className="primary-button full-button" type="button" onClick={startCourse}>이 코스 달려보기</button>
        <button className="course-save-button" type="button">코스 저장하기</button>
      </section>
    </PageShell>
  );
}

export default CourseMap;


