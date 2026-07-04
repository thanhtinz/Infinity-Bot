import { useEffect, useState } from 'react';
import { apiDelete, apiGet } from '../../lib/api';
import { formatDate, isAccessError, relativeTimeFromNow } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import ConfirmButton from '../../components/ConfirmButton';

export default function Giveaways({ guildId, onAccessLost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [giveaways, setGiveaways] = useState([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/guilds/${guildId}/giveaways`);
      setGiveaways([...(data || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch (err) {
      if (isAccessError(err)) {
        onAccessLost(err.message);
        return;
      }
      setError(err.message || 'Failed to load giveaways.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const cancelGiveaway = async (id) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/giveaways/${id}`);
      setGiveaways((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to cancel giveaway.');
    }
  };

  if (loading) return <Spinner label="Loading giveaways..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="page-stack">
      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-gift" />
          <h3>Giveaways</h3>
        </div>
        <p className="control-hint">
          Giveaways are created via Discord slash commands — this page is for oversight and cleanup only.
        </p>

        {giveaways.length === 0 ? (
          <EmptyState icon="fa-gift" title="No giveaways yet" message="Run a giveaway slash command in Discord to see it appear here." />
        ) : (
          <div className="card-grid">
            {giveaways.map((g) => (
              <div key={g.id} className="mini-card">
                <div className="mini-card-top">
                  <h4>{g.prize}</h4>
                  <span className={`status-badge ${g.ended ? 'status-off' : 'status-on'}`}>
                    {g.ended ? 'Ended' : 'Active'}
                  </span>
                </div>
                <div className="mini-card-meta">
                  <span><i className="fa-solid fa-trophy" /> {g.winners} winner{g.winners === 1 ? '' : 's'}</span>
                  <span><i className="fa-solid fa-users" /> {g.entryCount ?? 0} entries</span>
                  <span><i className="fa-solid fa-clock" /> Ends {formatDate(g.endTime)} ({relativeTimeFromNow(g.endTime)})</span>
                  <span><i className="fa-solid fa-hashtag" /> {g.channelId}</span>
                </div>
                <ConfirmButton label="Cancel giveaway" icon="fa-ban" onConfirm={() => cancelGiveaway(g.id)} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
