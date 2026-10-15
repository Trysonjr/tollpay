import { API_BASE } from '../config';

const TOKEN_KEY = 'toll_access_token';
const REFRESH_KEY = 'toll_refresh_token';

export class ApiError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;        // screens switch on this: INVALID_OTP, DUPLICATE_PLATE...
    this.details = details;
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

export function setTokens(access, refresh) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function rawFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON response */ }
  return { status: res.status, json };
}

let refreshing = null; // dedupes concurrent refresh calls

async function doRefresh() {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  if (!refreshing) {
    refreshing = rawFetch('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refresh },
    })
      .then(({ json }) => {
        if (json?.success) {
          setTokens(json.data.access_token, json.data.refresh_token);
          return true;
        }
        clearTokens();
        return false;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(path, { method = 'GET', body } = {}) {
  let token = getToken();
  let { status, json } = await rawFetch(path, { method, body, token });

  // Token expired? Refresh once and retry — invisible to the screens
  if (status === 401 && token && (await doRefresh())) {
    token = getToken();
    ({ status, json } = await rawFetch(path, { method, body, token }));
  }

  if (!json) throw new ApiError('NETWORK_ERROR', 'Could not reach the server');
  if (!json.success) {
    throw new ApiError(json.error?.code ?? 'UNKNOWN',
                       json.error?.message ?? 'Request failed',
                       json.error?.details);
  }
  return json.data;
}