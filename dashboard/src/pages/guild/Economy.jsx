import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api';
import { isAccessError } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import RoleSelect from '../../components/RoleSelect';
import ConfirmButton from '../../components/ConfirmButton';
import Toggle from '../../components/Toggle';

const GAME_LABELS = {
  blackjack: 'Blackjack',
  slot: 'Slot Machine',
  coinflip: 'Coin Flip (/coinbet)',
  daily: 'Daily Reward',
  rob: 'Rob',
  marry: 'Marry / Divorce'
};

function emptyItem() {
  return { name: '', description: '', price: '', roleId: '', roleDurationSeconds: '', stock: '' };
}

export default function Economy({ guildId, meta, onAccessLost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState(null);
  const [games, setGames] = useState([]);
  const [items, setItems] = useState([]);

  const [configDraft, setConfigDraft] = useState(null);
  const [newItem, setNewItem] = useState(emptyItem());
  const [sectionError, setSectionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/guilds/${guildId}/economy`);
      setEnabled(!!data.enabled);
      setConfig(data.config || null);
      setConfigDraft(data.config || null);
      setGames(data.games || []);
      setItems(data.items || []);
    } catch (err) {
      if (isAccessError(err)) {
        onAccessLost(err.message);
        return;
      }
      setError(err.message || 'Failed to load economy data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  if (loading) return <Spinner label="Loading economy..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  if (!enabled) {
    return (
      <div className="page-stack">
        <EmptyState
          icon="fa-coins"
          title="Infinity Economy isn't unlocked yet"
          message="This is a premium, per-server feature. Purchase the economy unlock product from this server's /shop (Shop / Premium page or the /shop buy command) to enable in-game currency, games, and the /store."
        />
      </div>
    );
  }

  const saveConfig = async () => {
    setSectionError(null);
    setBusy(true);
    try {
      const payload = {
        currencyName: configDraft.currencyName,
        currencySymbol: configDraft.currencySymbol,
        startingBalance: Number(configDraft.startingBalance),
        dailyAmount: Number(configDraft.dailyAmount),
        dailyStreakBonus: Number(configDraft.dailyStreakBonus),
        robSuccessRate: Number(configDraft.robSuccessRate),
        robMaxPercent: Number(configDraft.robMaxPercent),
        robCooldownMinutes: Number(configDraft.robCooldownMinutes)
      };
      const updated = await apiPut(`/api/guilds/${guildId}/economy/config`, payload);
      setConfig(updated);
      setConfigDraft(updated);
    } catch (err) {
      setSectionError(err.message || 'Failed to save economy config.');
    } finally {
      setBusy(false);
    }
  };

  const gameByName = (game) => games.find((g) => g.game === game) || { game, enabled: true, minBet: null, maxBet: null };

  const updateGame = async (game, patch) => {
    try {
      const current = gameByName(game);
      const updated = await apiPut(`/api/guilds/${guildId}/economy/games/${game}`, { ...patch });
      setGames((prev) => {
        const exists = prev.some((g) => g.game === game);
        return exists ? prev.map((g) => (g.game === game ? updated : g)) : [...prev, updated];
      });
      void current;
    } catch (err) {
      setSectionError(err.message || 'Failed to update game settings.');
    }
  };

  const addItem = async () => {
    setSectionError(null);
    if (!newItem.name.trim() || newItem.price === '') return setSectionError('Item name and price are required.');
    setBusy(true);
    try {
      const payload = {
        ...newItem,
        price: Number(newItem.price),
        roleId: newItem.roleId || null,
        roleDurationSeconds: newItem.roleDurationSeconds === '' ? null : Number(newItem.roleDurationSeconds),
        stock: newItem.stock === '' ? null : Number(newItem.stock)
      };
      const created = await apiPost(`/api/guilds/${guildId}/economy/items`, payload);
      setItems((prev) => [...prev, created]);
      setNewItem(emptyItem());
    } catch (err) {
      setSectionError(err.message || 'Failed to add item.');
    } finally {
      setBusy(false);
    }
  };

  const toggleItemActive = async (item) => {
    try {
      const updated = await apiPut(`/api/guilds/${guildId}/economy/items/${item.id}`, { active: !item.active });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch (err) {
      setSectionError(err.message || 'Failed to update item.');
    }
  };

  const removeItem = async (id) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/economy/items/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setSectionError(err.message || 'Failed to remove item.');
    }
  };

  return (
    <div className="page-stack">
      {sectionError && <div className="inline-notice inline-notice-error">{sectionError}</div>}

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-sliders" />
          <h3>Currency &amp; Rewards</h3>
        </div>
        {configDraft && (
          <div className="add-entry-form">
            <label className="config-item">
              <span className="label-sm">Currency name</span>
              <input type="text" value={configDraft.currencyName} onChange={(e) => setConfigDraft({ ...configDraft, currencyName: e.target.value })} />
            </label>
            <label className="config-item">
              <span className="label-sm">Currency symbol</span>
              <input type="text" value={configDraft.currencySymbol} onChange={(e) => setConfigDraft({ ...configDraft, currencySymbol: e.target.value })} />
            </label>
            <label className="config-item">
              <span className="label-sm">Starting balance</span>
              <input type="number" value={configDraft.startingBalance} onChange={(e) => setConfigDraft({ ...configDraft, startingBalance: e.target.value })} />
            </label>
            <label className="config-item">
              <span className="label-sm">Daily amount</span>
              <input type="number" value={configDraft.dailyAmount} onChange={(e) => setConfigDraft({ ...configDraft, dailyAmount: e.target.value })} />
            </label>
            <label className="config-item">
              <span className="label-sm">Daily streak bonus</span>
              <input type="number" value={configDraft.dailyStreakBonus} onChange={(e) => setConfigDraft({ ...configDraft, dailyStreakBonus: e.target.value })} />
            </label>
            <label className="config-item">
              <span className="label-sm">Rob success rate (%)</span>
              <input type="number" min="0" max="100" value={configDraft.robSuccessRate} onChange={(e) => setConfigDraft({ ...configDraft, robSuccessRate: e.target.value })} />
            </label>
            <label className="config-item">
              <span className="label-sm">Rob max steal (%)</span>
              <input type="number" min="0" max="100" value={configDraft.robMaxPercent} onChange={(e) => setConfigDraft({ ...configDraft, robMaxPercent: e.target.value })} />
            </label>
            <label className="config-item">
              <span className="label-sm">Rob cooldown (minutes)</span>
              <input type="number" value={configDraft.robCooldownMinutes} onChange={(e) => setConfigDraft({ ...configDraft, robCooldownMinutes: e.target.value })} />
            </label>
            <button type="button" className="btn-secondary" onClick={saveConfig} disabled={busy}>
              <i className="fa-solid fa-floppy-disk" /> Save
            </button>
          </div>
        )}
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-dice" />
          <h3>Games</h3>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Enabled</th>
                <th>Min Bet</th>
                <th>Max Bet</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(GAME_LABELS).map((game) => {
                const settings = gameByName(game);
                return (
                  <tr key={game}>
                    <td data-label="Game">{GAME_LABELS[game]}</td>
                    <td data-label="Enabled">
                      <Toggle checked={settings.enabled} onChange={(checked) => updateGame(game, { enabled: checked })} />
                    </td>
                    <td data-label="Min Bet">
                      <input
                        type="number"
                        className="control-input-sm"
                        defaultValue={settings.minBet ?? ''}
                        placeholder="none"
                        onBlur={(e) => updateGame(game, { minBet: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </td>
                    <td data-label="Max Bet">
                      <input
                        type="number"
                        className="control-input-sm"
                        defaultValue={settings.maxBet ?? ''}
                        placeholder="none"
                        onBlur={(e) => updateGame(game, { maxBet: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-shop" />
          <h3>Store Items</h3>
        </div>

        {items.length === 0 ? (
          <EmptyState icon="fa-shop" title="No store items yet" message="Add one below - members spend their in-game wallet balance on these via /store buy." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Role</th>
                  <th>Duration</th>
                  <th>Stock</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Name">{item.name}</td>
                    <td data-label="Price">{item.price}</td>
                    <td data-label="Role">{item.roleId ? `@${meta.roles?.find((r) => r.id === item.roleId)?.name || item.roleId}` : '—'}</td>
                    <td data-label="Duration">{item.roleDurationSeconds ? `${item.roleDurationSeconds}s` : '—'}</td>
                    <td data-label="Stock">{item.stock == null ? '∞' : item.stock}</td>
                    <td data-label="Active"><Toggle checked={item.active} onChange={() => toggleItemActive(item)} /></td>
                    <td data-label=""><ConfirmButton label="Remove" icon="fa-trash" onConfirm={() => removeItem(item.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="add-entry-form">
          <label className="config-item">
            <span className="label-sm">Name</span>
            <input type="text" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Price</span>
            <input type="number" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Role granted (optional)</span>
            <RoleSelect roles={meta.roles} value={newItem.roleId} onChange={(v) => setNewItem({ ...newItem, roleId: v })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Role duration seconds (optional)</span>
            <input type="number" value={newItem.roleDurationSeconds} onChange={(e) => setNewItem({ ...newItem, roleDurationSeconds: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Stock (blank = unlimited)</span>
            <input type="number" value={newItem.stock} onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })} />
          </label>
          <label className="config-item full-span">
            <span className="label-sm">Description</span>
            <textarea rows={2} value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
          </label>
          <button type="button" className="btn-secondary" onClick={addItem} disabled={busy}>
            <i className="fa-solid fa-plus" /> Add item
          </button>
        </div>
      </section>
    </div>
  );
}
