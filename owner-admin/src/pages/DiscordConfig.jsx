import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPut } from '../lib/api';

const EMPTY_FORM = { clientId: '', ownerId: '', prefix: '', statusText: '', botToken: '', clientSecret: '', enabled: true };

export default function DiscordConfig() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/config');
      setConfig(data);
      setForm({
        clientId: data.clientId || '',
        ownerId: data.ownerId || '',
        prefix: data.prefix || '',
        statusText: data.statusText || '',
        botToken: '',
        clientSecret: '',
        enabled: data.enabled !== false
      });
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to load config' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        clientId: form.clientId,
        ownerId: form.ownerId,
        prefix: form.prefix,
        statusText: form.statusText,
        enabled: form.enabled
      };
      // Only send secrets when the admin actually typed a new value - an empty field means
      // "keep the current one", it never round-trips the real value back to the browser.
      if (form.botToken.trim()) payload.botToken = form.botToken.trim();
      if (form.clientSecret.trim()) payload.clientSecret = form.clientSecret.trim();

      await apiPut('/api/config', payload);
      setMessage({ type: 'success', text: 'Configuration saved. Restart the bot from Bot Control for token/client changes to take effect.' });
      await load();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to save config' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-secondary">Loading…</div>;

  return (
    <div>
      <h3 className="mb-4">Discord Config</h3>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <form onSubmit={handleSubmit} className="card shadow-sm">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Bot Token</label>
              <input
                type="password"
                className="form-control"
                placeholder={config?.botTokenMasked ? `Current: ${config.botTokenMasked} (${config.botTokenSource})` : 'Not set'}
                autoComplete="new-password"
                value={form.botToken}
                onChange={(e) => update('botToken', e.target.value)}
              />
              <div className="form-text">Leave blank to keep the current token. Never shown in full once saved.</div>
            </div>

            <div className="col-md-6">
              <label className="form-label">Client Secret</label>
              <input
                type="password"
                className="form-control"
                placeholder={config?.clientSecretMasked ? `Current: ${config.clientSecretMasked} (${config.clientSecretSource})` : 'Not set'}
                autoComplete="new-password"
                value={form.clientSecret}
                onChange={(e) => update('clientSecret', e.target.value)}
              />
              <div className="form-text">Leave blank to keep the current secret.</div>
            </div>

            <div className="col-md-4">
              <label className="form-label">Client ID</label>
              <input
                type="text"
                className="form-control"
                value={form.clientId}
                onChange={(e) => update('clientId', e.target.value)}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">Owner ID</label>
              <input
                type="text"
                className="form-control"
                value={form.ownerId}
                onChange={(e) => update('ownerId', e.target.value)}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">Prefix</label>
              <input
                type="text"
                className="form-control"
                value={form.prefix}
                onChange={(e) => update('prefix', e.target.value)}
              />
            </div>

            <div className="col-md-8">
              <label className="form-label">Status Text</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. ,help | infinitybot.gg"
                value={form.statusText}
                onChange={(e) => update('statusText', e.target.value)}
              />
              <div className="form-text">Shown as the bot's Discord activity/presence text.</div>
            </div>

            <div className="col-md-4 d-flex align-items-end">
              <div className="form-check form-switch">
                <input
                  id="enabledSwitch"
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  checked={form.enabled}
                  onChange={(e) => update('enabled', e.target.checked)}
                />
                <label className="form-check-label" htmlFor="enabledSwitch">
                  Bot enabled (auto-login on process start)
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="card-footer text-end">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
