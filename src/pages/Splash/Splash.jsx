import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import runningCat from "../../assets/runningcat.png";
import "./Splash.css";

function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timerId = window.setTimeout(() => navigate("/home"), 1700);

    return () => window.clearTimeout(timerId);
  }, [navigate]);

  return (
    <main
      className="splash-screen"
      onClick={() => navigate("/home")}
      aria-label="홈 화면으로 이동"
    >
      <div className="splash-brand">
        <span className="brand-mark" aria-hidden="true">
          R
        </span>
        <strong>RePace</strong>
      </div>

      <div className="mascot mascot--splash" aria-hidden="true">
        <img src={runningCat} alt="" />
      </div>

      <div className="splash-copy">
        <p>어제의 나를 다시 만나</p>
        <h1>나만의 페이스로 달려요.</h1>
      </div>

      <span className="splash-hint">화면을 눌러 시작하기</span>
    </main>
  );
}

export default Splash;


