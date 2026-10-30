const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8081')
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');
const API_BASE_URL = `${BACKEND_ORIGIN}/api`;
export const BACKEND_BASE_URL = BACKEND_ORIGIN;

export const getImageUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  // In Vite development, /uploads is proxied to Go so PDF.js can read course
  // documents without a cross-origin request.
  if (import.meta.env.DEV && cleanPath.startsWith('/uploads/')) return cleanPath;
  return `${BACKEND_BASE_URL}${cleanPath}`;
};

export function resolveBackendAssetUrl(value?: string | null): string {
  if (!value || /^(https?:|blob:|data:)/i.test(value)) return value || '';
  return getImageUrl(value);
}

export async function apiRequest(endpoint: string, options: RequestOptions = {}) {
  const token = localStorage.getItem('akademia-token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const normalizedEndpoint = endpoint.replace(/^\/+/, '').replace(/^api\//i, '');
  const response = await fetch(`${API_BASE_URL}/${normalizedEndpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const payload = JSON.parse(errorText) as { message?: string };
      throw new Error(payload.message || 'Something went wrong');
    } catch (error) {
      if (error instanceof Error && error.message !== errorText) throw error;
      throw new Error(errorText || 'Something went wrong');
    }
  }

  return response.json();
}

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}