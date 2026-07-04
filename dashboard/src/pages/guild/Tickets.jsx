import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api';
import { categoryChannels, clone, deepEqual, formatDate, isAccessError, textChannels } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import SaveBar from '../../components/SaveBar';
import ChannelSelect from '../../components/ChannelSelect';
import RoleSelect from '../../components/RoleSelect';
import MultiCheckSelect from '../../components/MultiCheckSelect';
import ConfirmButton from '../../components/ConfirmButton';

const DEFAULT_CONFIG = {
  setupType: 'single',
  panelChannelId: null,
  supportRoleId: null,
  additionalRoleIds: [],
  defaultCategoryId: null,
  logChannelId: null,
  panelTitle: '',
  panelDescription: '',
  panelImage: '',
  panelThumbnail: ''
};

function emptyCategory() {
  return { categoryName: '', categoryId: '', emoji: '', description: '' };
}

export default function Tickets({ guildId, meta, onAccessLost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [originalConfig, setOriginalConfig] = useState(DEFAULT_CONFIG);
  const [categories, setCategories] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [categoryError, setCategoryError] = useState(null);
  const [newCategory, setNewCategory] = useState(emptyCategory());
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const channels = textChannels(meta.channels);
  const categoryOptions = categoryChannels(meta.channels);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/guilds/${guildId}/tickets`);
      const cfg = { ...DEFAULT_CONFIG, ...(data.config || {}) };
      setConfig(clone(cfg));
      setOriginalConfig(clone(cfg));
      setCategories(data.categories || []);
      setTickets(data.tickets || []);
    } catch (err) {
      if (isAccessError(err)) {
        onAccessLost(err.message);
        return;
      }
      setError(err.message || 'Failed to load ticket data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  if (loading) return <Spinner label="Loading tickets..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const dirty = !deepEqual(config, originalConfig);

  const update = (patch) => setConfig((prev) => ({ ...prev, ...patch }));

  const toggleAdditionalRole = (roleId) => {
    const current = config.additionalRoleIds || [];
    update({
      additionalRoleIds: current.includes(roleId) ? current.filter((r) => r !== roleId) : [...current, roleId]
    });
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const data = await apiPut(`/api/guilds/${guildId}/tickets/config`, config);
      const cfg = { ...DEFAULT_CONFIG, ...(data.config || {}) };
      setConfig(clone(cfg));
      setOriginalConfig(clone(cfg));
    } catch (err) {
      setError(err.message || 'Failed to save ticket config.');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async () => {
    setCategoryError(null);
    if (!newCategory.categoryName.trim() || !newCategory.categoryId.trim()) {
      setCategoryError('Category name and category ID are required.');
      return;
    }
    setAddingCategory(true);
    try {
      const created = await apiPost(`/api/guilds/${guildId}/tickets/categories`, newCategory);
      setCategories((prev) => [...prev, created]);
      setNewCategory(emptyCategory());
    } catch (err) {
      setCategoryError(err.message || 'Failed to add category.');
    } finally {
      setAddingCategory(false);
    }
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setEditDraft(clone(category));
  };

  const saveEdit = async () => {
    try {
      const updated = await apiPut(`/api/guilds/${guildId}/tickets/categories/${editingId}`, editDraft);
      setCategories((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      setEditingId(null);
      setEditDraft(null);
    } catch (err) {
      setCategoryError(err.message || 'Failed to update category.');
    }
  };

  const removeCategory = async (categoryId) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/tickets/categories/${categoryId}`);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    } catch (err) {
      setCategoryError(err.message || 'Failed to remove category.');
    }
  };

  return (
    <div className="page-stack">
      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-ticket" />
          <h3>Ticket Panel</h3>
        </div>
        <div className="form-grid">
          <label className="config-item">
            <span className="label-sm">Setup type</span>
            <select className="control-select" value={config.setupType} onChange={(e) => update({ setupType: e.target.value })}>
              <option value="single">Single category</option>
              <option value="multi">Multi category</option>
            </select>
          </label>
          <label className="config-item">
            <span className="label-sm">Panel channel</span>
            <ChannelSelect channels={channels} value={config.panelChannelId} onChange={(v) => update({ panelChannelId: v })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Support role</span>
            <RoleSelect roles={meta.roles} value={config.supportRoleId} onChange={(v) => update({ supportRoleId: v })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Default category</span>
            <ChannelSelect
              channels={categoryOptions}
              value={config.defaultCategoryId}
              onChange={(v) => update({ defaultCategoryId: v })}
              placeholder="Select a category"
            />
          </label>
          <label className="config-item">
            <span className="label-sm">Log channel</span>
            <ChannelSelect channels={channels} value={config.logChannelId} onChange={(v) => update({ logChannelId: v })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Panel title</span>
            <input type="text" value={config.panelTitle || ''} onChange={(e) => update({ panelTitle: e.target.value })} />
          </label>
          <label className="config-item full-span">
            <span className="label-sm">Panel description</span>
            <textarea rows={3} value={config.panelDescription || ''} onChange={(e) => update({ panelDescription: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Panel image URL</span>
            <input type="text" value={config.panelImage || ''} onChange={(e) => update({ panelImage: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Panel thumbnail URL</span>
            <input type="text" value={config.panelThumbnail || ''} onChange={(e) => update({ panelThumbnail: e.target.value })} />
          </label>
        </div>

        <div className="config-item full-span">
          <span className="label-sm">Additional support roles</span>
          <MultiCheckSelect
            items={meta.roles}
            selected={config.additionalRoleIds}
            onToggle={toggleAdditionalRole}
            labelPrefix="@"
            emptyLabel="No roles found on this server."
          />
        </div>

        {config.panelMessageId && (
          <p className="control-hint">Panel message ID: {config.panelMessageId}</p>
        )}
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-folder-tree" />
          <h3>Ticket Categories</h3>
        </div>

        {categoryError && <div className="inline-notice inline-notice-error">{categoryError}</div>}

        {categories.length === 0 ? (
          <EmptyState icon="fa-folder-tree" title="No ticket categories yet" message="Add one below so members can pick a reason when opening a ticket." />
        ) : (
          <div className="rule-list">
            {categories.map((category) => (
              <div key={category.id} className="rule-row">
                {editingId === category.id ? (
                  <>
                    <label className="config-item">
                      <span className="label-sm">Name</span>
                      <input
                        type="text"
                        value={editDraft.categoryName || ''}
                        onChange={(e) => setEditDraft({ ...editDraft, categoryName: e.target.value })}
                      />
                    </label>
                    <label className="config-item">
                      <span className="label-sm">Emoji</span>
                      <input
                        type="text"
                        value={editDraft.emoji || ''}
                        onChange={(e) => setEditDraft({ ...editDraft, emoji: e.target.value })}
                      />
                    </label>
                    <label className="config-item">
                      <span className="label-sm">Description</span>
                      <input
                        type="text"
                        value={editDraft.description || ''}
                        onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                      />
                    </label>
                    <button type="button" className="btn-save" onClick={saveEdit}>Save</button>
                    <button type="button" className="btn-revert" onClick={() => { setEditingId(null); setEditDraft(null); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div className="rule-summary">
                      <strong>{category.emoji} {category.categoryName}</strong>
                      <p className="control-hint">{category.description || 'No description'}</p>
                    </div>
                    <button type="button" className="btn-secondary" onClick={() => startEdit(category)}>
                      <i className="fa-solid fa-pen" /> Edit
                    </button>
                    <ConfirmButton label="Remove" icon="fa-trash" onConfirm={() => removeCategory(category.id)} />
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="add-entry-form">
          <label className="config-item">
            <span className="label-sm">Category name</span>
            <input type="text" value={newCategory.categoryName} onChange={(e) => setNewCategory({ ...newCategory, categoryName: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Discord category</span>
            <ChannelSelect
              channels={categoryOptions}
              value={newCategory.categoryId}
              onChange={(v) => setNewCategory({ ...newCategory, categoryId: v })}
              placeholder="Select a category channel"
            />
          </label>
          <label className="config-item">
            <span className="label-sm">Emoji</span>
            <input type="text" placeholder="🎫" value={newCategory.emoji} onChange={(e) => setNewCategory({ ...newCategory, emoji: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Description</span>
            <input type="text" value={newCategory.description} onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} />
          </label>
          <button type="button" className="btn-secondary" onClick={addCategory} disabled={addingCategory}>
            <i className="fa-solid fa-plus" /> {addingCategory ? 'Adding...' : 'Add category'}
          </button>
        </div>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-clock-rotate-left" />
          <h3>Recent Tickets</h3>
        </div>
        {tickets.length === 0 ? (
          <EmptyState icon="fa-ticket" title="No tickets yet" message="Tickets opened by members will show up here." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Opened by</th>
                  <th>Category</th>
                  <th>Claimed by</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td data-label="Channel">{ticket.channelId}</td>
                    <td data-label="Opened by">{ticket.userId}</td>
                    <td data-label="Category">{ticket.categoryName || '—'}</td>
                    <td data-label="Claimed by">{ticket.claimedBy || '—'}</td>
                    <td data-label="Status">
                      <span className={`status-badge ${ticket.status === 'open' ? 'status-on' : 'status-off'}`}>{ticket.status}</span>
                    </td>
                    <td data-label="Created">{formatDate(ticket.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SaveBar visible={dirty} saving={saving} onRevert={() => setConfig(clone(originalConfig))} onSave={saveConfig} />
    </div>
  );
}
