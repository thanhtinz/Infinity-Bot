import { NAV_ITEMS } from '../lib/nav';
import { DEFAULT_AVATAR, GUILD_PLACEHOLDER } from '../lib/format';

export default function Sidebar({
  user,
  guild,
  activePage,
  onNavigate,
  onSwitchServer,
  onLogout,
  mobileOpen,
  onCloseMobile
}) {
  return (
    <nav className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand-block">
          <p className="sidebar-kicker">Discord Automation</p>
          <h2 className="brand-wordmark">INFINITY</h2>
        </div>
        <button type="button" className="btn-icon mobile-only" onClick={onCloseMobile} aria-label="Close menu">
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      <button type="button" className="guild-switcher" onClick={onSwitchServer}>
        {guild?.icon ? (
          <img src={guild.icon} alt="" className="guild-icon" />
        ) : (
          <img src={GUILD_PLACEHOLDER} alt="" className="guild-icon" />
        )}
        <span className="guild-name">{guild?.name || 'Select a server'}</span>
        <i className="fa-solid fa-right-left" />
      </button>

      <div className="sidebar-section-label">Manage Server</div>
      <ul className="nav-links">
        {NAV_ITEMS.map((item) => (
          <li
            key={item.key}
            className={activePage === item.key ? 'active' : ''}
            onClick={() => {
              onNavigate(item.key);
              onCloseMobile?.();
            }}
          >
            <i className={`fa-solid ${item.icon}`} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <div className="user-profile">
        <img src={user?.avatarUrl || DEFAULT_AVATAR} alt="" className="user-avatar" />
        <div className="user-info">
          <h4>{user?.username || 'Loading...'}</h4>
          <span className="logout-btn" onClick={onLogout}>Log out</span>
        </div>
      </div>
    </nav>
  );
}
