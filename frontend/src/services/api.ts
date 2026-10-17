
const API_BASE = "http://127.0.0.1:8000/api";

export function getApiBase(): string {
  return API_BASE;
}

export function getWebSocketUrl(path: string): string {
  const base = new URL(API_BASE);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";

  return `${base.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`,
    {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}
