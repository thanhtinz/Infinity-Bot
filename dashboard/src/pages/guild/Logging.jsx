import { apiGet, apiPut } from '../../lib/api';
import { useConfigForm } from '../../lib/useConfigForm';
import { isAccessError, textChannels } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import SaveBar from '../../components/SaveBar';
import Toggle from '../../components/Toggle';
import ChannelSelect from '../../components/ChannelSelect';

const LOG_FIELDS = [
  ['messageLogsChannelId', 'Message Logs', 'fa-message', 'Edited and deleted messages.'],
  ['memberLogsChannelId', 'Member Logs', 'fa-user-group', 'Members joining and leaving.'],
  ['moderationLogsChannelId', 'Moderation Logs', 'fa-gavel', 'Warns, mutes, kicks, and bans.'],
  ['serverLogsChannelId', 'Server Logs', 'fa-server', 'Channel, role, and server changes.'],
  ['voiceLogsChannelId', 'Voice Logs', 'fa-microphone', 'Voice channel join, leave, and moves.']
];

export default function Logging({ guildId, meta, onAccessLost }) {
  const { config, setConfig, loading, error, saving, setSaving, dirty, reload, revert, commit } = useConfigForm(
    () => apiGet(`/api/guilds/${guildId}/logging`),
    [guildId]
  );

  if (loading) return <Spinner label="Loading logging settings..." />;
  if (error) {
    if (isAccessError(error)) {
      onAccessLost(error.message);
      return null;
    }
    return <ErrorState message={error.message || error} onRetry={reload} />;
  }
  if (!config) return null;

  const channels = textChannels(meta.channels);
  const cfg = config.config || {};

  const updateChannel = (key, value) => {
    setConfig((prev) => ({ ...prev, config: { ...(prev.config || {}), [key]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiPut(`/api/guilds/${guildId}/logging`, { ...cfg, loggingEnabled: config.loggingEnabled });
      commit(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="glass-panel section-card automod-header">
        <div className="header-info">
          <h3>Logging</h3>
          <p className="control-hint">Master switch for every log channel below.</p>
        </div>
        <Toggle checked={!!config.loggingEnabled} onChange={(v) => setConfig((prev) => ({ ...prev, loggingEnabled: v }))} />
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-stream" />
          <h3>Log Channels</h3>
        </div>
        <div className="form-grid">
          {LOG_FIELDS.map(([key, label, icon, desc]) => (
            <label key={key} className="config-item">
              <span className="label-sm"><i className={`fa-solid ${icon}`} /> {label}</span>
              <ChannelSelect channels={channels} value={cfg[key]} onChange={(v) => updateChannel(key, v)} />
              <span className="control-hint">{desc}</span>
            </label>
          ))}
        </div>
      </section>

      <SaveBar visible={dirty} saving={saving} onRevert={revert} onSave={save} />
    </div>
  );
}
