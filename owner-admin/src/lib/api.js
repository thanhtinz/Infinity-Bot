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

export function apiGet(path) {
  return request(path);
}

function mutate(path, method, body) {
  return request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
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
