import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import GuildPicker from '../components/GuildPicker';
import Spinner from '../components/Spinner';
import { apiGet, apiPost } from '../lib/api';
import { GUILD_STORAGE_KEY, NAV_ITEMS } from '../lib/nav';
import { isAccessError } from '../lib/format';

import Overview from './guild/Overview';
import Moderation from './guild/Moderation';
import AutoModeration from './guild/AutoModeration';
import Protection from './guild/Protection';
import Tickets from './guild/Tickets';
import Shop from './guild/Shop';
import Giveaways from './guild/Giveaways';
import ReactionRoles from './guild/ReactionRoles';
import Welcome from './guild/Welcome';
import Logging from './guild/Logging';
import Settings from './guild/Settings';
import StatsChannels from './guild/StatsChannels';
import Verification from './guild/Verification';
import StickyNicknames from './guild/StickyNicknames';
import Community from './guild/Community';

const PAGE_COMPONENTS = {
  overview: Overview,
  moderation: Moderation,
  automod: AutoModeration,
  protection: Protection,
  tickets: Tickets,
  shop: Shop,
  giveaways: Giveaways,
  'reaction-roles': ReactionRoles,
  welcome: Welcome,
  'stats-channels': StatsChannels,
  verification: Verification,
  'sticky-nicknames': StickyNicknames,
  community: Community,
  logging: Logging,
  settings: Settings
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [guilds, setGuilds] = useState([]);
  const [selectedGuildId, setSelectedGuildId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerNotice, setPickerNotice] = useState(null);
  const [metaCache, setMetaCache] = useState({});
  const [metaError, setMetaError] = useState(null);
  const [activePage, setActivePage] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const me = await apiGet('/api/auth/me');
        const guildList = await apiGet('/api/guilds');
        if (cancelled) return;

        setUser(me);
        setGuilds(guildList || []);

        const savedId = localStorage.getItem(GUILD_STORAGE_KEY);
        const savedGuild = (guildList || []).find((g) => g.id === savedId && g.hasBot);

        if (savedGuild) {
          setSelectedGuildId(savedGuild.id);
          setShowPicker(false);
        } else {
          localStorage.removeItem(GUILD_STORAGE_KEY);
          setShowPicker(true);
        }
      } catch (err) {
        navigate('/login');
      } finally {
        if (!cancelled) setBooting(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const loadMeta = useCallback(async (guildId) => {
    setMetaError(null);
    try {
      const meta = await apiGet(`/api/guilds/${guildId}/meta`);
      setMetaCache((prev) => ({ ...prev, [guildId]: meta }));
    } catch (err) {
      if (isAccessError(err)) {
        localStorage.removeItem(GUILD_STORAGE_KEY);
        setSelectedGuildId(null);
        setShowPicker(true);
        setPickerNotice(err.message || 'You no longer have access to that server.');
      } else {
        setMetaError(err.message || 'Failed to load server data.');
      }
    }
  }, []);

  useEffect(() => {
    if (selectedGuildId && !metaCache[selectedGuildId]) {
      loadMeta(selectedGuildId);
    }
  }, [selectedGuildId, metaCache, loadMeta]);

  const handleSelectGuild = (guildId) => {
    localStorage.setItem(GUILD_STORAGE_KEY, guildId);
    setSelectedGuildId(guildId);
    setShowPicker(false);
    setPickerNotice(null);
    setActivePage('overview');
  };

  const handleSwitchServer = () => {
    setPickerNotice(null);
    setShowPicker(true);
  };

  const handleClosePicker = () => {
    if (selectedGuildId) setShowPicker(false);
  };

  const handleLogout = async () => {
    try {
      await apiPost('/api/auth/logout');
    } catch {
      // ignore, still redirect
    }
    localStorage.removeItem(GUILD_STORAGE_KEY);
    window.location.href = '/login';
  };

  const handleAccessLost = (message) => {
    localStorage.removeItem(GUILD_STORAGE_KEY);
    setSelectedGuildId(null);
    setShowPicker(true);
    setPickerNotice(message || 'You no longer have access to that server.');
  };

  if (booting) {
    return (
      <div className="loading-stage">
        <div className="loading-orb">
          <span>I</span>
        </div>
        <div className="loading-copy">
          <p className="topbar-eyebrow">Infinity Bot Control Surface</p>
          <h1>Syncing your dashboard</h1>
          <p>Checking your session and server access.</p>
        </div>
      </div>
    );
  }

  const currentGuild = guilds.find((g) => g.id === selectedGuildId);
  const meta = selectedGuildId ? metaCache[selectedGuildId] : null;
  const ActivePageComponent = PAGE_COMPONENTS[activePage] || Overview;
  const navMeta = NAV_ITEMS.find((item) => item.key === activePage);

  return (
    <div className="app-container">
      {showPicker && (
        <GuildPicker
          guilds={guilds}
          onSelect={handleSelectGuild}
          onClose={selectedGuildId ? handleClosePicker : undefined}
          notice={pickerNotice}
        />
      )}

      {selectedGuildId && (
        <>
          <Sidebar
            user={user}
            guild={currentGuild}
            activePage={activePage}
            onNavigate={setActivePage}
            onSwitchServer={handleSwitchServer}
            onLogout={handleLogout}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />

          <div className="main-content">
            <header className="topbar">
              <div className="topbar-left">
                <button
                  type="button"
                  className="btn-icon mobile-only"
                  onClick={() => setMobileOpen((v) => !v)}
                  aria-label="Toggle menu"
                >
                  <i className="fa-solid fa-bars" />
                </button>
                <div className="topbar-title-wrap">
                  <p className="topbar-eyebrow">{currentGuild?.name || 'Infinity Bot Dashboard'}</p>
                  <h1>{navMeta?.title || 'Dashboard'}</h1>
                </div>
              </div>
            </header>

            <div className="content-area">
              {!meta && !metaError && <Spinner label="Loading server data..." />}
              {metaError && (
                <div className="state-block state-error glass-panel">
                  <div className="state-icon">
                    <i className="fa-solid fa-triangle-exclamation" />
                  </div>
                  <h3>Unable to load server data</h3>
                  <p>{metaError}</p>
                  <button type="button" className="btn-secondary" onClick={() => loadMeta(selectedGuildId)}>
                    <i className="fa-solid fa-rotate-right" /> Retry
                  </button>
                </div>
              )}
              {meta && (
                <ActivePageComponent guildId={selectedGuildId} meta={meta} onAccessLost={handleAccessLost} />
              )}
            </div>
          </div>
        </>
      )}

      {!selectedGuildId && !showPicker && <Spinner label="Loading..." />}
    </div>
  );
}
