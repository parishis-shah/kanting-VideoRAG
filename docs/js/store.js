import { api } from './api.js';

export const VS = { UPLOADING: 'uploading', TRANSCRIBING: 'transcribing', SEGMENTING: 'segmenting', INDEXING: 'indexing', READY: 'ready', ERROR: 'error' };
export const PROCESSING = [VS.UPLOADING, VS.TRANSCRIBING, VS.SEGMENTING, VS.INDEXING];

export const state = {
  videos: {}, activeVideoId: null, queries: [],
  stats: { videoCount: 0, segmentCount: 0, lastIndexed: null },
  currentTime: 0, seekCount: 0, highlighted: [], markers: [], toasts: [], connected: false,
};

const listeners = [];
export const subscribe = (fn) => listeners.push(fn);
export const emit = () => listeners.forEach((fn) => fn(state));

export const getActiveVideo = () => state.videos[state.activeVideoId] || null;
export function setActiveVideo(id) { state.activeVideoId = id; emit(); }
export function seek(t) { state.currentTime = t; state.seekCount++; emit(); }
export function setHighlighted(h) { state.highlighted = h; emit(); }
export function updateVideo(id, u) { state.videos[id] = { ...state.videos[id], ...u }; emit(); }

export function toast(message, type = 'info') {
  const id = Date.now() + Math.random();
  state.toasts.push({ id, message, type }); emit();
  setTimeout(() => removeToast(id), 4000);
}
export function removeToast(id) { state.toasts = state.toasts.filter((t) => t.id !== id); emit(); }

export async function fetchStats() {
  try {
    const d = await api.getStats();
    state.stats = { videoCount: d.total_videos || 0, segmentCount: d.total_segments || 0, lastIndexed: new Date() };
    emit();
  } catch (e) { console.error('Failed to fetch stats:', e); }
}

export async function loadVideos() {
  try {
    const list = await api.getVideos();
    const videos = {};
    list.forEach((v) => {
      const segs = v.segments || [];
      videos[v.id] = {
        id: v.id, title: v.title, folder: v.folder || 'default', youtubeUrl: v.youtubeUrl,
        duration: segs.length ? segs[segs.length - 1].end : 0,
        state: { status: VS.READY, segmentCount: segs.length },
        summary: v.summary ? { text: v.summary, topics: [] } : null,
        transcript: segs, segments: segs, addedAt: null,
      };
    });
    state.videos = videos; emit();
  } catch (e) { console.error('Failed to load indexed videos:', e); }
}

export async function checkHealth() {
  try { await api.healthCheck(); state.connected = true; } catch { state.connected = false; }
  emit();
}

const applyResult = (id, r, fallbackTitle, fallbackUrl, folder) => updateVideo(id, {
  title: r.video_id || r.filename || fallbackTitle,
  folder: r.folder || folder,
  youtubeUrl: r.video_url || fallbackUrl,
  state: { status: VS.SEGMENTING, progress: 70, segmentCount: r.segment_count || 0 },
  transcript: r.transcript || [], segments: r.transcript || [],
  summary: r.summary ? { text: r.summary, topics: [] } : null,
});
const base = (id, title, url, folder, status) => ({
  id, title, youtubeUrl: url, folder, duration: 0, state: { status, progress: 0 },
  summary: null, transcript: null, segments: [], addedAt: new Date(),
});

export async function ingestVideo(url, folderName = 'default') {
  const id = `video_${Date.now()}`, folder = folderName.trim() || 'default';
  state.videos[id] = base(id, 'Loading...', url, folder, VS.UPLOADING); emit();
  updateVideo(id, { state: { status: VS.TRANSCRIBING, progress: 20 } });
  try {
    const r = await api.storeTranscript(url, folder);
    if (r.error) { updateVideo(id, { state: { status: VS.ERROR, message: r.error } }); return toast(r.error, 'error'); }
    applyResult(id, r, 'Video', url, folder);
    updateVideo(id, { state: { status: VS.READY, segmentCount: r.segment_count || 0 } });
    toast(`"${state.videos[id].title}" ready to query`, 'success'); fetchStats();
  } catch (e) {
    updateVideo(id, { state: { status: VS.ERROR, message: e.message } });
    toast('Failed to process video', 'error');
  }
}

export async function ingestUploadedVideo(file, folderName = 'default') {
  const id = `video_${Date.now()}`, folder = folderName.trim() || 'default';
  const preview = URL.createObjectURL(file);
  state.videos[id] = base(id, file.name, preview, folder, VS.UPLOADING); emit();
  try {
    updateVideo(id, { state: { status: VS.TRANSCRIBING, progress: 20 } });
    const r = await api.uploadVideo(file, folder);
    applyResult(id, r, file.name, preview, folder);
    updateVideo(id, { state: { status: VS.READY, segmentCount: r.segment_count || 0 } });
    toast(`"${file.name}" ready to query`, 'success'); fetchStats();
  } catch (e) {
    updateVideo(id, { state: { status: VS.ERROR, message: e.message } });
    toast(e.message || 'Failed to upload video', 'error');
  }
}

export async function queryVideo(text) {
  const folder = getActiveVideo()?.folder || 'default';
  const q = { id: `query_${Date.now()}`, text, loading: true, answer: null, evidence: [] };
  state.queries.push(q); emit();
  const patch = (u) => { Object.assign(q, u); emit(); };
  try {
    const r = await api.query(text, folder);
    if (r.error) { patch({ loading: false, error: r.error }); return toast(r.error, 'error'); }
    const clip = r.clip_start ?? r.timestamp;
    if (r.video_id && state.videos[r.video_id]) { state.activeVideoId = r.video_id; if (clip !== undefined) { state.currentTime = clip; state.seekCount++; } }
    const citations = clip !== undefined ? [{ timestamp: clip, text: r.segments?.[0]?.text || (r.answer || '').slice(0, 100) + '...' }] : [];
    if (clip !== undefined) { state.markers = [{ time: clip, type: 'citation' }]; state.highlighted = [{ start: clip, end: clip + 30 }]; }
    patch({ loading: false, answer: { text: r.answer, citations, videoUrl: r.video_url }, evidence: r.segments || [] });
  } catch (e) { patch({ loading: false, error: e.message }); toast('Query failed', 'error'); }
}
