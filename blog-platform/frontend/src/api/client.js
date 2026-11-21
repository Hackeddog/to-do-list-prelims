const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:4000';
const BLOG_URL = import.meta.env.VITE_BLOG_URL || 'http://localhost:5000/api';

const ACCESS_KEY = 'blog_access_token';
const REFRESH_KEY = 'blog_refresh_token';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new Event('blog-auth-cleared'));
}

export function decodeJwt(token) {
  if (!token) return null;
  try {
    const [, encodedPayload] = token.split('.');
    if (!encodedPayload) return null;
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isTokenExpired(payload) {
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000 - 5000;
}

let refreshPromise = null;

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${AUTH_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken })
      });
      if (!response.ok) {
        clearTokens();
        return null;
      }
      const data = await response.json();
      setTokens({ accessToken: data.accessToken });
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function request(baseUrl, path, options = {}, { auth = false, retry = true } = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (auth && response.status === 401 && retry) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      return request(baseUrl, path, options, { auth, retry: false });
    }
  }

  const data = await parseJsonSafe(response);
  if (!response.ok) {
    const err = new Error(data.error || `Request failed with status ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return data;
}

export const authApi = {
  register(payload) {
    return request(AUTH_URL, '/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  login(payload) {
    return request(AUTH_URL, '/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  logout(refreshToken) {
    return request(AUTH_URL, '/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  }
};

export const postsApi = {
  list() {
    return request(BLOG_URL, '/posts');
  },
  getById(id) {
    return request(BLOG_URL, `/posts/${encodeURIComponent(id)}`);
  },
  listMine() {
    return request(BLOG_URL, '/me/posts', {}, { auth: true });
  },
  create(payload) {
    return request(
      BLOG_URL,
      '/posts',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      { auth: true }
    );
  },
  update(id, payload) {
    return request(
      BLOG_URL,
      `/posts/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload)
      },
      { auth: true }
    );
  },
  remove(id) {
    return request(
      BLOG_URL,
      `/posts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      { auth: true }
    );
  }
};
