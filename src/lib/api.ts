import { getIdToken } from './auth';

export class ApiRequestError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const WORKSPACE_KEY = 'activeWorkspaceId';

/** Oficina escolhida pelo admin geral (null = a própria). O servidor ignora para os demais usuários. */
export function getActiveWorkspace(): string | null {
  try { return localStorage.getItem(WORKSPACE_KEY); } catch { return null; }
}

export function setActiveWorkspace(id: string | null) {
  try {
    if (id) localStorage.setItem(WORKSPACE_KEY, id);
    else localStorage.removeItem(WORKSPACE_KEY);
  } catch { /* sem storage: fica na própria oficina */ }
}

/** fetch com o token do Cognito. Use para qualquer rota /api do próprio servidor. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const workspace = getActiveWorkspace();
  if (workspace) headers.set('X-Workspace-Id', workspace);
  return fetch(input, { ...init, headers });
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  // Oficina escolhida foi excluída: volta para a própria.
  if (body.code === 'WORKSPACE_NOT_FOUND' && getActiveWorkspace()) {
    setActiveWorkspace(null);
    window.location.reload();
  }
  if (!res.ok) throw new ApiRequestError(res.status, body.code ?? 'HTTP_ERROR', body.error ?? `Erro ${res.status}`);
  return body as T;
}

export const apiGet = <T>(p: string) => api<T>(p);
export const apiPost = <T>(p: string, body?: unknown) => api<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) });
export const apiPatch = <T>(p: string, body: unknown) => api<T>(p, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDelete = (p: string, body?: unknown) =>
  api<void>(p, { method: 'DELETE', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

/**
 * Datas chegam como ISO string. As telas foram escritas para o Timestamp do Firestore
 * (toDate/toMillis/seconds), então embrulhamos para manter compatibilidade.
 */
export class AppTimestamp {
  constructor(private readonly iso: string) {}
  toDate() { return new Date(this.iso); }
  toMillis() { return this.toDate().getTime(); }
  get seconds() { return Math.floor(this.toMillis() / 1000); }
  toJSON() { return this.iso; }
  toString() { return this.iso; }
}

const DATE_FIELDS = ['createdAt', 'updatedAt', 'timestamp'] as const;

export function hydrateDates<T>(row: T): T {
  const out = { ...row } as Record<string, unknown>;
  for (const f of DATE_FIELDS) {
    if (typeof out[f] === 'string') out[f] = new AppTimestamp(out[f] as string);
  }
  return out as T;
}

/** Escuta /events (SSE) e chama onChange(recurso). Reconecta com token novo se cair. */
export function subscribeChanges(onChange: (resource: string) => void): () => void {
  let es: EventSource | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const connect = async () => {
    const token = await getIdToken();
    if (closed || !token) return;
    es = new EventSource(`/api/v1/events?token=${encodeURIComponent(token)}`);
    es.addEventListener('change', (e) => onChange((e as MessageEvent).data));
    es.onerror = () => {
      es?.close();
      if (!closed) retry = setTimeout(connect, 3000);
    };
  };
  connect();

  return () => {
    closed = true;
    clearTimeout(retry);
    es?.close();
  };
}
