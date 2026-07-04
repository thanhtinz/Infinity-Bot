import { apiGet, apiPut } from '../../lib/api';
import { useConfigForm } from '../../lib/useConfigForm';
import { isAccessError, textChannels } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import SaveBar from '../../components/SaveBar';
import Toggle from '../../components/Toggle';
import ChannelSelect from '../../components/ChannelSelect';

function EventSection({ label, icon, data, onChange, on, onToggleOn, channels }) {
  const update = (patch) => onChange({ ...data, ...patch });

  return (
    <div className="glass-panel section-card">
      <div className="module-card-top">
        <div className="module-card-title">
          <i className={`fa-solid ${icon}`} />
          <div>
            <span>{label}</span>
            <p className="control-hint">Sent when a member {label === 'Welcome' ? 'joins' : 'leaves'} the server.</p>
          </div>
        </div>
        <Toggle checked={!!on} onChange={onToggleOn} />
      </div>

      <div className="form-grid">
        <label className="config-item">
          <span className="label-sm">Channel</span>
          <ChannelSelect channels={channels} value={data.channelId} onChange={(v) => update({ channelId: v })} />
        </label>
        <label className="config-item">
          <span className="label-sm">Message type</span>
          <select className="control-select" value={data.type || 'simple'} onChange={(e) => update({ type: e.target.value })}>
            <option value="simple">Simple text</option>
            <option value="container">Embed card</option>
          </select>
        </label>
      </div>

      {data.type === 'container' ? (
        <div className="form-grid">
          <label className="config-item">
            <span className="label-sm">Title</span>
            <input type="text" value={data.title || ''} onChange={(e) => update({ title: e.target.value })} />
          </label>
          <label className="config-item full-span">
            <span className="label-sm">Description</span>
            <textarea rows={3} value={data.description || ''} onChange={(e) => update({ description: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Thumbnail URL</span>
            <input type="text" value={data.thumbnailUrl || ''} onChange={(e) => update({ thumbnailUrl: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Image URL</span>
            <input type="text" value={data.imageUrl || ''} onChange={(e) => update({ imageUrl: e.target.value })} />
          </label>
        </div>
      ) : (
        <label className="config-item full-span">
          <span className="label-sm">Message (supports {'{user}'} / {'{server}'})</span>
          <textarea rows={3} value={data.message || ''} onChange={(e) => update({ message: e.target.value })} />
        </label>
      )}

      <div className="preview-box">
        <p className="control-hint">Preview</p>
        {data.type === 'container' ? (
          <div className="preview-embed">
            {data.thumbnailUrl && <img src={data.thumbnailUrl} alt="" className="preview-thumb" />}
            <strong>{data.title || 'Untitled'}</strong>
            <p>{data.description || 'No description set.'}</p>
            {data.imageUrl && <img src={data.imageUrl} alt="" className="preview-image" />}
          </div>
        ) : (
          <p className="preview-text">{data.message || 'No message set.'}</p>
        )}
      </div>
    </div>
  );
}

const EMPTY_EVENT = { channelId: null, type: 'simple', message: '', title: '', description: '', thumbnailUrl: '', imageUrl: '' };

export default function Welcome({ guildId, meta, onAccessLost }) {
  const { config, setConfig, loading, error, saving, setSaving, dirty, reload, revert, commit } = useConfigForm(
    () => apiGet(`/api/guilds/${guildId}/welcome`),
    [guildId]
  );

  if (loading) return <Spinner label="Loading welcome settings..." />;
  if (error) {
    if (isAccessError(error)) {
      onAccessLost(error.message);
      return null;
    }
    return <ErrorState message={error.message || error} onRetry={reload} />;
  }
  if (!config) return null;

  const channels = textChannels(meta.channels);
  const welcome = { ...EMPTY_EVENT, ...(config.welcome || {}) };
  const farewell = { ...EMPTY_EVENT, ...(config.farewell || {}) };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiPut(`/api/guilds/${guildId}/welcome`, config);
      commit(updated);
    } catch (err) {
      setSaving(false);
      return err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <div className="two-col-grid">
        <EventSection
          label="Welcome"
          icon="fa-door-open"
          data={welcome}
          channels={channels}
          on={config.welcomeInOn}
          onToggleOn={(v) => setConfig((prev) => ({ ...prev, welcomeInOn: v }))}
          onChange={(next) => setConfig((prev) => ({ ...prev, welcome: next }))}
        />
        <EventSection
          label="Farewell"
          icon="fa-door-closed"
          data={farewell}
          channels={channels}
          on={config.welcomeOutOn}
          onToggleOn={(v) => setConfig((prev) => ({ ...prev, welcomeOutOn: v }))}
          onChange={(next) => setConfig((prev) => ({ ...prev, farewell: next }))}
        />
      </div>
      <SaveBar visible={dirty} saving={saving} onRevert={revert} onSave={save} />
    </div>
  );
}
