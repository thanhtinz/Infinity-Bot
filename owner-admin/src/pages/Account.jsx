import { useState } from 'react';
import { apiPut } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

export default function Account() {
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'danger', text: 'New password and confirmation do not match.' });
      return;
    }

    setSaving(true);
    try {
      await apiPut('/api/account', {
        currentPassword,
        newUsername: newUsername.trim() || undefined,
        newPassword: newPassword || undefined
      });
      setMessage({ type: 'success', text: 'Account updated.' });
      setCurrentPassword('');
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
      await refresh();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to update account' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 className="mb-4">Account</h3>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <form onSubmit={handleSubmit} className="card shadow-sm" style={{ maxWidth: '480px' }}>
        <div className="card-body">
          <p className="text-secondary">
            Logged in as <strong>{user?.username}</strong>
          </p>

          <div className="mb-3">
            <label className="form-label">Current Password</label>
            <input
              type="password"
              className="form-control"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <div className="form-text">Required to confirm any change below.</div>
          </div>

          <div className="mb-3">
            <label className="form-label">New Username</label>
            <input
              type="text"
              className="form-control"
              placeholder={user?.username}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">New Password</label>
            <input
              type="password"
              className="form-control"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Confirm New Password</label>
            <input
              type="password"
              className="form-control"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
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
