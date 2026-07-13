import type { AuthUser, MeResponse } from '@platform/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: { path: string; message: string }[]
  ) {
    super(message);
  }
}

/** Fetch wrapper — uvijek šalje cookies, parsira JSON greške u ApiError. */
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`, body.fields);
  }
  return res.json();
}

export const authApi = {
  login: (email: string, password: string) =>
    api<AuthUser>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => api('/api/auth/logout', { method: 'POST' }),
  me: () => api<MeResponse>('/api/auth/me'),
};
