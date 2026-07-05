import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: 'bi-speedometer2', end: true },
  { to: '/control', label: 'Bot Control', icon: 'bi-power' },
  { to: '/discord-config', label: 'Discord Config', icon: 'bi-gear-fill' },
  { to: '/guilds', label: 'Guilds', icon: 'bi-hdd-network' },
  { to: '/messages', label: 'Messages', icon: 'bi-chat-left-text-fill' },
  { to: '/account', label: 'Account', icon: 'bi-person-circle' }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <nav className="d-flex flex-column flex-shrink-0 p-3 bg-dark text-white admin-sidebar">
        <a href="/" className="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-white text-decoration-none">
          <i className="bi bi-shield-lock-fill fs-4 me-2 text-primary" />
          <span className="fs-5 fw-semibold">Infinity Bot</span>
        </a>
        <hr />
        <ul className="nav nav-pills flex-column mb-auto">
          {NAV_ITEMS.map((item) => (
            <li className="nav-item" key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link text-white d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}
              >
                <i className={`bi ${item.icon}`} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <hr />
        <div className="small text-secondary">Owner Admin Panel</div>
      </nav>

      <div className="flex-grow-1 d-flex flex-column">
        <header className="d-flex align-items-center justify-content-between border-bottom bg-white px-4 py-2 admin-topbar">
          <div className="fw-semibold text-secondary">Bot Control Center</div>
          <div className="d-flex align-items-center gap-3">
            <span className="d-flex align-items-center gap-2">
              <i className="bi bi-person-circle fs-5 text-secondary" />
              <span className="fw-medium">{user?.username}</span>
            </span>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right me-1" />
              Logout
            </button>
          </div>
        </header>

        <main className="flex-grow-1 p-4 bg-light">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
