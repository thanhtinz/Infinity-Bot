import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';

const ACTIONS = {
  restart: {
    label: 'Restart',
    variant: 'warning',
    endpoint: '/api/control/restart',
    confirmBody: 'This will disconnect the bot from Discord and immediately log it back in with the current configuration. Any in-progress commands will be interrupted.'
  },
  stop: {
    label: 'Stop',
    variant: 'danger',
    endpoint: '/api/control/stop',
    confirmBody: 'This will take the bot offline in every server until you press Start again. The server process itself (and this admin panel) will keep running.'
  },
  start: {
    label: 'Start',
    variant: 'success',
    endpoint: '/api/control/start',
    confirmBody: 'This will log the bot back in to Discord using the currently saved configuration.'
  }
};

export default function Control() {
  const [status, setStatus] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiGet('/api/status');
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function runAction(key) {
    const action = ACTIONS[key];
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiPost(action.endpoint);
      setMessage({ type: 'success', text: `${action.label} succeeded - bot is now ${result?.online ? 'online' : 'offline'}.` });
      await loadStatus();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || `Failed to ${action.label.toLowerCase()} the bot` });
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  return (
    <div>
      <h3 className="mb-4">Bot Control</h3>

      <div className="mb-3">
        <span className={`badge ${status?.online ? 'bg-success' : 'bg-danger'} fs-6`}>
          {status?.online ? 'Online' : 'Offline'}
        </span>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} role="alert">
          {message.text}
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-body d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-success" onClick={() => setPendingAction('start')} disabled={busy}>
            <i className="bi bi-play-fill me-1" /> Start
          </button>
          <button type="button" className="btn btn-warning" onClick={() => setPendingAction('restart')} disabled={busy}>
            <i className="bi bi-arrow-clockwise me-1" /> Restart
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setPendingAction('stop')} disabled={busy}>
            <i className="bi bi-stop-fill me-1" /> Stop
          </button>
        </div>
      </div>

      <ConfirmModal
        show={!!pendingAction}
        title={pendingAction ? `${ACTIONS[pendingAction].label} the bot?` : ''}
        body={pendingAction ? ACTIONS[pendingAction].confirmBody : ''}
        confirmLabel={pendingAction ? ACTIONS[pendingAction].label : 'Confirm'}
        confirmVariant={pendingAction ? ACTIONS[pendingAction].variant : 'primary'}
        busy={busy}
        onConfirm={() => runAction(pendingAction)}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
