import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";

function PageShell({ children, className = "", headerAction, showNav = true }) {
  return (
    <div className={`app-screen ${className}`.trim()}>
      <AppHeader action={headerAction} />
      <main className="app-content">{children}</main>
      {showNav && <BottomNav />}
    </div>
  );
}

export default PageShell;
