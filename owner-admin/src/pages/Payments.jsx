import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPut } from '../lib/api';

const EMPTY_FORM = {
  payosClientId: '', payosApiKey: '', payosChecksumKey: '',
  paypalClientId: '', paypalClientSecret: '', paypalMode: 'sandbox',
  cryptoWalletBtc: '', cryptoWalletEth: '', cryptoWalletUsdt: ''
};

export default function Payments() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/payments');
      setConfig(data);
      setForm({
        payosClientId: data.payosClientId || '',
        payosApiKey: '',
        payosChecksumKey: '',
        paypalClientId: data.paypalClientId || '',
        paypalClientSecret: '',
        paypalMode: data.paypalMode || 'sandbox',
        cryptoWalletBtc: data.cryptoWalletBtc || '',
        cryptoWalletEth: data.cryptoWalletEth || '',
        cryptoWalletUsdt: data.cryptoWalletUsdt || ''
      });
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to load payment config' });
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
        payosClientId: form.payosClientId,
        paypalClientId: form.paypalClientId,
        paypalMode: form.paypalMode,
        cryptoWalletBtc: form.cryptoWalletBtc,
        cryptoWalletEth: form.cryptoWalletEth,
        cryptoWalletUsdt: form.cryptoWalletUsdt
      };
      // Only send secrets when the admin actually typed a new value - blank means "keep current".
      if (form.payosApiKey.trim()) payload.payosApiKey = form.payosApiKey.trim();
      if (form.payosChecksumKey.trim()) payload.payosChecksumKey = form.payosChecksumKey.trim();
      if (form.paypalClientSecret.trim()) payload.paypalClientSecret = form.paypalClientSecret.trim();

      await apiPut('/api/payments', payload);
      setMessage({ type: 'success', text: 'Payment gateway configuration saved.' });
      await load();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to save payment config' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-secondary">Loading…</div>;

  return (
    <div>
      <h3 className="mb-4">Payments</h3>
      <p className="text-secondary mb-4">
        Shop/Premium payment gateway credentials. Any field left blank here falls back to the equivalent
        environment variable - see .env.example. Never shown in full once saved.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card shadow-sm mb-4">
          <div className="card-header fw-semibold">PayOS (QR / Bank Transfer)</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Client ID</label>
                <input type="text" className="form-control" value={form.payosClientId} onChange={(e) => update('payosClientId', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">API Key</label>
                <input
                  type="password"
                  className="form-control"
                  autoComplete="new-password"
                  placeholder={config?.payosApiKeyMasked ? `Current: ${config.payosApiKeyMasked} (${config.payosApiKeySource})` : 'Not set'}
                  value={form.payosApiKey}
                  onChange={(e) => update('payosApiKey', e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Checksum Key</label>
                <input
                  type="password"
                  className="form-control"
                  autoComplete="new-password"
                  placeholder={config?.payosChecksumKeyMasked ? `Current: ${config.payosChecksumKeyMasked} (${config.payosChecksumKeySource})` : 'Not set'}
                  value={form.payosChecksumKey}
                  onChange={(e) => update('payosChecksumKey', e.target.value)}
                />
              </div>
            </div>
            <div className="form-text mt-2">Leave secret fields blank to keep the current value.</div>
          </div>
        </div>

        <div className="card shadow-sm mb-4">
          <div className="card-header fw-semibold">PayPal</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Client ID</label>
                <input type="text" className="form-control" value={form.paypalClientId} onChange={(e) => update('paypalClientId', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Client Secret</label>
                <input
                  type="password"
                  className="form-control"
                  autoComplete="new-password"
                  placeholder={config?.paypalClientSecretMasked ? `Current: ${config.paypalClientSecretMasked} (${config.paypalClientSecretSource})` : 'Not set'}
                  value={form.paypalClientSecret}
                  onChange={(e) => update('paypalClientSecret', e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Mode</label>
                <select className="form-select" value={form.paypalMode} onChange={(e) => update('paypalMode', e.target.value)}>
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-sm mb-4">
          <div className="card-header fw-semibold">Crypto Wallets (manual confirmation only)</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">BTC Address</label>
                <input type="text" className="form-control" value={form.cryptoWalletBtc} onChange={(e) => update('cryptoWalletBtc', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">ETH Address</label>
                <input type="text" className="form-control" value={form.cryptoWalletEth} onChange={(e) => update('cryptoWalletEth', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">USDT Address</label>
                <input type="text" className="form-control" value={form.cryptoWalletUsdt} onChange={(e) => update('cryptoWalletUsdt', e.target.value)} />
              </div>
            </div>
            <div className="form-text mt-2">
              Crypto payments have no automated on-chain monitoring - orders stay "pending" until an admin
              manually confirms them from a server's Shop dashboard page.
            </div>
          </div>
        </div>

        <div className="text-end">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
