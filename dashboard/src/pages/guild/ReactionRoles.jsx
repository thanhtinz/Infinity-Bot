import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPut } from '../../lib/api';
import { clone, deepEqual, hexToInt, intToHex, isAccessError } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import SaveBar from '../../components/SaveBar';
import Toggle from '../../components/Toggle';
import RoleSelect from '../../components/RoleSelect';
import ConfirmButton from '../../components/ConfirmButton';

function ReactionRoleCard({ entry, roles, guildId, onSaved, onDeleted }) {
  const [draft, setDraft] = useState(clone(entry));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const dirty = !deepEqual(draft, entry);

  const update = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const updatePair = (index, patch) => {
    update({
      emojiRolePairs: draft.emojiRolePairs.map((pair, i) => (i === index ? { ...pair, ...patch } : pair))
    });
  };

  const removePair = (index) => {
    update({ emojiRolePairs: draft.emojiRolePairs.filter((_, i) => i !== index) });
  };

  const addPair = () => {
    update({ emojiRolePairs: [...(draft.emojiRolePairs || []), { emoji: '', roleId: '', roleLabel: '' }] });
  };

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const updated = await apiPut(`/api/guilds/${guildId}/reaction-roles/${entry.id}`, {
        embedTitle: draft.embedTitle,
        embedDescription: draft.embedDescription,
        embedColor: draft.embedColor,
        embedThumbnailUrl: draft.embedThumbnailUrl,
        emojiRolePairs: draft.emojiRolePairs,
        enabled: draft.enabled
      });
      onSaved(updated);
      setDraft(clone(updated));
    } catch (error) {
      setErr(error.message || 'Failed to save reaction role message.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-panel section-card reaction-role-card">
      <div className="module-card-top">
        <div className="module-card-title">
          <i className="fa-solid fa-at" />
          <div>
            <span>{draft.embedTitle || 'Untitled reaction role message'}</span>
            <p className="control-hint">Channel {draft.channelId} · Message {draft.messageId}</p>
          </div>
        </div>
        <Toggle checked={!!draft.enabled} onChange={(v) => update({ enabled: v })} />
      </div>

      {err && <div className="inline-notice inline-notice-error">{err}</div>}

      <div className="form-grid">
        <label className="config-item">
          <span className="label-sm">Embed title</span>
          <input type="text" value={draft.embedTitle || ''} onChange={(e) => update({ embedTitle: e.target.value })} />
        </label>
        <label className="config-item">
          <span className="label-sm">Embed color</span>
          <input type="color" value={intToHex(draft.embedColor)} onChange={(e) => update({ embedColor: hexToInt(e.target.value) })} />
        </label>
        <label className="config-item full-span">
          <span className="label-sm">Embed description</span>
          <textarea rows={2} value={draft.embedDescription || ''} onChange={(e) => update({ embedDescription: e.target.value })} />
        </label>
        <label className="config-item">
          <span className="label-sm">Thumbnail URL</span>
          <input type="text" value={draft.embedThumbnailUrl || ''} onChange={(e) => update({ embedThumbnailUrl: e.target.value })} />
        </label>
      </div>

      <div className="section-title">
        <i className="fa-solid fa-list" />
        <h3>Emoji → Role Pairs</h3>
      </div>
      {(draft.emojiRolePairs || []).length === 0 ? (
        <p className="control-hint">No emoji-role pairs configured.</p>
      ) : (
        <div className="rule-list">
          {draft.emojiRolePairs.map((pair, index) => (
            <div key={index} className="rule-row">
              <label className="config-item">
                <span className="label-sm">Emoji</span>
                <input type="text" value={pair.emoji || ''} onChange={(e) => updatePair(index, { emoji: e.target.value })} />
              </label>
              <label className="config-item">
                <span className="label-sm">Role</span>
                <RoleSelect
                  roles={roles}
                  value={pair.roleId}
                  onChange={(roleId) => {
                    const role = roles.find((r) => r.id === roleId);
                    updatePair(index, { roleId, roleLabel: role?.name || pair.roleLabel });
                  }}
                />
              </label>
              <button type="button" className="btn-icon" onClick={() => removePair(index)} aria-label="Remove pair">
                <i className="fa-solid fa-trash" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn-secondary" onClick={addPair}>
        <i className="fa-solid fa-plus" /> Add pair
      </button>

      <div className="card-footer-row">
        <ConfirmButton label="Delete message" icon="fa-trash" onConfirm={() => onDeleted(entry.id)} />
        {dirty && (
          <div className="inline-save-actions">
            <button type="button" className="btn-revert" onClick={() => setDraft(clone(entry))} disabled={saving}>Revert</button>
            <button type="button" className="btn-save" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReactionRoles({ guildId, meta, onAccessLost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entries, setEntries] = useState([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/guilds/${guildId}/reaction-roles`);
      setEntries(data || []);
    } catch (err) {
      if (isAccessError(err)) {
        onAccessLost(err.message);
        return;
      }
      setError(err.message || 'Failed to load reaction roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const handleSaved = (updated) => {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  const handleDeleted = async (id) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/reaction-roles/${id}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete reaction role message.');
    }
  };

  if (loading) return <Spinner label="Loading reaction roles..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="page-stack">
      <p className="control-hint page-note">
        Creating a brand-new reaction-role message happens via a Discord command since it must physically post a message.
        This page manages existing ones.
      </p>
      {entries.length === 0 ? (
        <EmptyState icon="fa-at" title="No reaction role messages yet" message="Use a Discord command to post your first reaction-role message." />
      ) : (
        entries.map((entry) => (
          <ReactionRoleCard
            key={entry.id}
            entry={entry}
            roles={meta.roles}
            guildId={guildId}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        ))
      )}
    </div>
  );
}
