async function request(path, options = {}) {
  const res = await fetch(path, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) =>
    request(p, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }),
  put: (p, body) =>
    request(p, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }),
  del: (p) => request(p, { method: 'DELETE' }),

  uploadFiles: async (files) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    const res = await fetch('/api/uploads', { method: 'POST', body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    return data.urls;
  },

  updateShift: (id, data) =>
    request(`/api/shifts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  updatePatrol: (id, slot, data) =>
    request(`/api/shifts/${id}/patrols/${slot}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  saveChecklist: (id, slot, checklist) =>
    request(`/api/shifts/${id}/patrols/${slot}/checklist`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist }),
    }),

  previewReport: (kind, data) =>
    request(`/api/reports/${kind}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  sites: {
    list: () => request('/api/sites'),
    create: (data) =>
      request('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      request(`/api/sites/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    remove: (id) => request(`/api/sites/${id}`, { method: 'DELETE' }),
  },

  llm: {
    list: () => request('/api/llm-profiles'),
    create: (data) =>
      request('/api/llm-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      request(`/api/llm-profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    remove: (id) => request(`/api/llm-profiles/${id}`, { method: 'DELETE' }),
    setDefault: (id) =>
      request(`/api/llm-profiles/${id}/default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
    test: (id) =>
      request(`/api/llm-profiles/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
  },
};