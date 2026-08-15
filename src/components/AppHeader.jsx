import { useNavigate } from "react-router-dom";

function AppHeader({ action, compact = false }) {
  const navigate = useNavigate();

  return (
    <header className={`app-header${compact ? " app-header--compact" : ""}`}>
      <button
        className="brand-button"
        type="button"
        onClick={() => navigate("/home")}
        aria-label="RePace 홈으로 이동"
      >
        <span className="brand-mark" aria-hidden="true">
          R
        </span>
        <span>RePace</span>
      </button>
      {action}
    </header>
  );
}

export default AppHeader;
