// Backend URL. Empty = same origin. For local Flask use: http://127.0.0.1:5000
export const API_URL = window.KANTING_API_URL || localStorage.getItem('kanting_api') || 'http://127.0.0.1:5000';
export const mediaUrl = (u) => (u && u.startsWith('/media/') ? API_URL + u : u);

async function req(path, options) {
  const res = await fetch(API_URL + path, options);
  const body = await res.text();
  let data = {};
  try { data = body ? JSON.parse(body) : {}; }
  catch { throw new Error(`Backend returned an invalid response (${res.status})`); }
  if (!res.ok) throw new Error(data.error || `Backend request failed (${res.status})`);
  return data;
}
const post = (path, obj) => req(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

export const api = {
  storeTranscript: (video_url, folder = 'default') => post('/store-transcript', { video_url, folder }),
  uploadVideo(file, folder = 'default') {
    const fd = new FormData(); fd.append('file', file); fd.append('folder', folder);
    return req('/upload-video', { method: 'POST', body: fd });
  },
  query: (query, folder = 'default') => post('/query', { query, folder }),
  getStats: () => req('/stats'),
  getVideos: () => req('/videos'),
  getFolders: () => req('/folders'),
  healthCheck: () => req('/health'),
};
