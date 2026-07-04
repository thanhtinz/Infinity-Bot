import { useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { useConfigForm } from '../../lib/useConfigForm';
import { isAccessError, textChannels } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import SaveBar from '../../components/SaveBar';
import Toggle from '../../components/Toggle';
import ChannelSelect from '../../components/ChannelSelect';
import RoleSelect from '../../components/RoleSelect';

const DEFAULT_MESSAGE = 'Click the button below to verify yourself and gain access to the rest of the server.';

export default function Verification({ guildId, meta, onAccessLost }) {
  const { config, setConfig, loading, error, saving, setSaving, dirty, reload, revert, commit } = useConfigForm(
    () => apiGet(`/api/guilds/${guildId}/verification`).then((data) => data.config),
    [guildId]
  );
  const [panelStatus, setPanelStatus] = useState(null);
  const [postingPanel, setPostingPanel] = useState(false);

  if (loading) return <Spinner label="Loading verification settings..." />;
  if (error) {
    if (isAccessError(error)) {
      onAccessLost(error.message);
      return null;
    }
    return <ErrorState message={error.message || error} onRetry={reload} />;
  }
  if (!config) return null;

  const channels = textChannels(meta.channels);
  const update = (patch) => setConfig((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    setPanelStatus(null);
    try {
      const data = await apiPut(`/api/guilds/${guildId}/verification`, config);
      commit(data.config);
    } catch (err) {
      setSaving(false);
      return err;
    } finally {
      setSaving(false);
    }
  };

  const postPanel = async () => {
    setPostingPanel(true);
    setPanelStatus(null);
    try {
      const result = await apiPost(`/api/guilds/${guildId}/verification/panel`);
      setPanelStatus({ ok: true, message: `Panel posted in <#${config.channelId}> (message ${result?.panelMessageId || ''}).` });
      reload();
    } catch (err) {
      setPanelStatus({ ok: false, message: err.message || 'Failed to post the verification panel.' });
    } finally {
      setPostingPanel(false);
    }
  };

  const canPostPanel = !!config.channelId && !!config.verifiedRoleId;

  return (
    <div className="page-stack">
      <section className="glass-panel section-card automod-header">
        <div className="header-info">
          <h3>Verification Gate</h3>
          <p className="control-hint">New members get the unverified role until they click Verify on the panel.</p>
        </div>
        <Toggle checked={!!config.enabled} onChange={(v) => update({ enabled: v })} />
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-user-shield" />
          <h3>Configuration</h3>
        </div>
        <div className="form-grid">
          <label className="config-item">
            <span className="label-sm">Verify panel channel</span>
            <ChannelSelect channels={channels} value={config.channelId} onChange={(v) => update({ channelId: v })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Verified role</span>
            <RoleSelect roles={meta.roles} value={config.verifiedRoleId} onChange={(v) => update({ verifiedRoleId: v })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Unverified role (optional)</span>
            <RoleSelect roles={meta.roles} value={config.unverifiedRoleId} onChange={(v) => update({ unverifiedRoleId: v })} />
          </label>
          <label className="config-item full-span">
            <span className="label-sm">Panel message</span>
            <textarea
              rows={3}
              placeholder={DEFAULT_MESSAGE}
              value={config.message || ''}
              onChange={(e) => update({ message: e.target.value })}
            />
          </label>
        </div>

        {config.panelMessageId && (
          <p className="control-hint">Last posted panel message ID: {config.panelMessageId}</p>
        )}

        {panelStatus && (
          <div className={`inline-notice ${panelStatus.ok ? '' : 'inline-notice-error'}`}>{panelStatus.message}</div>
        )}

        <button
          type="button"
          className="btn-secondary"
          onClick={postPanel}
          disabled={postingPanel || !canPostPanel || dirty}
        >
          <i className="fa-solid fa-paper-plane" /> {postingPanel ? 'Posting...' : (config.panelMessageId ? 'Repost panel' : 'Post panel')}
        </button>
        {!canPostPanel && <p className="control-hint">Set a channel and verified role (and save) before posting the panel.</p>}
        {canPostPanel && dirty && <p className="control-hint">Save your changes before posting the panel.</p>}
      </section>

      <SaveBar visible={dirty} saving={saving} onRevert={revert} onSave={save} />
    </div>
  );
}
