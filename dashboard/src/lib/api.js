const getCache = new Map();
const pendingGets = new Map();

const ttlByPath = [
  [/\/api\/guilds\/[^/]+\/meta$/, 5 * 60_000],
  [/\/api\/guilds$/, 60_000]
];

function getTtl(path) {
  return ttlByPath.find(([pattern]) => pattern.test(path))?.[1] ?? 15_000;
}

function invalidateRelated(path) {
  const guildMatch = path.match(/\/api\/guilds\/([^/]+)/);
  const keys = [...getCache.keys()];

  for (const key of keys) {
    if (key === path || (guildMatch && key.includes(`/api/guilds/${guildMatch[1]}/`)) || key === '/api/guilds') {
      getCache.delete(key);
    }
  }
}

async function parseErrorMessage(response) {
  try {
    const data = await response.json();
    if (data && typeof data.error === 'string') return data.error;
  } catch {
    // ignore parse errors, fall through to generic message
  }
  return `Request failed with status ${response.status}`;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...options
  });

  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = new Error(await parseErrorMessage(response));
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiGet(path, options = {}) {
  const useCache = options.cache !== false;
  const cached = getCache.get(path);

  if (useCache && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (useCache && pendingGets.has(path)) {
    return pendingGets.get(path);
  }

  const pending = request(path)
    .then((data) => {
      if (useCache) {
        getCache.set(path, { data, expiresAt: Date.now() + getTtl(path) });
      }
      return data;
    })
    .finally(() => pendingGets.delete(path));

  if (useCache) pendingGets.set(path, pending);
  return pending;
}

async function mutate(path, method, body) {
  const data = await request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  invalidateRelated(path);
  return data;
}

export function apiPost(path, body) {
  return mutate(path, 'POST', body);
}

export function apiPut(path, body) {
  return mutate(path, 'PUT', body);
}

export function apiDelete(path, body) {
  return mutate(path, 'DELETE', body);
}
