import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api';
import { deepEqual, isAccessError, textChannels, voiceChannels, categoryChannels } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import SaveBar from '../../components/SaveBar';
import Toggle from '../../components/Toggle';
import ChannelSelect from '../../components/ChannelSelect';
import MultiCheckSelect from '../../components/MultiCheckSelect';
import ConfirmButton from '../../components/ConfirmButton';

const PREFIX_RE = /^\S{1,5}$/;

export default function Settings({ guildId, meta, onAccessLost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [prefix, setPrefix] = useState('');
  const [prefixOriginal, setPrefixOriginal] = useState('');
  const [prefixSaving, setPrefixSaving] = useState(false);

  const [autoReacts, setAutoReacts] = useState([]);
  const [newTrigger, setNewTrigger] = useState({ trigger: '', emoji: '' });
  const [addingTrigger, setAddingTrigger] = useState(false);
  const [triggerError, setTriggerError] = useState(null);

  const [j2c, setJ2c] = useState({ textChannelId: null, voiceChannelId: null, categoryId: null });
  const [j2cOriginal, setJ2cOriginal] = useState({ textChannelId: null, voiceChannelId: null, categoryId: null });
  const [j2cSaving, setJ2cSaving] = useState(false);

  const [guildConfig, setGuildConfig] = useState({ autoreactEnabled: false, aiChannelIds: [] });
  const [guildConfigOriginal, setGuildConfigOriginal] = useState({ autoreactEnabled: false, aiChannelIds: [] });
  const [guildConfigSaving, setGuildConfigSaving] = useState(false);

  const channels = textChannels(meta.channels);
  const voiceOptions = voiceChannels(meta.channels);
  const categoryOptions = categoryChannels(meta.channels);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/guilds/${guildId}/settings`);
      setPrefix(data.prefix || '');
      setPrefixOriginal(data.prefix || '');
      setAutoReacts(data.autoReacts || []);
      const j2cData = data.j2c || { textChannelId: null, voiceChannelId: null, categoryId: null };
      setJ2c(j2cData);
      setJ2cOriginal(j2cData);
      const gc = { autoreactEnabled: !!data.autoreactEnabled, aiChannelIds: data.aiChannelIds || [] };
      setGuildConfig(gc);
      setGuildConfigOriginal(gc);
    } catch (err) {
      if (isAccessError(err)) {
        onAccessLost(err.message);
        return;
      }
      setError(err.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  if (loading) return <Spinner label="Loading settings..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const prefixDirty = prefix !== prefixOriginal;
  const prefixValid = PREFIX_RE.test(prefix);

  const savePrefix = async () => {
    if (!prefixValid) return;
    setPrefixSaving(true);
    try {
      const data = await apiPut(`/api/guilds/${guildId}/settings/prefix`, { prefix });
      setPrefix(data.prefix);
      setPrefixOriginal(data.prefix);
    } catch (err) {
      setError(err.message || 'Failed to save prefix.');
    } finally {
      setPrefixSaving(false);
    }
  };

  const addTrigger = async () => {
    setTriggerError(null);
    if (!newTrigger.trigger.trim() || !newTrigger.emoji.trim()) {
      setTriggerError('Both a trigger word and an emoji are required.');
      return;
    }
    setAddingTrigger(true);
    try {
      const created = await apiPost(`/api/guilds/${guildId}/settings/autoreact`, newTrigger);
      setAutoReacts((prev) => [...prev, created]);
      setNewTrigger({ trigger: '', emoji: '' });
    } catch (err) {
      setTriggerError(err.message || 'Failed to add auto-react.');
    } finally {
      setAddingTrigger(false);
    }
  };

  const removeTrigger = async (id) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/settings/autoreact/${id}`);
      setAutoReacts((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setTriggerError(err.message || 'Failed to remove auto-react.');
    }
  };

  const j2cDirty = !deepEqual(j2c, j2cOriginal);
  const saveJ2c = async () => {
    setJ2cSaving(true);
    try {
      const data = await apiPut(`/api/guilds/${guildId}/settings/j2c`, j2c);
      setJ2c(data.j2c);
      setJ2cOriginal(data.j2c);
    } catch (err) {
      setError(err.message || 'Failed to save join-to-create settings.');
    } finally {
      setJ2cSaving(false);
    }
  };

  const guildConfigDirty = !deepEqual(guildConfig, guildConfigOriginal);
  const saveGuildConfig = async () => {
    setGuildConfigSaving(true);
    try {
      const data = await apiPut(`/api/guilds/${guildId}/settings/guild-config`, guildConfig);
      const next = { autoreactEnabled: !!data.autoreactEnabled, aiChannelIds: data.aiChannelIds || [] };
      setGuildConfig(next);
      setGuildConfigOriginal(next);
    } catch (err) {
      setError(err.message || 'Failed to save automation settings.');
    } finally {
      setGuildConfigSaving(false);
    }
  };

  const toggleAiChannel = (channelId) => {
    setGuildConfig((prev) => ({
      ...prev,
      aiChannelIds: prev.aiChannelIds.includes(channelId)
        ? prev.aiChannelIds.filter((c) => c !== channelId)
        : [...prev.aiChannelIds, channelId]
    }));
  };

  return (
    <div className="page-stack">
      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-slash" />
          <h3>Command Prefix</h3>
        </div>
        <div className="form-grid">
          <label className="config-item">
            <span className="label-sm">Prefix</span>
            <input type="text" maxLength={5} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            {!prefixValid && prefix.length > 0 && <p className="field-error">Prefix must be 1-5 characters with no spaces.</p>}
          </label>
        </div>
        <button type="button" className="btn-primary" disabled={!prefixDirty || !prefixValid || prefixSaving} onClick={savePrefix}>
          {prefixSaving ? 'Saving...' : 'Save Prefix'}
        </button>
      </section>

      <section className="glass-panel section-card">
        <div className="module-card-top">
          <div className="module-card-title">
            <i className="fa-solid fa-face-smile" />
            <div>
              <span>Auto-React Triggers</span>
              <p className="control-hint">React automatically when a message contains a trigger word.</p>
            </div>
          </div>
          <Toggle checked={!!guildConfig.autoreactEnabled} onChange={(v) => setGuildConfig((prev) => ({ ...prev, autoreactEnabled: v }))} />
        </div>

        {triggerError && <div className="inline-notice inline-notice-error">{triggerError}</div>}

        {autoReacts.length === 0 ? (
          <EmptyState icon="fa-face-smile" title="No auto-react triggers yet" message="Add a trigger word and emoji below." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Trigger</th>
                  <th>Emoji</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {autoReacts.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Trigger">{t.trigger}</td>
                    <td data-label="Emoji">{t.emoji}</td>
                    <td data-label="">
                      <ConfirmButton label="Remove" icon="fa-trash" onConfirm={() => removeTrigger(t.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="add-entry-form">
          <label className="config-item">
            <span className="label-sm">Trigger word</span>
            <input type="text" value={newTrigger.trigger} onChange={(e) => setNewTrigger({ ...newTrigger, trigger: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Emoji</span>
            <input type="text" value={newTrigger.emoji} onChange={(e) => setNewTrigger({ ...newTrigger, emoji: e.target.value })} />
          </label>
          <button type="button" className="btn-secondary" onClick={addTrigger} disabled={addingTrigger}>
            <i className="fa-solid fa-plus" /> {addingTrigger ? 'Adding...' : 'Add trigger'}
          </button>
        </div>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-microphone-lines" />
          <h3>Join-to-Create Voice</h3>
        </div>
        <div className="form-grid">
          <label className="config-item">
            <span className="label-sm">Trigger voice channel</span>
            <ChannelSelect channels={voiceOptions} value={j2c.voiceChannelId} onChange={(v) => setJ2c({ ...j2c, voiceChannelId: v })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Category for new channels</span>
            <ChannelSelect channels={categoryOptions} value={j2c.categoryId} onChange={(v) => setJ2c({ ...j2c, categoryId: v })} placeholder="Select a category" />
          </label>
          <label className="config-item">
            <span className="label-sm">Text channel (control panel)</span>
            <ChannelSelect channels={channels} value={j2c.textChannelId} onChange={(v) => setJ2c({ ...j2c, textChannelId: v })} />
          </label>
        </div>
        <button type="button" className="btn-primary" disabled={!j2cDirty || j2cSaving} onClick={saveJ2c}>
          {j2cSaving ? 'Saving...' : 'Save Join-to-Create'}
        </button>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-wand-magic-sparkles" />
          <h3>AI Channels</h3>
        </div>
        <p className="control-hint">Pick which text channels allow the bot's AI chat feature.</p>
        <MultiCheckSelect
          items={channels}
          selected={guildConfig.aiChannelIds}
          onToggle={toggleAiChannel}
          labelPrefix="#"
          emptyLabel="No text channels found."
        />
      </section>

      <SaveBar
        visible={guildConfigDirty}
        saving={guildConfigSaving}
        onRevert={() => setGuildConfig(guildConfigOriginal)}
        onSave={saveGuildConfig}
        message="You have unsaved auto-react / AI channel changes."
      />
    </div>
  );
}
