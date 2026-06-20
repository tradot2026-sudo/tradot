// Simple fetch wrapper for API calls
export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const { headers: customHeaders, ...restOptions } = options || {};
  const res = await fetch(url, {
    ...restOptions,
    headers: { 'Content-Type': 'application/json', ...(customHeaders as Record<string, string>) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(url: string) => apiFetch<T>(url),
  post: <T>(url: string, data: unknown) => apiFetch<T>(url, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(url: string, data: unknown) => apiFetch<T>(url, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T>(url: string, data: unknown) => apiFetch<T>(url, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(url: string) => apiFetch<T>(url, { method: 'DELETE' }),
};
