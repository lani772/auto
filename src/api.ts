import { createAuthClient } from '@neondatabase/auth';

export const neonAuth = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL);

async function bearerHeaders() {
  try {
    const result = await neonAuth.token();
    const token = result?.data?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    // Public API requests must work when no user is signed in.
    return {};
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<{ data: T }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(await bearerHeaders()) };
  const response = await fetch(path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return { data: payload as T };
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T = any>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T = any>(path: string) => request<T>('DELETE', path),
};

export const auth = {
  async getUser() {
    const result = await neonAuth.getSession();
    return result?.data?.user ?? null;
  },
  async signIn(email: string, password: string) {
    const result = await neonAuth.signIn.email({ email, password });
    if (result?.error) throw new Error(result.error.message || 'Sign-in failed');
    return result;
  },
  async signUp(name: string, email: string, password: string) {
    const result = await neonAuth.signUp.email({ name, email, password });
    if (result?.error) throw new Error(result.error.message || 'Account creation failed');
    return result;
  },
  async signOut() { await neonAuth.signOut(); },
};
