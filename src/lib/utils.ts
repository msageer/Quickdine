export const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3, delay = 1000) => {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const enhancedOptions: RequestInit = {
    ...options,
    headers,
  };

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, enhancedOptions);
      if (!res.ok) {
        // If it's a 4xx error (like 401 Unauthorized or 404 Not Found), don't retry
        if (res.status >= 400 && res.status < 500) {
          return res;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Fetch failed after retries');
};

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
};
