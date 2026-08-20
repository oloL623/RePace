import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/home", label: "홈", icon: "⌂" },
  { path: "/run-ready", label: "달리기", icon: "▶" },
  { path: "/result", label: "내 기록", icon: "◴" },
  { path: "/shared-courses", label: "코스", icon: "⌘" },
  { path: "/my-page", label: "마이페이지", icon: "♙" },
];

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {NAV_ITEMS.map((item) => {
        const isActive = item.path === "/shared-courses"
          ? location.pathname.startsWith(item.path)
          : location.pathname === item.path;

        return (
          <button
            key={item.path}
            className={isActive ? "bottom-nav__item is-active" : "bottom-nav__item"}
            type="button"
            onClick={() => navigate(item.path)}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default BottomNav;
