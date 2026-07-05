import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPut } from '../lib/api';

const PAGE_SIZE = 20;

function truncate(text, max = 80) {
  if (!text) return '(none)';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function EditRow({ entry, onSaved }) {
  const [enText, setEnText] = useState(entry.overrideEn ?? entry.defaultEn ?? '');
  const [viText, setViText] = useState(entry.overrideVi ?? entry.defaultVi ?? '');
  const [savingLang, setSavingLang] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setEnText(entry.overrideEn ?? entry.defaultEn ?? '');
    setViText(entry.overrideVi ?? entry.defaultVi ?? '');
  }, [entry]);

  function insertPlaceholder(setter, current, placeholder) {
    setter(`${current}{${placeholder}}`);
  }

  async function handleSave(language) {
    const template = language === 'en' ? enText : viText;
    if (!template || !template.trim()) {
      setError('Template cannot be empty.');
      return;
    }
    setSavingLang(language);
    setError('');
    setNotice('');
    try {
      await apiPut(`/api/messages/${encodeURIComponent(entry.key)}`, { language, template });
      setNotice(`Saved ${language === 'en' ? 'English' : 'Vietnamese'} override.`);
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSavingLang(null);
    }
  }

  async function handleReset(language) {
    setSavingLang(language);
    setError('');
    setNotice('');
    try {
      await apiDelete(`/api/messages/${encodeURIComponent(entry.key)}`, { language });
      if (language === 'en') setEnText(entry.defaultEn ?? '');
      else setViText(entry.defaultVi ?? '');
      setNotice(`Reset ${language === 'en' ? 'English' : 'Vietnamese'} to default.`);
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to reset');
    } finally {
      setSavingLang(null);
    }
  }

  return (
    <tr>
      <td colSpan={4} className="bg-light">
        <div className="p-3">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          {notice && <div className="alert alert-success py-2">{notice}</div>}

          {entry.placeholders.length > 0 && (
            <div className="mb-3">
              <div className="small text-secondary mb-1">Available placeholders (click to insert at end of a field):</div>
              <div className="d-flex flex-wrap gap-1">
                {entry.placeholders.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      insertPlaceholder(setEnText, enText, p);
                    }}
                    title="Click to insert into the English field"
                  >
                    {`{${p}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold">English</label>
              <textarea
                className="form-control"
                rows={3}
                value={enText}
                onChange={(e) => setEnText(e.target.value)}
              />
              <div className="d-flex gap-2 mt-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={savingLang === 'en'}
                  onClick={() => handleSave('en')}
                >
                  {savingLang === 'en' ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={savingLang === 'en' || !entry.overrideEn}
                  onClick={() => handleReset('en')}
                >
                  Reset to default
                </button>
              </div>
              <div className="form-text">Default: {truncate(entry.defaultEn, 200)}</div>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Vietnamese</label>
              <textarea
                className="form-control"
                rows={3}
                value={viText}
                onChange={(e) => setViText(e.target.value)}
              />
              <div className="d-flex gap-2 mt-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={savingLang === 'vi'}
                  onClick={() => handleSave('vi')}
                >
                  {savingLang === 'vi' ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={savingLang === 'vi' || !entry.overrideVi}
                  onClick={() => handleReset('vi')}
                >
                  Reset to default
                </button>
              </div>
              <div className="form-text">Default: {truncate(entry.defaultVi, 200)}</div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function Messages() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [customizedOnly, setCustomizedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/messages');
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load message catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set(entries.map((e) => e.category));
    return ['all', ...Array.from(set).sort()];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (customizedOnly && !entry.customized) return false;
      if (!q) return true;
      return (
        entry.key.toLowerCase().includes(q) ||
        (entry.defaultEn || '').toLowerCase().includes(q) ||
        (entry.defaultVi || '').toLowerCase().includes(q)
      );
    });
  }, [entries, search, category, customizedOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageEntries = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, category, customizedOnly]);

  function toggleExpand(key) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  return (
    <div>
      <h3 className="mb-1">Messages</h3>
      <p className="text-secondary">
        Customize the bot's bilingual reply/embed text. Only commands that already support the
        English/Vietnamese language system are listed here - see the README for details. Changes
        take effect on the live bot within seconds, no restart required.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-center">
            <div className="col-md-5">
              <input
                type="search"
                className="form-control"
                placeholder="Search by key or text…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'all' ? 'All categories' : c}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 form-check">
              <input
                id="customizedOnly"
                type="checkbox"
                className="form-check-input"
                checked={customizedOnly}
                onChange={(e) => setCustomizedOnly(e.target.checked)}
              />
              <label htmlFor="customizedOnly" className="form-check-label">
                Customized only
              </label>
            </div>
            <div className="col-md-1 text-end text-secondary small">
              {filtered.length} keys
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="text-secondary">Loading…</div>}

      {!loading && (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>English</th>
                  <th>Vietnamese</th>
                  <th style={{ width: '110px' }} />
                </tr>
              </thead>
              <tbody>
                {pageEntries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">No matching keys.</td>
                  </tr>
                )}
                {pageEntries.map((entry) => (
                  <Fragment key={entry.key}>
                    <tr onClick={() => toggleExpand(entry.key)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div className="fw-medium">{entry.key}</div>
                        <div className="small text-secondary">{entry.category}</div>
                      </td>
                      <td className="small">{truncate(entry.overrideEn ?? entry.defaultEn)}</td>
                      <td className="small">{truncate(entry.overrideVi ?? entry.defaultVi)}</td>
                      <td className="text-end">
                        {entry.customized && <span className="badge text-bg-success me-2">Customized</span>}
                        <i className={`bi ${expandedKey === entry.key ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
                      </td>
                    </tr>
                    {expandedKey === entry.key && <EditRow entry={entry} onSaved={load} />}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="card-footer d-flex justify-content-between align-items-center">
              <span className="small text-secondary">
                Page {clampedPage} of {totalPages}
              </span>
              <div className="btn-group">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={clampedPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={clampedPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
