import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api';
import { formatDate, isAccessError } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import RoleSelect from '../../components/RoleSelect';
import ConfirmButton from '../../components/ConfirmButton';
import Toggle from '../../components/Toggle';

function emptyCategory() {
  return { name: '', description: '', position: 0 };
}

function emptyProduct() {
  return { name: '', description: '', categoryId: '', priceVnd: '', priceUsd: '', roleId: '', stock: '', imageUrl: '' };
}

function emptyCoupon() {
  return { code: '', discountType: 'percent', discountValue: '', maxUses: '', expiresAt: '' };
}

function emptyFlashSale() {
  return { productId: '', discountPercent: '', startsAt: '', endsAt: '' };
}

function formatMoney(order) {
  if (order.currency === 'vnd') return `${Math.round(Number(order.total)).toLocaleString('vi-VN')}₫`;
  return `$${Number(order.total).toFixed(2)}`;
}

export default function Shop({ guildId, meta, onAccessLost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [flashSales, setFlashSales] = useState([]);
  const [orders, setOrders] = useState([]);

  const [newCategory, setNewCategory] = useState(emptyCategory());
  const [newProduct, setNewProduct] = useState(emptyProduct());
  const [newCoupon, setNewCoupon] = useState(emptyCoupon());
  const [newFlashSale, setNewFlashSale] = useState(emptyFlashSale());
  const [sectionError, setSectionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/guilds/${guildId}/shop`);
      setCategories(data.categories || []);
      setProducts(data.products || []);
      setCoupons(data.coupons || []);
      setFlashSales(data.flashSales || []);
      setOrders(data.orders || []);
    } catch (err) {
      if (isAccessError(err)) {
        onAccessLost(err.message);
        return;
      }
      setError(err.message || 'Failed to load shop data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  if (loading) return <Spinner label="Loading shop..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const addCategory = async () => {
    setSectionError(null);
    if (!newCategory.name.trim()) return setSectionError('Category name is required.');
    setBusy(true);
    try {
      const created = await apiPost(`/api/guilds/${guildId}/shop/categories`, newCategory);
      setCategories((prev) => [...prev, created]);
      setNewCategory(emptyCategory());
    } catch (err) {
      setSectionError(err.message || 'Failed to add category.');
    } finally {
      setBusy(false);
    }
  };

  const removeCategory = async (id) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/shop/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setSectionError(err.message || 'Failed to remove category.');
    }
  };

  const addProduct = async () => {
    setSectionError(null);
    if (!newProduct.name.trim()) return setSectionError('Product name is required.');
    setBusy(true);
    try {
      const payload = {
        ...newProduct,
        categoryId: newProduct.categoryId || null,
        priceVnd: newProduct.priceVnd === '' ? null : Number(newProduct.priceVnd),
        priceUsd: newProduct.priceUsd === '' ? null : Number(newProduct.priceUsd),
        roleId: newProduct.roleId || null,
        stock: newProduct.stock === '' ? null : Number(newProduct.stock)
      };
      const created = await apiPost(`/api/guilds/${guildId}/shop/products`, payload);
      setProducts((prev) => [...prev, created]);
      setNewProduct(emptyProduct());
    } catch (err) {
      setSectionError(err.message || 'Failed to add product.');
    } finally {
      setBusy(false);
    }
  };

  const toggleProductActive = async (product) => {
    try {
      const updated = await apiPut(`/api/guilds/${guildId}/shop/products/${product.id}`, { active: !product.active });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
    } catch (err) {
      setSectionError(err.message || 'Failed to update product.');
    }
  };

  const removeProduct = async (id) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/shop/products/${id}`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setSectionError(err.message || 'Failed to remove product.');
    }
  };

  const addCoupon = async () => {
    setSectionError(null);
    if (!newCoupon.code.trim() || newCoupon.discountValue === '') return setSectionError('Code and discount value are required.');
    setBusy(true);
    try {
      const payload = {
        ...newCoupon,
        discountValue: Number(newCoupon.discountValue),
        maxUses: newCoupon.maxUses === '' ? null : Number(newCoupon.maxUses),
        expiresAt: newCoupon.expiresAt || null
      };
      const created = await apiPost(`/api/guilds/${guildId}/shop/coupons`, payload);
      setCoupons((prev) => [created, ...prev]);
      setNewCoupon(emptyCoupon());
    } catch (err) {
      setSectionError(err.message || 'Failed to add coupon.');
    } finally {
      setBusy(false);
    }
  };

  const toggleCouponActive = async (coupon) => {
    try {
      const updated = await apiPut(`/api/guilds/${guildId}/shop/coupons/${coupon.id}`, { active: !coupon.active });
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? updated : c)));
    } catch (err) {
      setSectionError(err.message || 'Failed to update coupon.');
    }
  };

  const removeCoupon = async (id) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/shop/coupons/${id}`);
      setCoupons((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setSectionError(err.message || 'Failed to remove coupon.');
    }
  };

  const addFlashSale = async () => {
    setSectionError(null);
    if (!newFlashSale.productId || !newFlashSale.discountPercent || !newFlashSale.startsAt || !newFlashSale.endsAt) {
      return setSectionError('Product, discount percent, start and end are all required.');
    }
    setBusy(true);
    try {
      const created = await apiPost(`/api/guilds/${guildId}/shop/flashsales`, {
        ...newFlashSale,
        productId: Number(newFlashSale.productId),
        discountPercent: Number(newFlashSale.discountPercent)
      });
      setFlashSales((prev) => [created, ...prev]);
      setNewFlashSale(emptyFlashSale());
    } catch (err) {
      setSectionError(err.message || 'Failed to add flash sale.');
    } finally {
      setBusy(false);
    }
  };

  const removeFlashSale = async (id) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/shop/flashsales/${id}`);
      setFlashSales((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setSectionError(err.message || 'Failed to remove flash sale.');
    }
  };

  const markOrderPaid = async (order) => {
    try {
      const result = await apiPost(`/api/guilds/${guildId}/shop/orders/${order.id}/mark-paid`);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'paid' } : o)));
      if (result?.fulfillmentWarning) setSectionError(`Order marked paid, but: ${result.fulfillmentWarning}`);
    } catch (err) {
      setSectionError(err.message || 'Failed to mark order paid.');
    }
  };

  const productName = (id) => products.find((p) => p.id === id)?.name || `#${id}`;

  return (
    <div className="page-stack">
      {sectionError && <div className="inline-notice inline-notice-error">{sectionError}</div>}

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-folder-tree" />
          <h3>Categories</h3>
        </div>

        {categories.length === 0 ? (
          <EmptyState icon="fa-folder-tree" title="No categories yet" message="Add one below to organize your products." />
        ) : (
          <div className="rule-list">
            {categories.map((c) => (
              <div key={c.id} className="rule-row">
                <div className="rule-summary">
                  <strong>{c.name}</strong>
                  <p className="control-hint">{c.description || 'No description'} · position {c.position}</p>
                </div>
                <ConfirmButton label="Remove" icon="fa-trash" onConfirm={() => removeCategory(c.id)} />
              </div>
            ))}
          </div>
        )}

        <div className="add-entry-form">
          <label className="config-item">
            <span className="label-sm">Name</span>
            <input type="text" value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Description</span>
            <input type="text" value={newCategory.description} onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Position</span>
            <input type="number" value={newCategory.position} onChange={(e) => setNewCategory({ ...newCategory, position: Number(e.target.value) })} />
          </label>
          <button type="button" className="btn-secondary" onClick={addCategory} disabled={busy}>
            <i className="fa-solid fa-plus" /> Add category
          </button>
        </div>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-bag-shopping" />
          <h3>Products</h3>
        </div>

        {products.length === 0 ? (
          <EmptyState icon="fa-bag-shopping" title="No products yet" message="Add one below to start selling." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price (VND)</th>
                  <th>Price (USD)</th>
                  <th>Role</th>
                  <th>Stock</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Name">{p.name}</td>
                    <td data-label="Category">{categories.find((c) => c.id === p.categoryId)?.name || '—'}</td>
                    <td data-label="Price (VND)">{p.priceVnd != null ? `${Number(p.priceVnd).toLocaleString('vi-VN')}₫` : '—'}</td>
                    <td data-label="Price (USD)">{p.priceUsd != null ? `$${Number(p.priceUsd).toFixed(2)}` : '—'}</td>
                    <td data-label="Role">{p.roleId ? `@${meta.roles?.find((r) => r.id === p.roleId)?.name || p.roleId}` : '—'}</td>
                    <td data-label="Stock">{p.stock == null ? '∞' : p.stock}</td>
                    <td data-label="Active"><Toggle checked={p.active} onChange={() => toggleProductActive(p)} /></td>
                    <td data-label=""><ConfirmButton label="Remove" icon="fa-trash" onConfirm={() => removeProduct(p.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="add-entry-form">
          <label className="config-item">
            <span className="label-sm">Name</span>
            <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Category</span>
            <select className="control-select" value={newProduct.categoryId} onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="config-item">
            <span className="label-sm">Price (VND)</span>
            <input type="number" value={newProduct.priceVnd} onChange={(e) => setNewProduct({ ...newProduct, priceVnd: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Price (USD)</span>
            <input type="number" step="0.01" value={newProduct.priceUsd} onChange={(e) => setNewProduct({ ...newProduct, priceUsd: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Role granted</span>
            <RoleSelect roles={meta.roles} value={newProduct.roleId} onChange={(v) => setNewProduct({ ...newProduct, roleId: v })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Stock (blank = unlimited)</span>
            <input type="number" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} />
          </label>
          <label className="config-item full-span">
            <span className="label-sm">Description</span>
            <textarea rows={2} value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} />
          </label>
          <label className="config-item full-span">
            <span className="label-sm">Image URL</span>
            <input type="text" value={newProduct.imageUrl} onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })} />
          </label>
          <button type="button" className="btn-secondary" onClick={addProduct} disabled={busy}>
            <i className="fa-solid fa-plus" /> Add product
          </button>
        </div>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-tags" />
          <h3>Coupons</h3>
        </div>

        {coupons.length === 0 ? (
          <EmptyState icon="fa-tags" title="No coupons yet" message="Add one below to offer discounts at checkout." />
        ) : (
          <div className="rule-list">
            {coupons.map((c) => (
              <div key={c.id} className="rule-row">
                <div className="rule-summary">
                  <strong>{c.code}</strong>
                  <p className="control-hint">
                    {c.discountType === 'percent' ? `${Number(c.discountValue)}% off` : `${Number(c.discountValue)} off`} · used {c.usesCount}{c.maxUses != null ? `/${c.maxUses}` : ''}
                    {c.expiresAt ? ` · expires ${formatDate(c.expiresAt)}` : ''}
                  </p>
                </div>
                <Toggle checked={c.active} onChange={() => toggleCouponActive(c)} />
                <ConfirmButton label="Remove" icon="fa-trash" onConfirm={() => removeCoupon(c.id)} />
              </div>
            ))}
          </div>
        )}

        <div className="add-entry-form">
          <label className="config-item">
            <span className="label-sm">Code</span>
            <input type="text" value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Type</span>
            <select className="control-select" value={newCoupon.discountType} onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value })}>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </label>
          <label className="config-item">
            <span className="label-sm">Value</span>
            <input type="number" value={newCoupon.discountValue} onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Max uses (blank = unlimited)</span>
            <input type="number" value={newCoupon.maxUses} onChange={(e) => setNewCoupon({ ...newCoupon, maxUses: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Expires at (blank = never)</span>
            <input type="datetime-local" value={newCoupon.expiresAt} onChange={(e) => setNewCoupon({ ...newCoupon, expiresAt: e.target.value })} />
          </label>
          <button type="button" className="btn-secondary" onClick={addCoupon} disabled={busy}>
            <i className="fa-solid fa-plus" /> Add coupon
          </button>
        </div>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-bolt" />
          <h3>Flash Sales</h3>
        </div>

        {flashSales.length === 0 ? (
          <EmptyState icon="fa-bolt" title="No flash sales yet" message="Add one below to run a time-limited discount." />
        ) : (
          <div className="rule-list">
            {flashSales.map((f) => (
              <div key={f.id} className="rule-row">
                <div className="rule-summary">
                  <strong>{productName(f.productId)}</strong>
                  <p className="control-hint">{Number(f.discountPercent)}% off · {formatDate(f.startsAt)} → {formatDate(f.endsAt)} · {f.active ? 'active' : 'inactive'}</p>
                </div>
                <ConfirmButton label="Remove" icon="fa-trash" onConfirm={() => removeFlashSale(f.id)} />
              </div>
            ))}
          </div>
        )}

        <div className="add-entry-form">
          <label className="config-item">
            <span className="label-sm">Product</span>
            <select className="control-select" value={newFlashSale.productId} onChange={(e) => setNewFlashSale({ ...newFlashSale, productId: e.target.value })}>
              <option value="">Select a product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="config-item">
            <span className="label-sm">Discount %</span>
            <input type="number" min="1" max="100" value={newFlashSale.discountPercent} onChange={(e) => setNewFlashSale({ ...newFlashSale, discountPercent: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Starts at</span>
            <input type="datetime-local" value={newFlashSale.startsAt} onChange={(e) => setNewFlashSale({ ...newFlashSale, startsAt: e.target.value })} />
          </label>
          <label className="config-item">
            <span className="label-sm">Ends at</span>
            <input type="datetime-local" value={newFlashSale.endsAt} onChange={(e) => setNewFlashSale({ ...newFlashSale, endsAt: e.target.value })} />
          </label>
          <button type="button" className="btn-secondary" onClick={addFlashSale} disabled={busy}>
            <i className="fa-solid fa-plus" /> Add flash sale
          </button>
        </div>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-receipt" />
          <h3>Order History</h3>
        </div>
        {orders.length === 0 ? (
          <EmptyState icon="fa-receipt" title="No orders yet" message="Orders placed with /shop buy will show up here." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Product</th>
                  <th>Total</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td data-label="#">{o.id}</td>
                    <td data-label="User">{o.userId}</td>
                    <td data-label="Product">{productName(o.productId)}</td>
                    <td data-label="Total">{formatMoney(o)}</td>
                    <td data-label="Method">{o.paymentMethod}</td>
                    <td data-label="Status">
                      <span className={`status-badge ${o.status === 'paid' ? 'status-on' : 'status-off'}`}>{o.status}</span>
                    </td>
                    <td data-label="Created">{formatDate(o.createdAt)}</td>
                    <td data-label="">
                      {o.paymentMethod === 'crypto' && o.status === 'pending' && (
                        <button type="button" className="btn-secondary" onClick={() => markOrderPaid(o)}>
                          <i className="fa-solid fa-check" /> Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
