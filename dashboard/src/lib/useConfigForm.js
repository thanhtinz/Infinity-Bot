import { useCallback, useEffect, useState } from 'react';
import { clone, deepEqual } from './format';

// Generic "load an object, track dirty state against the original, save/revert" hook
// used by config-style pages (AutoModeration, Protection, Welcome, Logging, etc).
export function useConfigForm(loadFn, deps = []) {
  const [config, setConfigState] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadFn();
      setConfigState(clone(data));
      setOriginal(clone(data));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  const setConfig = useCallback((updater) => {
    setConfigState((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const revert = useCallback(() => {
    setConfigState(clone(original));
  }, [original]);

  const dirty = config !== null && original !== null && !deepEqual(config, original);

  const commit = useCallback((nextValue) => {
    const value = clone(nextValue);
    setConfigState(value);
    setOriginal(value);
  }, []);

  return {
    config,
    setConfig,
    original,
    loading,
    error,
    saving,
    setSaving,
    dirty,
    reload: load,
    revert,
    commit
  };
}
