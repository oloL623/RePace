import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import "./SharedCourses.css";

const COURSE_PREVIEWS = [
  {
    id: "riverside",
    title: "한강 바람 코스",
    description: "평탄한 길이 이어지는 5km 입문 코스",
    distance: "5.0 km",
    pace: "약 30분",
    shape: "course-route--wave",
  },
  {
    id: "park-loop",
    title: "공원 두 바퀴 코스",
    description: "신호가 적고 페이스를 유지하기 좋은 코스",
    distance: "3.2 km",
    pace: "약 20분",
    shape: "course-route--loop",
  },
];

function SharedCourses() {
  const navigate = useNavigate();

  function selectCourse(course) {
    // 코스 API가 연결되기 전까지 선택 정보만 준비 화면에 전달한다.
    sessionStorage.setItem("selectedSharedCourse", JSON.stringify(course));
    navigate("/run-ready");
  }

  return (
    <PageShell className="courses-screen">
      <p className="page-kicker">SHARED COURSE</p>
      <h1 className="page-title">러너들의 코스에<br />도전해 보세요.</h1>
      <p className="page-description">
        코스 백엔드 연동 전까지 대표 화면과 선택 흐름을 먼저 구성했습니다.
      </p>

      <section className="featured-course">
        <div className="featured-course__map" aria-hidden="true">
          <span className="course-route course-route--featured" />
          <i className="course-pin course-pin--start">S</i>
          <i className="course-pin course-pin--finish">F</i>
        </div>
        <div className="featured-course__content">
          <span>이번 주 추천</span>
          <h2>도심 리듬 러닝</h2>
          <p>완만한 구간과 직선 코스를 번갈아 달리며 페이스를 익혀요.</p>
          <div>
            <strong>4.5 km</strong>
            <strong>평균 28분</strong>
          </div>
          <button className="primary-button full-button" type="button" onClick={() => selectCourse({ id: "featured", title: "도심 리듬 러닝" })}>
            이 코스로 준비하기
          </button>
        </div>
      </section>

      <div className="section-heading">
        <h2>인기 코스</h2>
      </div>

      <div className="course-list">
        {COURSE_PREVIEWS.map((course) => (
          <article className="course-card" key={course.id}>
            <div className="course-card__preview" aria-hidden="true">
              <span className={`course-route ${course.shape}`} />
            </div>
            <div className="course-card__body">
              <h3>{course.title}</h3>
              <p>{course.description}</p>
              <div><span>{course.distance}</span><span>{course.pace}</span></div>
              <button type="button" onClick={() => selectCourse(course)}>코스 선택</button>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}

export default SharedCourses;
