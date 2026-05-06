const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('admin_token')
}

export function setToken(token: string) {
  localStorage.setItem('admin_token', token)
}

export function removeToken() {
  localStorage.removeItem('admin_token')
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // Only set Content-Type for requests with a body (not GET/HEAD)
  const method = (options.method || 'GET').toUpperCase()
  if (options.body && method !== 'GET' && method !== 'HEAD' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    signal: options.signal,
  })

  if (res.status === 401) {
    removeToken()
    localStorage.removeItem('admin_user')
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('登录已过期，请重新登录')
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || body.message || detail
    } catch {}
    throw new Error(detail)
  }

  return res.json()
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, email: string, password: string) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  changePassword: (oldPassword: string, newPassword: string) =>
    request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),

  getMe: () => request('/api/auth/me'),

  updateProfile: (data: { username?: string; email?: string; phone?: string; avatar?: string }) =>
    request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

// Knowledge API
export const knowledgeApi = {
  listDocuments: (opts?: { signal?: AbortSignal }) =>
    request('/api/knowledge/documents', { signal: opts?.signal }),

  uploadDocument: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const token = getToken()
    const res = await fetch(`${API_BASE}/api/knowledge/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })

    if (res.status === 401) {
      removeToken()
      localStorage.removeItem('admin_user')
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('登录已过期，请重新登录')
    }

    if (!res.ok) {
      let detail = `上传失败: ${res.status}`
      try {
        const body = await res.json()
        detail = body.detail || body.error || detail
      } catch {}
      throw new Error(detail)
    }

    return res.json()
  },

  getDocument: (id: string) => request(`/api/knowledge/documents/${id}`),

  deleteDocument: (id: string) =>
    request(`/api/knowledge/documents/${id}`, { method: 'DELETE' }),

  getMarkdown: (id: string) => request(`/api/knowledge/documents/${id}/markdown`),

  getDownloadUrl: (id: string) => request(`/api/knowledge/documents/${id}/download`),

  retryDocument: (id: string) =>
    request(`/api/knowledge/documents/${id}/reparse`, { method: 'POST' }),

  getDocumentLogs: (id: string) =>
    request(`/api/knowledge/documents/${id}/logs`),

  getImageUrl: (key: string) =>
    request(`/api/knowledge/image-url?key=${encodeURIComponent(key)}`),
}

// Graph API
export const graphApi = {
  getGraphData: (opts?: { signal?: AbortSignal }) =>
    request('/api/graph/data', { signal: opts?.signal }),

  searchGraph: (q: string, opts?: { signal?: AbortSignal }) =>
    request(`/api/graph/search?q=${encodeURIComponent(q)}`, { signal: opts?.signal }),

  getStats: () => request('/api/graph/stats'),

  mergeScan: () => request('/api/graph/merge/scan', { method: 'POST' }),

  mergePreview: (entityIds: string[], mergedLabel: string, mergedSummary: string) =>
    request('/api/graph/merge/preview', {
      method: 'POST',
      body: JSON.stringify({ entity_ids: entityIds, merged_label: mergedLabel, merged_summary: mergedSummary }),
    }),

  mergeExecute: (entityIds: string[], mergedLabel: string, mergedSummary: string) =>
    request('/api/graph/merge/execute', {
      method: 'POST',
      body: JSON.stringify({
        entity_ids: entityIds,
        merged_label: mergedLabel,
        merged_summary: mergedSummary,
      }),
    }),
}

// Search API
export const searchApi = {
  query: (question: string) =>
    request('/api/search', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
}

// Users API
export const usersApi = {
  list: () => request('/api/users'),
  create: (data: { username: string; email: string; password: string; phone?: string; roles?: string[] }) =>
    request('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request(`/api/users/${id}`, { method: 'DELETE' }),
}

// Roles API
export const rolesApi = {
  list: () => request('/api/roles'),
  create: (data: { name: string; code: string; description?: string; permissions?: string[] }) =>
    request('/api/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    request(`/api/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request(`/api/roles/${id}`, { method: 'DELETE' }),
}

// Permissions API
export const permissionsApi = {
  listModules: () => request('/api/permissions'),
}
