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
import RoleSelect from '../../components/RoleSelect';
import TagInput from '../../components/TagInput';
import ConfirmButton from '../../components/ConfirmButton';

const PUNISHMENTS = ['delete', 'warn', 'mute', 'kick', 'ban'];

const MODULES = [
  { key: 'antiSpam', label: 'Anti Spam', icon: 'fa-gauge-high', desc: 'Stops message bursts from flooding chat.', fields: ['spamThreshold', 'spamInterval'] },
  { key: 'antiLink', label: 'Anti Link', icon: 'fa-link-slash', desc: 'Blocks unapproved links posted in chat.' },
  { key: 'antiInvite', label: 'Anti Invite', icon: 'fa-user-group', desc: 'Blocks Discord server invite links.' },
  { key: 'antiBadWords', label: 'Anti Bad Words', icon: 'fa-comment-slash', desc: 'Filters the configured bad-word list.' },
  { key: 'antiMassMention', label: 'Anti Mass Mention', icon: 'fa-at', desc: 'Blocks mention-raid style spam.', fields: ['mentionLimit'] },
  { key: 'antiCaps', label: 'Anti Caps', icon: 'fa-font', desc: 'Catches excessive all-caps messages.', fields: ['capsPercentage', 'capsMinLength'] },
  { key: 'antiPing', label: 'Anti Ping', icon: 'fa-bell-slash', desc: 'Limits repeated pings toward members.' }
];

const WHITELIST_MODULES = MODULES.filter((m) => m.key !== 'antiPing').map((m) => m.key);

const FIELD_LABELS = {
  spamThreshold: 'Messages before triggering',
  spamInterval: 'Interval window (seconds)',
  mentionLimit: 'Mention limit per message',
  capsPercentage: 'Caps percentage threshold',
  capsMinLength: 'Minimum message length'
};

export default function AutoModeration({ guildId, meta, onAccessLost }) {
  const { config, setConfig, loading, error, saving, setSaving, dirty, reload, revert, commit } = useConfigForm(
    () => apiGet(`/api/guilds/${guildId}/automod`),
    [guildId]
  );
  const [whitelistError, setWhitelistError] = useState(null);
  const [newEntry, setNewEntry] = useState({ targetId: '', targetType: 'user', modules: [] });
  const [addingEntry, setAddingEntry] = useState(false);

  const channels = textChannels(meta.channels);

  if (loading) return <Spinner label="Loading auto-moderation config..." />;
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
    updateCfg({ [key]: value === '' ? null : Number.isNaN(n) ? cfg[key] : n });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const updated = await apiPut(`/api/guilds/${guildId}/automod`, cfg);
      commit({ config: updated.config, whitelist });
    } catch (err) {
      setWhitelistError(err.message || 'Failed to save auto-moderation settings.');
    } finally {
      setSaving(false);
    }
  };

  const addWhitelistEntry = async () => {
    setWhitelistError(null);
    if (newEntry.targetType === 'user' && !isValidSnowflake(newEntry.targetId)) {
      setWhitelistError('Enter a valid Discord user ID (15-22 digits).');
      return;
    }
    if (newEntry.targetType !== 'user' && !newEntry.targetId) {
      setWhitelistError('Choose a target from the dropdown.');
      return;
    }
    setAddingEntry(true);
    try {
      const created = await apiPost(`/api/guilds/${guildId}/automod/whitelist`, newEntry);
      setConfig((prev) => ({ ...prev, whitelist: [...(prev.whitelist || []), created] }));
      commit({ config: cfg, whitelist: [...whitelist, created] });
      setNewEntry({ targetId: '', targetType: 'user', modules: [] });
    } catch (err) {
      setWhitelistError(err.message || 'Failed to add whitelist entry.');
    } finally {
      setAddingEntry(false);
    }
  };

  const removeWhitelistEntry = async (entryId) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/automod/whitelist/${entryId}`);
      const next = whitelist.filter((w) => w.id !== entryId);
      setConfig((prev) => ({ ...prev, whitelist: next }));
      commit({ config: cfg, whitelist: next });
    } catch (err) {
      setWhitelistError(err.message || 'Failed to remove whitelist entry.');
    }
  };

  const toggleNewEntryModule = (moduleKey) => {
    setNewEntry((prev) => ({
      ...prev,
      modules: prev.modules.includes(moduleKey)
        ? prev.modules.filter((m) => m !== moduleKey)
        : [...prev.modules, moduleKey]
    }));
  };

  return (
    <div className="page-stack">
      <section className="glass-panel section-card automod-header">
        <div className="header-info">
          <h3>Auto Moderation</h3>
          <p className="control-hint">Master switch and defaults used by every module below.</p>
        </div>
        <Toggle checked={!!cfg.enabled} onChange={(v) => updateCfg({ enabled: v })} />
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-gear" />
          <h3>Defaults</h3>
        </div>
        <div className="form-grid">
          <label className="config-item">
            <span className="label-sm">Log channel</span>
            <ChannelSelect channels={channels} value={cfg.logChannelId} onChange={(v) => updateCfg({ logChannelId: v })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Default punishment</span>
            <select className="control-select" value={cfg.punishment || 'warn'} onChange={(e) => updateCfg({ punishment: e.target.value })}>
              {PUNISHMENTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="config-item">
            <span className="label-sm">Mute duration</span>
            <input type="text" placeholder="e.g. 10m" value={cfg.muteDuration || ''} onChange={(e) => updateCfg({ muteDuration: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-bolt-lightning" />
          <h3>Defense Modules</h3>
        </div>
        <div className="module-grid">
          {MODULES.map((mod) => {
            const enabled = !!cfg[mod.key];
            const punishKey = `${mod.key}Punishment`;
            return (
              <div key={mod.key} className={`module-card ${enabled ? 'active' : ''}`}>
                <div className="module-card-top">
                  <div className="module-card-title">
                    <i className={`fa-solid ${mod.icon}`} />
                    <div>
                      <span>{mod.label}</span>
                      <p className="control-hint">{mod.desc}</p>
                    </div>
                  </div>
                  <Toggle size="sm" checked={enabled} onChange={(v) => updateCfg({ [mod.key]: v })} />
                </div>
                <div className="module-card-body">
                  <label className="config-item">
                    <span className="label-sm">Punishment</span>
                    <select
                      className="control-select"
                      value={cfg[punishKey] || 'delete'}
                      onChange={(e) => updateCfg({ [punishKey]: e.target.value })}
                    >
                      {PUNISHMENTS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  {(mod.fields || []).map((field) => (
                    <label key={field} className="config-item">
                      <span className="label-sm">{FIELD_LABELS[field] || field}</span>
                      <input
                        type="number"
                        min="0"
                        value={cfg[field] ?? ''}
                        onChange={(e) => numberField(field, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-comment-slash" />
          <h3>Bad Words List</h3>
        </div>
        <TagInput
          tags={cfg.badWords || []}
          onAdd={(word) => updateCfg({ badWords: [...(cfg.badWords || []), word] })}
          onRemove={(index) => updateCfg({ badWords: (cfg.badWords || []).filter((_, i) => i !== index) })}
          placeholder="Add a filtered word or phrase"
        />
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-user-check" />
          <h3>Whitelist</h3>
        </div>
        <p className="control-hint">Exempt a user, role, or channel from some or all automod modules.</p>

        {whitelistError && <div className="inline-notice inline-notice-error">{whitelistError}</div>}

        {whitelist.length === 0 ? (
          <EmptyState icon="fa-user-check" title="No whitelist entries" message="Add one below to exempt a role, channel, or user." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Type</th>
                  <th>Exempt modules</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {whitelist.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Target">{resolveTargetLabel(entry, meta)}</td>
                    <td data-label="Type">{entry.targetType}</td>
                    <td data-label="Exempt modules">
                      {entry.modules && entry.modules.length > 0 ? entry.modules.join(', ') : 'All modules'}
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
            <span className="label-sm">Target type</span>
            <select
              className="control-select"
              value={newEntry.targetType}
              onChange={(e) => setNewEntry({ ...newEntry, targetType: e.target.value, targetId: '' })}
            >
              <option value="user">User</option>
              <option value="role">Role</option>
              <option value="channel">Channel</option>
            </select>
          </label>
          {newEntry.targetType === 'user' && (
            <label className="config-item">
              <span className="label-sm">User ID</span>
              <input
                type="text"
                placeholder="Paste a Discord user ID"
                value={newEntry.targetId}
                onChange={(e) => setNewEntry({ ...newEntry, targetId: e.target.value.trim() })}
              />
            </label>
          )}
          {newEntry.targetType === 'role' && (
            <label className="config-item">
              <span className="label-sm">Role</span>
              <RoleSelect roles={meta.roles} value={newEntry.targetId} onChange={(v) => setNewEntry({ ...newEntry, targetId: v })} />
            </label>
          )}
          {newEntry.targetType === 'channel' && (
            <label className="config-item">
              <span className="label-sm">Channel</span>
              <ChannelSelect channels={channels} value={newEntry.targetId} onChange={(v) => setNewEntry({ ...newEntry, targetId: v })} />
            </label>
          )}
          <div className="config-item">
            <span className="label-sm">Exempt from (blank = all)</span>
            <div className="multi-check-list">
              {WHITELIST_MODULES.map((moduleKey) => (
                <label key={moduleKey} className="multi-check-row">
                  <input
                    type="checkbox"
                    checked={newEntry.modules.includes(moduleKey)}
                    onChange={() => toggleNewEntryModule(moduleKey)}
                  />
                  <span>{moduleKey}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="button" className="btn-secondary" onClick={addWhitelistEntry} disabled={addingEntry}>
            <i className="fa-solid fa-plus" /> {addingEntry ? 'Adding...' : 'Add entry'}
          </button>
        </div>
      </section>

      <SaveBar visible={dirty} saving={saving} onRevert={revert} onSave={saveAll} />
    </div>
  );
}

function resolveTargetLabel(entry, meta) {
  if (entry.targetType === 'role') {
    const role = (meta.roles || []).find((r) => r.id === entry.targetId);
    return role ? `@${role.name}` : entry.targetId;
  }
  if (entry.targetType === 'channel') {
    const channel = (meta.channels || []).find((c) => c.id === entry.targetId);
    return channel ? `#${channel.name}` : entry.targetId;
  }
  return entry.targetId;
}
