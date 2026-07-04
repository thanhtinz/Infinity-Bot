import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPut } from '../../lib/api';
import { clone, deepEqual, isAccessError, textChannels } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import ChannelSelect from '../../components/ChannelSelect';
import RoleSelect from '../../components/RoleSelect';
import Toggle from '../../components/Toggle';
import ConfirmButton from '../../components/ConfirmButton';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DEFAULT_BIRTHDAY_CONFIG = { channelId: null, roleId: null, message: 'Happy Birthday, {user}! 🎉' };
const DEFAULT_STARBOARD_CONFIG = { channelId: null, emoji: '⭐', threshold: 3, enabled: false };

function formatBirthday(day, month, year) {
  const name = MONTH_NAMES[month - 1] || 'Unknown';
  return year ? `${name} ${day}, ${year}` : `${name} ${day}`;
}

export default function Community({ guildId, meta, onAccessLost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [birthdayConfig, setBirthdayConfig] = useState(DEFAULT_BIRTHDAY_CONFIG);
  const [originalBirthdayConfig, setOriginalBirthdayConfig] = useState(DEFAULT_BIRTHDAY_CONFIG);
  const [birthdays, setBirthdays] = useState([]);
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [birthdayError, setBirthdayError] = useState(null);

  const [starboardConfig, setStarboardConfig] = useState(DEFAULT_STARBOARD_CONFIG);
  const [originalStarboardConfig, setOriginalStarboardConfig] = useState(DEFAULT_STARBOARD_CONFIG);
  const [savingStarboard, setSavingStarboard] = useState(false);
  const [starboardError, setStarboardError] = useState(null);

  const channels = textChannels(meta.channels);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [birthdayData, starboardData] = await Promise.all([
        apiGet(`/api/guilds/${guildId}/birthday`),
        apiGet(`/api/guilds/${guildId}/starboard`)
      ]);
      const bCfg = { ...DEFAULT_BIRTHDAY_CONFIG, ...(birthdayData.config || {}) };
      const sCfg = { ...DEFAULT_STARBOARD_CONFIG, ...(starboardData.config || {}) };
      setBirthdayConfig(clone(bCfg));
      setOriginalBirthdayConfig(clone(bCfg));
      setBirthdays(birthdayData.birthdays || []);
      setStarboardConfig(clone(sCfg));
      setOriginalStarboardConfig(clone(sCfg));
    } catch (err) {
      if (isAccessError(err)) {
        onAccessLost(err.message);
        return;
      }
      setError(err.message || 'Failed to load community settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  if (loading) return <Spinner label="Loading community settings..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const birthdayDirty = !deepEqual(birthdayConfig, originalBirthdayConfig);
  const starboardDirty = !deepEqual(starboardConfig, originalStarboardConfig);

  const saveBirthday = async () => {
    setBirthdayError(null);
    if (birthdayConfig.message && !birthdayConfig.message.includes('{user}')) {
      setBirthdayError('Message must contain a {user} placeholder.');
      return;
    }
    setSavingBirthday(true);
    try {
      const data = await apiPut(`/api/guilds/${guildId}/birthday`, birthdayConfig);
      const cfg = { ...DEFAULT_BIRTHDAY_CONFIG, ...(data.config || {}) };
      setBirthdayConfig(clone(cfg));
      setOriginalBirthdayConfig(clone(cfg));
    } catch (err) {
      setBirthdayError(err.message || 'Failed to save birthday settings.');
    } finally {
      setSavingBirthday(false);
    }
  };

  const removeBirthday = async (id) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/birthday/entries/${id}`);
      setBirthdays((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      setBirthdayError(err.message || 'Failed to remove birthday entry.');
    }
  };

  const saveStarboard = async () => {
    setStarboardError(null);
    setSavingStarboard(true);
    try {
      const data = await apiPut(`/api/guilds/${guildId}/starboard`, starboardConfig);
      const cfg = { ...DEFAULT_STARBOARD_CONFIG, ...(data.config || {}) };
      setStarboardConfig(clone(cfg));
      setOriginalStarboardConfig(clone(cfg));
    } catch (err) {
      setStarboardError(err.message || 'Failed to save starboard settings.');
    } finally {
      setSavingStarboard(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-cake-candles" />
          <h3>Birthday Announcements</h3>
        </div>
        <p className="control-hint">Members set their own birthday with the <code>/birthday set</code> command; this controls how it's announced.</p>

        {birthdayError && <div className="inline-notice inline-notice-error">{birthdayError}</div>}

        <div className="form-grid">
          <label className="config-item">
            <span className="label-sm">Announcement channel</span>
            <ChannelSelect channels={channels} value={birthdayConfig.channelId} onChange={(v) => setBirthdayConfig({ ...birthdayConfig, channelId: v })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Birthday role (optional)</span>
            <RoleSelect roles={meta.roles} value={birthdayConfig.roleId} onChange={(v) => setBirthdayConfig({ ...birthdayConfig, roleId: v })} />
          </label>
          <label className="config-item full-span">
            <span className="label-sm">Message (needs {'{user}'})</span>
            <textarea rows={2} value={birthdayConfig.message || ''} onChange={(e) => setBirthdayConfig({ ...birthdayConfig, message: e.target.value })} />
          </label>
        </div>

        <div className="card-footer-row">
          <span />
          {birthdayDirty && (
            <div className="inline-save-actions">
              <button type="button" className="btn-revert" onClick={() => setBirthdayConfig(clone(originalBirthdayConfig))} disabled={savingBirthday}>Revert</button>
              <button type="button" className="btn-save" onClick={saveBirthday} disabled={savingBirthday}>
                {savingBirthday ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        <div className="section-title">
          <i className="fa-solid fa-list" />
          <h3>Registered Birthdays</h3>
        </div>
        {birthdays.length === 0 ? (
          <EmptyState icon="fa-cake-candles" title="No birthdays saved yet" message="Members can set theirs with /birthday set." />
        ) : (
          <div className="rule-list">
            {birthdays.map((b) => (
              <div key={b.id} className="rule-row">
                <div className="rule-summary">
                  <strong>&lt;@{b.userId}&gt;</strong>
                  <p className="control-hint">{formatBirthday(b.day, b.month, b.year)}</p>
                </div>
                <ConfirmButton label="Remove" icon="fa-trash" onConfirm={() => removeBirthday(b.id)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-panel section-card">
        <div className="module-card-top">
          <div className="module-card-title">
            <i className="fa-solid fa-star" />
            <div>
              <span>Starboard</span>
              <p className="control-hint">Cross-posts messages that hit the reaction threshold into a dedicated channel.</p>
            </div>
          </div>
          <Toggle checked={!!starboardConfig.enabled} onChange={(v) => setStarboardConfig({ ...starboardConfig, enabled: v })} />
        </div>

        {starboardError && <div className="inline-notice inline-notice-error">{starboardError}</div>}

        <div className="form-grid">
          <label className="config-item">
            <span className="label-sm">Starboard channel</span>
            <ChannelSelect channels={channels} value={starboardConfig.channelId} onChange={(v) => setStarboardConfig({ ...starboardConfig, channelId: v })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Emoji</span>
            <input type="text" value={starboardConfig.emoji || ''} onChange={(e) => setStarboardConfig({ ...starboardConfig, emoji: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Threshold</span>
            <input
              type="number"
              min={1}
              value={starboardConfig.threshold}
              onChange={(e) => setStarboardConfig({ ...starboardConfig, threshold: Number(e.target.value) || 1 })}
            />
          </label>
        </div>

        <div className="card-footer-row">
          <span />
          {starboardDirty && (
            <div className="inline-save-actions">
              <button type="button" className="btn-revert" onClick={() => setStarboardConfig(clone(originalStarboardConfig))} disabled={savingStarboard}>Revert</button>
              <button type="button" className="btn-save" onClick={saveStarboard} disabled={savingStarboard}>
                {savingStarboard ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
