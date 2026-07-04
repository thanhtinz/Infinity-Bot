import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import { formatUptime } from '../lib/format';

export default function Overview() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiGet('/api/status');
      setStatus(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load bot status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div>
      <h3 className="mb-4">Overview</h3>

      {error && <div className="alert alert-warning">{error}</div>}
      {loading && !status && <div className="text-secondary">Loading…</div>}

      {status && (
        <div className="row g-3">
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-body d-flex align-items-center gap-3">
                {status.user?.avatar ? (
                  <img src={status.user.avatar} alt="" width="56" height="56" className="rounded-circle" />
                ) : (
                  <i className="bi bi-robot text-secondary" style={{ fontSize: '3.5rem' }} />
                )}
                <div>
                  <div className="fs-5 fw-semibold">{status.user?.username || 'Bot offline'}</div>
                  <span className={`badge ${status.online ? 'bg-success' : 'bg-danger'}`}>
                    {status.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Uptime</div>
                <div className="fs-4 fw-semibold">{formatUptime(status.uptimeMs)}</div>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Guilds</div>
                <div className="fs-4 fw-semibold">{status.guildCount ?? '—'}</div>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Gateway Ping</div>
                <div className="fs-4 fw-semibold">{status.ping != null ? `${status.ping} ms` : '—'}</div>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="text-secondary small">Bot User ID</div>
                <div className="fs-6 fw-semibold text-break">{status.user?.id || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
