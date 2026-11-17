export const session = { get token() { return localStorage.getItem('token'); } };
export async function api(path, { method = 'GET', body, params } = {}) {
  const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))) : '';
  const r = await fetch('/api' + path + qs, { method, headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: 'Bearer ' + session.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/auth/login') { localStorage.clear(); location.reload(); }
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
export const money = n => '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
