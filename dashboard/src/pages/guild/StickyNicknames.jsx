import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '../../lib/api';
import { formatDate, isAccessError, isValidSnowflake } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import ConfirmButton from '../../components/ConfirmButton';

export default function StickyNicknames({ guildId, onAccessLost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [userId, setUserId] = useState('');
  const [nickname, setNickname] = useState('');
  const [addError, setAddError] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/guilds/${guildId}/sticky-nicknames`);
      setRows(data || []);
    } catch (err) {
      if (isAccessError(err)) {
        onAccessLost(err.message);
        return;
      }
      setError(err.message || 'Failed to load sticky nicknames.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  if (loading) return <Spinner label="Loading sticky nicknames..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const addSticky = async () => {
    setAddError(null);
    if (!isValidSnowflake(userId)) {
      setAddError('Enter a valid Discord user ID.');
      return;
    }
    if (!nickname.trim()) {
      setAddError('Nickname is required.');
      return;
    }
    setAdding(true);
    try {
      const created = await apiPost(`/api/guilds/${guildId}/sticky-nicknames`, { userId: userId.trim(), nickname: nickname.trim() });
      setRows((prev) => [created, ...prev.filter((r) => r.userId !== created.userId)]);
      setUserId('');
      setNickname('');
    } catch (err) {
      setAddError(err.message || 'Failed to set sticky nickname.');
    } finally {
      setAdding(false);
    }
  };

  const removeSticky = async (id) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/sticky-nicknames/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setAddError(err.message || 'Failed to remove sticky nickname.');
    }
  };

  return (
    <div className="page-stack">
      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-id-badge" />
          <h3>Sticky Nicknames</h3>
        </div>
        <p className="control-hint">
          The bot reapplies these nicknames automatically whenever a member tries to change them.
        </p>

        {addError && <div className="inline-notice inline-notice-error">{addError}</div>}

        {rows.length === 0 ? (
          <EmptyState icon="fa-id-badge" title="No sticky nicknames yet" message="Add one below to enforce a member's nickname." />
        ) : (
          <div className="rule-list">
            {rows.map((row) => (
              <div key={row.id} className="rule-row">
                <div className="rule-summary">
                  <strong>&lt;@{row.userId}&gt; — {row.nickname}</strong>
                  <p className="control-hint">
                    Set by {row.setById ? `<@${row.setById}>` : 'unknown'} · {formatDate(row.createdAt)}
                  </p>
                </div>
                <ConfirmButton label="Remove" icon="fa-trash" onConfirm={() => removeSticky(row.id)} />
              </div>
            ))}
          </div>
        )}

        <div className="add-entry-form">
          <label className="config-item">
            <span className="label-sm">User ID</span>
            <input type="text" placeholder="Discord user ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
          <label className="config-item">
            <span className="label-sm">Nickname</span>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </label>
          <button type="button" className="btn-secondary" onClick={addSticky} disabled={adding}>
            <i className="fa-solid fa-plus" /> {adding ? 'Setting...' : 'Set sticky nickname'}
          </button>
        </div>
      </section>
    </div>
  );
}
