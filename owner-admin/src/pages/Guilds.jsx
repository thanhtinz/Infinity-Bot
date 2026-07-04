import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiGet } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';

export default function Guilds() {
  const [guilds, setGuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingGuild, setPendingGuild] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/guilds');
      setGuilds(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load guilds');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLeave() {
    if (!pendingGuild) return;
    setBusy(true);
    try {
      await apiDelete(`/api/guilds/${pendingGuild.id}`);
      setGuilds((prev) => prev.filter((g) => g.id !== pendingGuild.id));
      setPendingGuild(null);
    } catch (err) {
      setError(err.message || 'Failed to leave guild');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 className="mb-4">Guilds</h3>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div className="text-secondary">Loading…</div>}

      {!loading && (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: '48px' }} />
                  <th>Name</th>
                  <th>Guild ID</th>
                  <th>Members</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {guilds.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4">The bot is not in any servers.</td>
                  </tr>
                )}
                {guilds.map((guild) => (
                  <tr key={guild.id}>
                    <td>
                      {guild.icon ? (
                        <img src={guild.icon} alt="" width="32" height="32" className="rounded-circle" />
                      ) : (
                        <i className="bi bi-hdd-network text-secondary fs-5" />
                      )}
                    </td>
                    <td>{guild.name}</td>
                    <td className="text-secondary small">{guild.id}</td>
                    <td>{guild.memberCount ?? '—'}</td>
                    <td className="text-end">
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setPendingGuild(guild)}>
                        Leave
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        show={!!pendingGuild}
        title="Leave this server?"
        body={pendingGuild ? `The bot will immediately leave "${pendingGuild.name}". This cannot be undone from here - the server would need to re-invite the bot.` : ''}
        confirmLabel="Leave Server"
        confirmVariant="danger"
        busy={busy}
        onConfirm={handleLeave}
        onCancel={() => setPendingGuild(null)}
      />
    </div>
  );
}
