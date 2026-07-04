import { useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api';
import { useConfigForm } from '../../lib/useConfigForm';
import { isAccessError, isValidSnowflake, textChannels } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import SaveBar from '../../components/SaveBar';
import Toggle from '../../components/Toggle';
import ChannelSelect from '../../components/ChannelSelect';
import ConfirmButton from '../../components/ConfirmButton';

const PUNISHMENTS = ['stripall', 'kick', 'ban'];

const MONITORS = [
  ['antiBan', 'Anti Ban', 'fa-gavel'],
  ['antiKick', 'Anti Kick', 'fa-shoe-prints'],
  ['antiChannelCreate', 'Anti Channel Create', 'fa-square-plus'],
  ['antiChannelDelete', 'Anti Channel Delete', 'fa-square-minus'],
  ['antiChannelEdit', 'Anti Channel Edit', 'fa-pen'],
  ['antiRoleCreate', 'Anti Role Create', 'fa-user-plus'],
  ['antiRoleDelete', 'Anti Role Delete', 'fa-user-minus'],
  ['antiRoleUpdate', 'Anti Role Update', 'fa-user-pen'],
  ['antiWebhook', 'Anti Webhook', 'fa-plug'],
  ['antiBot', 'Anti Bot', 'fa-robot'],
  ['antiGuildUpdate', 'Anti Guild Update', 'fa-gear'],
  ['antiEmoji', 'Anti Emoji', 'fa-face-smile']
];

const EVENT_LABELS = {
  ban: 'Anti Ban',
  kick: 'Anti Kick',
  channel_create: 'Anti Channel Create',
  channel_delete: 'Anti Channel Delete',
  role_create: 'Anti Role Create',
  role_delete: 'Anti Role Delete',
  role_update: 'Anti Role Update',
  webhook_create: 'Anti Webhook',
  bot_add: 'Anti Bot',
  guild_update: 'Anti Guild Update'
};
const EVENT_KEYS = Object.keys(EVENT_LABELS);

export default function Protection({ guildId, meta, onAccessLost }) {
  const { config, setConfig, loading, error, saving, setSaving, dirty, reload, revert, commit } = useConfigForm(
    () => apiGet(`/api/guilds/${guildId}/antinuke`),
    [guildId]
  );
  const [whitelistError, setWhitelistError] = useState(null);
  const [newUserId, setNewUserId] = useState('');
  const [exemptAll, setExemptAll] = useState(false);
  const [newEvents, setNewEvents] = useState([]);
  const [addingEntry, setAddingEntry] = useState(false);

  const channels = textChannels(meta.channels);

  if (loading) return <Spinner label="Loading protection config..." />;
  if (error) {
    if (isAccessError(error)) {
      onAccessLost(error.message);
      return null;
    }
    return <ErrorState message={error.message || error} onRetry={reload} />;
  }
  if (!config) return null;

  const cfg = config.config || {};
  const whitelist = config.whitelist || [];

  const updateCfg = (patch) => {
    setConfig((prev) => ({ ...prev, config: { ...(prev.config || {}), ...patch } }));
  };

  const numberField = (key, value) => {
    const n = Number(value);
    updateCfg({ [key]: value === '' ? null : Number.isNaN(n) || n < 0 ? cfg[key] : n });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const updated = await apiPut(`/api/guilds/${guildId}/antinuke`, cfg);
      commit({ config: updated.config, whitelist });
    } catch (err) {
      setWhitelistError(err.message || 'Failed to save protection settings.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEvent = (key) => {
    setNewEvents((prev) => (prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key]));
  };

  const addWhitelistEntry = async () => {
    setWhitelistError(null);
    if (!isValidSnowflake(newUserId)) {
      setWhitelistError('Enter a valid Discord user ID (15-22 digits).');
      return;
    }
    setAddingEntry(true);
    try {
      const created = await apiPost(`/api/guilds/${guildId}/antinuke/whitelist`, {
        userId: newUserId.trim(),
        events: exemptAll ? null : newEvents
      });
      const next = [...whitelist, created];
      setConfig((prev) => ({ ...prev, whitelist: next }));
      commit({ config: cfg, whitelist: next });
      setNewUserId('');
      setNewEvents([]);
      setExemptAll(false);
    } catch (err) {
      setWhitelistError(err.message || 'Failed to add whitelist entry.');
    } finally {
      setAddingEntry(false);
    }
  };

  const removeWhitelistEntry = async (entryId) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/antinuke/whitelist/${entryId}`);
      const next = whitelist.filter((w) => w.id !== entryId);
      setConfig((prev) => ({ ...prev, whitelist: next }));
      commit({ config: cfg, whitelist: next });
    } catch (err) {
      setWhitelistError(err.message || 'Failed to remove whitelist entry.');
    }
  };

  return (
    <div className="page-stack">
      <section className="glass-panel section-card automod-header">
        <div className="header-info">
          <h3>Protection (Anti-Nuke)</h3>
          <p className="control-hint">Detects and punishes abrupt destructive actions from compromised accounts.</p>
        </div>
        <Toggle checked={!!cfg.enabled} onChange={(v) => updateCfg({ enabled: v })} />
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-gauge" />
          <h3>Trigger Rules</h3>
        </div>
        <div className="form-grid">
          <label className="config-item">
            <span className="label-sm">Threshold (actions)</span>
            <input type="number" min="1" value={cfg.threshold ?? ''} onChange={(e) => numberField('threshold', e.target.value)} />
          </label>
          <label className="config-item">
            <span className="label-sm">Timeframe (seconds)</span>
            <input type="number" min="1" value={cfg.timeframe ?? ''} onChange={(e) => numberField('timeframe', e.target.value)} />
          </label>
          <label className="config-item">
            <span className="label-sm">Punishment</span>
            <select className="control-select" value={cfg.punishment || 'kick'} onChange={(e) => updateCfg({ punishment: e.target.value })}>
              {PUNISHMENTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="config-item">
            <span className="label-sm">Log channel</span>
            <ChannelSelect channels={channels} value={cfg.logChannelId} onChange={(v) => updateCfg({ logChannelId: v })} />
          </label>
        </div>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-shield-halved" />
          <h3>Monitors</h3>
        </div>
        <div className="toggle-card-grid">
          {MONITORS.map(([key, label, icon]) => (
            <label key={key} className={`toggle-card ${cfg[key] ? 'active' : ''}`}>
              <div className="action-info">
                <i className={`fa-solid ${icon}`} />
                <span>{label}</span>
              </div>
              <Toggle size="sm" checked={!!cfg[key]} onChange={(v) => updateCfg({ [key]: v })} />
            </label>
          ))}
        </div>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-user-check" />
          <h3>Whitelist</h3>
        </div>
        <p className="control-hint">Trusted users exempt from anti-nuke punishment for the events selected.</p>

        {whitelistError && <div className="inline-notice inline-notice-error">{whitelistError}</div>}

        {whitelist.length === 0 ? (
          <EmptyState icon="fa-user-check" title="No whitelist entries" message="Add a trusted user ID below." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Added by</th>
                  <th>Exempt events</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {whitelist.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="User ID">{entry.userId}</td>
                    <td data-label="Added by">{entry.addedBy || '—'}</td>
                    <td data-label="Exempt events">
                      {entry.events === null || entry.events === undefined
                        ? 'All events'
                        : entry.events.map((e) => EVENT_LABELS[e] || e).join(', ') || 'None'}
                    </td>
                    <td data-label="">
                      <ConfirmButton label="Remove" icon="fa-trash" onConfirm={() => removeWhitelistEntry(entry.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="add-entry-form">
          <label className="config-item">
            <span className="label-sm">User ID</span>
            <input
              type="text"
              placeholder="Paste a Discord user ID"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value.trim())}
            />
          </label>
          <label className="config-item inline-check">
            <span className="label-sm">Whitelist from everything</span>
            <input type="checkbox" checked={exemptAll} onChange={(e) => setExemptAll(e.target.checked)} />
          </label>
          {!exemptAll && (
            <div className="config-item">
              <span className="label-sm">Exempt from these events</span>
              <div className="multi-check-list">
                {EVENT_KEYS.map((key) => (
                  <label key={key} className="multi-check-row">
                    <input type="checkbox" checked={newEvents.includes(key)} onChange={() => toggleEvent(key)} />
                    <span>{EVENT_LABELS[key]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <button type="button" className="btn-secondary" onClick={addWhitelistEntry} disabled={addingEntry}>
            <i className="fa-solid fa-plus" /> {addingEntry ? 'Adding...' : 'Add entry'}
          </button>
        </div>
      </section>

      <SaveBar visible={dirty} saving={saving} onRevert={revert} onSave={saveAll} />
    </div>
  );
}
