import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPut } from '../../lib/api';
import { clone, deepEqual, formatDate, isAccessError } from '../../lib/format';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import SaveBar from '../../components/SaveBar';
import ConfirmButton from '../../components/ConfirmButton';

const ACTIONS = ['mute', 'kick', 'ban'];
const DURATION_RE = /^[0-9]+[mhd]$/i;

function emptyRule() {
  return { warnCount: 3, action: 'mute', duration: '10m' };
}

function validateRules(rules) {
  const errors = [];
  rules.forEach((rule, index) => {
    if (!Number.isInteger(Number(rule.warnCount)) || Number(rule.warnCount) < 1) {
      errors[index] = 'Warn count must be a positive whole number.';
    } else if (!ACTIONS.includes(rule.action)) {
      errors[index] = 'Pick a valid action.';
    } else if (rule.action === 'mute' && !DURATION_RE.test(String(rule.duration || '').trim())) {
      errors[index] = 'Duration must look like 10m, 1h, or 2d.';
    }
  });
  return errors;
}

export default function Moderation({ guildId, onAccessLost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cases, setCases] = useState([]);
  const [rules, setRules] = useState([]);
  const [originalRules, setOriginalRules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [actionFilter, setActionFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/guilds/${guildId}/moderation`);
      setCases(data.cases || []);
      setRules(clone(data.punishConfig || []));
      setOriginalRules(clone(data.punishConfig || []));
    } catch (err) {
      if (isAccessError(err)) {
        onAccessLost(err.message);
        return;
      }
      setError(err.message || 'Failed to load moderation data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const dirty = !deepEqual(rules, originalRules);
  const errors = useMemo(() => validateRules(rules), [rules]);
  const hasErrors = errors.some(Boolean);

  const filteredCases = cases.filter((c) => {
    if (actionFilter !== 'all' && c.action !== actionFilter) return false;
    if (!search.trim()) return true;
    const needle = search.trim().toLowerCase();
    return (
      (c.targetTag || '').toLowerCase().includes(needle) ||
      (c.moderatorTag || '').toLowerCase().includes(needle) ||
      (c.reason || '').toLowerCase().includes(needle)
    );
  });

  const updateRule = (index, field, value) => {
    setRules((prev) => prev.map((rule, i) => (i === index ? { ...rule, [field]: value } : rule)));
  };

  const removeRule = (index) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const addRule = () => setRules((prev) => [...prev, emptyRule()]);

  const saveRules = async () => {
    if (hasErrors) return;
    setSaving(true);
    try {
      const data = await apiPut(`/api/guilds/${guildId}/moderation/punish-config`, { rules });
      setRules(clone(data.punishConfig || rules));
      setOriginalRules(clone(data.punishConfig || rules));
    } catch (err) {
      setError(err.message || 'Failed to save punish-config.');
    } finally {
      setSaving(false);
    }
  };

  const revert = () => setRules(clone(originalRules));

  const deleteCase = async (caseId) => {
    try {
      await apiDelete(`/api/guilds/${guildId}/moderation/cases/${caseId}`);
      setCases((prev) => prev.filter((c) => c.id !== caseId));
    } catch (err) {
      setError(err.message || 'Failed to delete case.');
    }
  };

  if (loading) return <Spinner label="Loading moderation data..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="page-stack">
      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-list-check" />
          <h3>Warn-Punish Rules</h3>
        </div>
        <p className="control-hint">Automatically escalate consequences once a member accumulates warnings.</p>

        {rules.length === 0 ? (
          <EmptyState
            icon="fa-gavel"
            title="No warn-punish rules yet"
            message="Add one to start automating consequences."
          />
        ) : (
          <div className="rule-list">
            {rules.map((rule, index) => (
              <div key={index} className="rule-row">
                <label className="config-item">
                  <span className="label-sm">At warn count</span>
                  <input
                    type="number"
                    min="1"
                    value={rule.warnCount}
                    onChange={(e) => updateRule(index, 'warnCount', Number(e.target.value))}
                  />
                </label>
                <label className="config-item">
                  <span className="label-sm">Action</span>
                  <select
                    className="control-select"
                    value={rule.action}
                    onChange={(e) => updateRule(index, 'action', e.target.value)}
                  >
                    {ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </label>
                {rule.action === 'mute' && (
                  <label className="config-item">
                    <span className="label-sm">Duration</span>
                    <input
                      type="text"
                      placeholder="e.g. 1h"
                      value={rule.duration || ''}
                      onChange={(e) => updateRule(index, 'duration', e.target.value)}
                    />
                  </label>
                )}
                <button type="button" className="btn-icon" onClick={() => removeRule(index)} aria-label="Remove rule">
                  <i className="fa-solid fa-trash" />
                </button>
                {errors[index] && <p className="field-error">{errors[index]}</p>}
              </div>
            ))}
          </div>
        )}

        <button type="button" className="btn-secondary" onClick={addRule}>
          <i className="fa-solid fa-plus" /> Add rule
        </button>
      </section>

      <section className="glass-panel section-card">
        <div className="section-title">
          <i className="fa-solid fa-folder-open" />
          <h3>Case History</h3>
        </div>

        <div className="toolbar-row">
          <input
            type="text"
            placeholder="Search by user, moderator, or reason"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <select className="control-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="all">All actions</option>
            <option value="delete">Delete</option>
            <option value="warn">Warn</option>
            <option value="mute">Mute</option>
            <option value="kick">Kick</option>
            <option value="ban">Ban</option>
          </select>
        </div>

        {filteredCases.length === 0 ? (
          <EmptyState icon="fa-folder-open" title="No cases match" message="Try a different filter or search term." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Target</th>
                  <th>Moderator</th>
                  <th>Action</th>
                  <th>Source</th>
                  <th>Reason</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Case">#{c.caseNumber}</td>
                    <td data-label="Target">{c.targetTag || c.targetId}</td>
                    <td data-label="Moderator">{c.moderatorTag || c.moderatorId}</td>
                    <td data-label="Action"><span className="tag-pill">{c.action}</span></td>
                    <td data-label="Source">{c.source}</td>
                    <td data-label="Reason">{c.reason || '—'}</td>
                    <td data-label="Date">{formatDate(c.createdAt)}</td>
                    <td data-label="">
                      <ConfirmButton label="Expunge" icon="fa-trash" onConfirm={() => deleteCase(c.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SaveBar
        visible={dirty}
        saving={saving}
        saveDisabled={hasErrors}
        onRevert={revert}
        onSave={saveRules}
        message={hasErrors ? 'Fix the highlighted rule errors before saving.' : 'You have unsaved punish-config changes.'}
      />
    </div>
  );
}
