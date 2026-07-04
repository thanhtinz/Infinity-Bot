import { useEffect, useState } from 'react';
import { apiGet } from '../../lib/api';
import { formatDate, isAccessError, textChannels } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';

export default function Overview({ guildId, meta, onAccessLost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [moderation, automod, antinuke, tickets, giveaways, logging] = await Promise.all([
        apiGet(`/api/guilds/${guildId}/moderation`),
        apiGet(`/api/guilds/${guildId}/automod`),
        apiGet(`/api/guilds/${guildId}/antinuke`),
        apiGet(`/api/guilds/${guildId}/tickets`),
        apiGet(`/api/guilds/${guildId}/giveaways`),
        apiGet(`/api/guilds/${guildId}/logging`)
      ]);
      setData({ moderation, automod, antinuke, tickets, giveaways, logging });
    } catch (err) {
      if (isAccessError(err)) {
        onAccessLost(err.message);
        return;
      }
      setError(err.message || 'Failed to load overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  if (loading) return <Spinner label="Loading overview..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const openTickets = (data.tickets.tickets || []).filter((t) => t.status === 'open').length;
  const activeGiveaways = (data.giveaways || []).filter((g) => !g.ended).length;
  const recentCases = (data.moderation.cases || []).slice(0, 6);

  const stats = [
    ['fa-users', 'Members', meta.memberCount ?? '—', '#6366F1'],
    ['fa-hashtag', 'Text Channels', textChannels(meta.channels).length, '#8B5CF6'],
    ['fa-user-shield', 'Roles', (meta.roles || []).length, '#22D3EE'],
    ['fa-gavel', 'Moderation Cases', (data.moderation.cases || []).length, '#F59E0B'],
    ['fa-ticket', 'Open Tickets', openTickets, '#34D399'],
    ['fa-gift', 'Active Giveaways', activeGiveaways, '#F472B6']
  ];

  const statusCards = [
    ['AutoMod', data.automod.config?.enabled, 'fa-robot'],
    ['Protection', data.antinuke.config?.enabled, 'fa-shield-halved'],
    ['Logging', data.logging.loggingEnabled, 'fa-stream']
  ];

  return (
    <div className="ov-container">
      <div className="ov-stats-grid">
        {stats.map(([icon, label, value, color]) => (
          <div key={label} className="ov-stat-card glass-panel">
            <div className="ov-stat-icon" style={{ '--stat-color': color }}>
              <i className={`fa-solid ${icon}`} />
            </div>
            <div className="ov-stat-info">
              <span className="ov-stat-label">{label}</span>
              <span className="ov-stat-value">{value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="ov-bottom-row">
        <div className="ov-activity-card glass-panel">
          <div className="ov-chart-header">
            <h3>Recent Moderation Cases</h3>
            <span className="ov-activity-count">{recentCases.length} shown</span>
          </div>
          {recentCases.length === 0 ? (
            <p className="control-hint">No moderation cases logged yet.</p>
          ) : (
            <div className="ov-activity-list">
              {recentCases.map((entry) => (
                <div key={entry.id} className="ov-activity-item">
                  <div className="ov-activity-badge">
                    <i className="fa-solid fa-folder-open" />
                  </div>
                  <div className="ov-activity-info">
                    <div className="ov-activity-top">
                      <span className="ov-activity-action">Case #{entry.caseNumber}</span>
                      <span className="tag-pill">{entry.action}</span>
                    </div>
                    <span className="ov-activity-target">{entry.targetTag || entry.targetId}</span>
                    <span className="ov-activity-time">{formatDate(entry.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ov-ai-card glass-panel">
          <div className="ov-chart-header">
            <h3>Module Status</h3>
          </div>
          <div className="module-status-list">
            {statusCards.map(([label, enabled, icon]) => (
              <div key={label} className="module-status-row">
                <div className="action-info">
                  <i className={`fa-solid ${icon}`} />
                  <span>{label}</span>
                </div>
                <span className={`status-badge ${enabled ? 'status-on' : 'status-off'}`}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
