import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '../../lib/api';
import { isAccessError, voiceChannels } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import ChannelSelect from '../../components/ChannelSelect';
import RoleSelect from '../../components/RoleSelect';
import ConfirmButton from '../../components/ConfirmButton';

const TYPE_OPTIONS = [
  { value: 'members', label: 'Members' },
  { value: 'humans', label: 'Humans' },
  { value: 'bots', label: 'Bots' },
  { value: 'boosts', label: 'Boosts' },
  { value: 'roleCount', label: 'Role Count' }
];

function emptyDraft() {
  return { type: 'members', channelId: '', roleId: '', nameTemplate: '' };
}

export default function StatsChannels({ guildId, meta, onAccessLost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState(emptyDraft());
  const [addError, setAddError] = useState(null);
  const [adding, setAdding] = useState(false);

  const channels = voiceChannels(meta.channels);
  const channelName = (id) => channels.find((c) => c.id === id)?.name || id;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/guilds/${guildId}/stats-channels`);
      setRows(data || []);
    } catch (err) {
      if (isAccessError(err)) {
        onAccessLost(err.message);
        return;
      }
      setError(err.message || 'Failed to load stats channels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  if (loading) return <Spinner label="Loading stats channels..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const addChannel = async () => {
    setAddError(null);
    if (!draft.channelId) {
      setAddError('Pick a voice channel.');
      return;
    }
    if (draft.type === 'roleCount' && !draft.roleId) {
      setAddError('A role is required for the Role Count type.');
      return;
    }
    setAdding(true);
    try {
      const created = await apiPost(`/api/guilds/${guildId}/stats-channels`, {
        type: draft.type,
        channelId: draft.channelId,
        roleId: draft.type === 'roleCount' ? draft.roleId : null,
        nameTemplate: draft.nameTemplate.trim() || undefined
      });
      setRows((prev) => [...prev, created]);
      setDraft(emptyDraft());
    } catch (err) {
      setAddError(err.message || 'Failed to add stats channel.');
    } finally {
      setAdding(false);
    }
  };

  const removeChannel = async (id) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/stats-channels/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setAddError(err.message || 'Failed to remove stats channel.');
    }
  };

  return (
    <div className="page-stack">
      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-chart-line" />
          <h3>Stats Channels</h3>
        </div>
        <p className="control-hint">
          Voice channels whose name auto-updates with a live count. They refresh roughly every 10 minutes due to Discord rate limits.
        </p>

        {addError && <div className="inline-notice inline-notice-error">{addError}</div>}

        {rows.length === 0 ? (
          <EmptyState icon="fa-chart-line" title="No stats channels yet" message="Add one below to start tracking a live count." />
        ) : (
          <div className="rule-list">
            {rows.map((row) => (
              <div key={row.id} className="rule-row">
                <div className="rule-summary">
                  <strong>#{channelName(row.channelId)} — {TYPE_OPTIONS.find((t) => t.value === row.type)?.label || row.type}</strong>
                  <p className="control-hint">
                    Template: <code>{row.nameTemplate}</code>
                    {row.roleId ? ` · Role: ${row.roleId}` : ''}
                  </p>
                </div>
                <ConfirmButton label="Remove" icon="fa-trash" onConfirm={() => removeChannel(row.id)} />
              </div>
            ))}
          </div>
        )}

        <div className="add-entry-form">
          <label className="config-item">
            <span className="label-sm">Type</span>
            <select className="control-select" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="config-item">
            <span className="label-sm">Voice channel</span>
            <ChannelSelect
              channels={channels}
              value={draft.channelId}
              onChange={(v) => setDraft({ ...draft, channelId: v })}
              placeholder="Select a voice channel"
            />
          </label>
          {draft.type === 'roleCount' && (
            <label className="config-item">
              <span className="label-sm">Role</span>
              <RoleSelect roles={meta.roles} value={draft.roleId} onChange={(v) => setDraft({ ...draft, roleId: v })} />
            </label>
          )}
          <label className="config-item">
            <span className="label-sm">Template (optional, needs {'{count}'})</span>
            <input
              type="text"
              placeholder="Members: {count}"
              value={draft.nameTemplate}
              onChange={(e) => setDraft({ ...draft, nameTemplate: e.target.value })}
            />
          </label>
          <button type="button" className="btn-secondary" onClick={addChannel} disabled={adding}>
            <i className="fa-solid fa-plus" /> {adding ? 'Adding...' : 'Add stats channel'}
          </button>
        </div>
      </section>
    </div>
  );
}
