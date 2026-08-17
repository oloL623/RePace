import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import "./SharedCourses.css";

function loadSharedCourses() {
  try {
    const courses = JSON.parse(localStorage.getItem("sharedRunningCourses"));
    return Array.isArray(courses) ? courses : [];
  } catch {
    return [];
  }
}

function SharedCourses() {
  const navigate = useNavigate();
  const [courses] = useState(loadSharedCourses);

  function selectCourse(course) {
    // 실제 코스 상세 API가 연결되기 전까지 선택한 코스를 지도 상세 화면에 전달한다.
    sessionStorage.setItem("selectedSharedCourse", JSON.stringify(course));
    navigate("/course-map");
  }

  return (
    <PageShell className="courses-screen">
      <p className="page-kicker">SHARED COURSE</p>
      <h1 className="page-title">러너들의 코스에<br />도전해 보세요.</h1>
      <p className="page-description">
        러너가 완주한 GPS 경로를 공유하고, 다른 러너의 코스에 도전해 보세요.
      </p>

      <div className="section-heading">
        <h2>공유된 코스</h2>
      </div>

      {courses.length ? <div className="course-list">
        {courses.map((course) => (
          <article className="course-card" key={course.id}>
            <div className="course-card__preview" aria-hidden="true">
              <span className={`course-route ${course.shape}`} />
            </div>
            <div className="course-card__body">
              <h3>{course.title}</h3>
              <p>{course.description}</p>
              <div><span>{course.distanceKilometers} km</span><span>{course.targetPace ?? "페이스 정보 없음"}</span></div>
              <button type="button" onClick={() => selectCourse(course)}>이 코스 보기</button>
            </div>
          </article>
        ))}
      </div> : <div className="empty-state"><div><span className="result-empty-icon" aria-hidden="true">⌘</span><p>아직 공유된 코스가 없어요.<br />러닝을 완주한 뒤 내 GPS 경로를 첫 코스로 공유해 보세요.</p></div></div>}
    </PageShell>
  );
}

export default SharedCourses;


