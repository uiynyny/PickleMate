export const BASE_URL: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_API_BASE_URL) ||
  'http://localhost:3000';

export interface ApiRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  data?: any;
  auth?: boolean;
}

export interface ApiResponse<T = any> {
  statusCode: number;
  data: T;
}

async function rawRequest<T = any>(
  fullUrl: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  data: any,
  headers: Record<string, string>,
): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method: method as any,
      data,
      header: headers,
      success: (res: any) => {
        resolve({
          statusCode: res.statusCode,
          data: res.data as T,
        });
      },
      fail: (err: any) => {
        reject(err);
      },
    });
  });
}

export async function apiRequest<T = any>(
  options: ApiRequestOptions,
): Promise<ApiResponse<T>> {
  const { url, method = 'GET', data, auth = true } = options;
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = uni.getStorageSync('token');
  if (auth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await rawRequest<T>(fullUrl, method, data, headers);

  if (res.statusCode === 401 && auth) {
    const refreshToken = uni.getStorageSync('refreshToken');
    if (refreshToken && !url.includes('/auth/refresh')) {
      try {
        const refreshRes = await rawRequest<{ accessToken?: string }>(
          `${BASE_URL}/auth/refresh`,
          'POST',
          { refreshToken },
          { 'Content-Type': 'application/json' },
        );
        if (refreshRes.statusCode === 200 && refreshRes.data?.accessToken) {
          uni.setStorageSync('token', refreshRes.data.accessToken);
          headers['Authorization'] = `Bearer ${refreshRes.data.accessToken}`;
          return rawRequest<T>(fullUrl, method, data, headers);
        }
      } catch {
        // Ignore refresh error and return original 401
      }
    }
  }

  return res;
}
