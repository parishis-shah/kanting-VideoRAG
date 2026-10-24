import { mediaUrl } from './api.js';
import { api } from './api.js';
import * as S from './store.js';
const { state, VS, PROCESSING } = S;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const ytId = (u) => (u || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/)?.[1] || null;
const isLocal = (u) => u?.startsWith('/media/') || u?.startsWith('blob:') || u?.startsWith('http://127.0.0.1');
const btnDark = 'bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded text-sm text-white font-medium';
const bar = (p) => `<div class="mt-1 progress-bar"><div class="progress-bar-fill" style="width:${p || 0}%"></div></div>`;

// ---------- status bar ----------
function renderStatus() {
  const { stats, connected } = state;
  const ago = !stats.lastIndexed ? 'never' : 'just now';
  $('status').innerHTML = `
    <div class="flex items-baseline gap-2"><a href="index.html" class="font-medium text-xl">Kanting</a><span class="text-sm text-gray-500 font-light">看听</span></div>
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-4 text-sm text-gray-600 font-light">
        <span><b class="text-gray-900 font-medium">${stats.videoCount}</b> videos</span><span class="text-gray-300">•</span>
        <span><b class="text-gray-900 font-medium">${stats.segmentCount}</b> segments</span><span class="text-gray-300">•</span>
        <span class="text-gray-500">indexed ${ago}</span></div>
      <span class="text-xs ${connected ? 'text-emerald-600' : 'text-red-600'}">● ${connected ? 'Connected' : 'Offline'}</span>
      <button data-act="upload" class="${btnDark}">⬆ Add Video</button>
    </div>`;
}

// ---------- library ----------
function renderLibrary() {
  const list = Object.values(state.videos);
  const groups = {};
  list.forEach((v) => (groups[v.folder || 'default'] ||= []).push(v));
  const card = (v) => {
    const st = v.state, proc = PROCESSING.includes(st.status), id = ytId(v.youtubeUrl);
    return `<div data-video="${esc(v.id)}" class="rounded overflow-hidden cursor-pointer border card-shadow hover-lift ${v.id === state.activeVideoId ? 'bg-gray-50 border-gray-300' : 'bg-white hover:bg-gray-50 border-gray-200'}">
      ${id ? `<div class="aspect-video bg-neutral-100 relative"><img class="w-full h-full object-cover" src="https://img.youtube.com/vi/${id}/mqdefault.jpg" alt="">${proc ? '<div class="absolute inset-0 bg-white/90 flex items-center justify-center"><span class="animate-spin">⟳</span></div>' : ''}</div>` : ''}
      <div class="p-3"><p class="text-sm font-medium text-gray-900 truncate">${esc(v.title)}</p>
      ${st.status === VS.READY ? `<p class="text-xs text-gray-500 mt-0.5"><span class="status-dot status-dot-success"></span> ${st.segmentCount || 0} segments • ready</p>` : ''}
      ${proc ? `<div class="mt-1.5 text-xs text-amber-600 font-medium">${esc(st.status)}... ${st.progress || 0}%</div>${bar(st.progress)}` : ''}
      ${st.status === VS.ERROR ? `<p class="text-xs text-red-600 mt-0.5">${esc(st.message || 'Processing failed')}</p>` : ''}</div></div>`;
  };
  $('library').innerHTML = `<div class="p-4 border-b border-gray-200"><h2 class="text-sm font-medium text-gray-700 uppercase tracking-wide">Video Library</h2></div>
    <div class="flex-1 overflow-y-auto p-2 space-y-2">${list.length ? Object.entries(groups).map(([f, vs]) =>
      `<div class="space-y-2"><div class="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">${esc(f)}</div>${vs.map(card).join('')}</div>`).join('')
      : `<div class="text-center p-4 pt-12"><p class="text-sm text-gray-600 mb-4 font-light">No videos yet</p><button data-act="upload" class="${btnDark}">+ Add your first video</button></div>`}</div>
    ${list.length ? `<div class="p-2 border-t border-gray-200"><button data-act="upload" class="w-full px-4 py-2.5 rounded text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700">+ Add Video</button></div>` : ''}`;
}

// ---------- workspace ----------
let wsKey = '';
function renderWorkspace() {
  const v = S.getActiveVideo();
  const key = v ? [v.id, v.state.status, v.state.progress, !!v.summary, (v.transcript || []).length, state.seekCount, state.markers.length, state.highlighted.length].join('|') : 'none';
  if (key === wsKey) return;
  wsKey = key;
  const ws = $('workspace');
  if (!v) {
    ws.innerHTML = `<div class="p-8 max-w-2xl"><h2 class="text-2xl font-medium text-gray-900 mb-4 tracking-tight">Select a video to get started</h2>
      <p class="text-xl text-gray-600 font-light">Add a video from the library or upload a new one to begin asking questions.</p></div>`;
    return;
  }
  const t = state.currentTime, dur = v.duration || 600, pos = (x) => (x / dur) * 100;
  const proc = PROCESSING.includes(v.state.status), vid = ytId(v.youtubeUrl);
  const player = isLocal(v.youtubeUrl)
    ? `<video id="player" class="w-full h-full object-contain" src="${esc(mediaUrl(v.youtubeUrl))}" controls preload="metadata"></video>`
    : vid ? `<iframe class="w-full h-full" src="https://www.youtube.com/embed/${vid}?enablejsapi=1&start=${Math.floor(t)}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>`
    : '<div class="w-full h-full flex items-center justify-center bg-neutral-900"><p class="text-neutral-500">No video available</p></div>';
  const isHi = (s) => state.highlighted.some((h) => s.start >= h.start && s.start <= h.end);
  const isAct = (s) => t >= s.start && t < s.end;
  const topics = v.summary?.topics?.length ? v.summary.topics : [...new Set((v.summary?.text || '').split(/\s+/).map((w) => w.replace(/[^a-zA-Z]/g, '')).filter((w) => w.length > 6))].slice(0, 6);
  ws.innerHTML = `<div class="flex flex-col h-full overflow-hidden">
    <div class="shrink-0"><div class="bg-black relative aspect-video max-h-[45vh] mx-auto w-full">${player}
      ${proc ? `<div class="absolute inset-0 bg-neutral-950/95 flex items-center justify-center text-center"><div><div class="w-12 h-12 border-2 border-neutral-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div><p class="text-white font-medium">Processing video...</p><p class="text-xs text-neutral-400 mt-1">${esc(v.state.status)} • ${v.state.progress || 0}%</p></div></div>` : ''}</div>
      <div class="bg-white border-b border-neutral-200 px-4 py-3">
        <div id="timeline" class="relative h-8 bg-neutral-100 rounded-lg cursor-pointer overflow-hidden border border-neutral-200">
          <div class="absolute inset-y-0 left-0 bg-neutral-200" style="width:${pos(t)}%"></div>
          <div class="absolute top-0 bottom-0 w-0.5 bg-blue-600 z-20" style="left:${pos(t)}%"></div>
          ${state.markers.map((m) => `<div data-time="${m.time}" title="${fmt(m.time)}" class="absolute top-1 bottom-1 w-1 rounded-full z-10 bg-blue-600" style="left:${pos(m.time)}%"></div>`).join('')}</div>
        <div class="flex justify-between text-xs text-neutral-600 mt-2"><span class="font-mono">${fmt(t)} / ${fmt(dur)}</span>${state.markers.length ? `<span>${state.markers.length} moments found</span>` : ''}</div></div></div>
    <div class="flex-1 overflow-y-auto"><div class="p-6 space-y-6">
      <div class="bg-white border border-neutral-200 rounded-xl shadow-sm"><div class="px-5 py-4 border-b border-neutral-200 bg-neutral-50 flex justify-between"><h3 class="font-semibold">Video Overview</h3>
        <span class="badge ${v.state.status === VS.READY ? 'badge-success' : 'badge-warning'}">${v.state.status === VS.READY ? 'Ready to query' : proc ? 'Processing...' : esc(v.state.status)}</span></div>
        <div class="p-5 space-y-4"><div class="text-sm text-neutral-600">${fmt(v.duration || 0)} • ${v.state.segmentCount || 0} segments</div>
        ${v.summary?.text ? `<div><h4 class="text-sm font-semibold text-neutral-700 mb-2">Summary</h4><p class="text-sm text-neutral-700 leading-relaxed">${esc(v.summary.text)}</p></div>` : proc ? '<p class="text-sm text-neutral-600">Summary will appear when transcript is ready...</p>' : ''}
        ${topics.length ? `<div class="flex flex-wrap gap-2">${topics.map((x) => `<span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200">${esc(x)}</span>`).join('')}</div>` : ''}</div></div>
      <div class="bg-white border border-neutral-200 rounded-xl shadow-sm"><div class="px-5 py-4 border-b border-neutral-200 bg-neutral-50 flex justify-between"><h3 class="font-semibold">Transcript</h3><span class="text-xs text-neutral-500">Click to jump to moment</span></div>
        <div id="transcript" class="max-h-96 overflow-y-auto p-4 space-y-1">${(v.transcript || []).length ? v.transcript.map((s) => {
          const a = isAct(s), h = isHi(s);
          return `<div data-time="${s.start}" ${a ? 'data-active="1"' : ''} class="flex gap-3 p-3 rounded-lg cursor-pointer border ${a ? 'bg-blue-50 border-blue-200' : h ? 'bg-blue-100/50 border-blue-200' : 'hover:bg-neutral-50 border-transparent'}"><span class="font-mono text-xs shrink-0 mt-0.5 font-semibold ${a || h ? 'text-blue-600' : 'text-neutral-500'}">${fmt(s.start)}</span><p class="text-sm leading-relaxed ${a ? 'text-neutral-900 font-medium' : 'text-neutral-700'}">${esc(s.text)}</p></div>`;
        }).join('') : '<p class="p-4 text-sm text-neutral-500">No transcript is available yet.</p>'}</div></div>
    </div></div></div>`;
  const p = $('player'); if (p && Number.isFinite(t)) p.addEventListener('loadedmetadata', () => (p.currentTime = t), { once: true }), (p.currentTime = t);
  $('transcript')?.querySelector('[data-active]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ---------- query panel ----------
function renderQuery() {
  const v = S.getActiveVideo(), ready = v?.state?.status === VS.READY;
  const inp = $('qinput'); inp.disabled = !ready;
  inp.placeholder = ready ? 'Ask about videos in this folder...' : 'Select a ready video first...';
  $('chips').innerHTML = ready && !inp.value ? ['What is the main topic?', 'Summarize the key points', 'Explain the core concepts']
    .map((q) => `<button type="button" data-chip="${esc(q)}" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded text-xs text-gray-700 font-medium">${esc(q)}</button>`).join('') : '';
  const q = state.queries[state.queries.length - 1];
  if (!q) { $('results').innerHTML = `<div class="p-6"><p class="text-sm text-gray-900 font-medium mb-2">${v ? 'Ask a question about videos in this folder' : 'Select a video to start asking questions'}</p><p class="text-xs text-gray-500 font-light">Answers include timestamps and evidence</p></div>`; return; }
  let ans = '';
  if (q.loading) ans = '<div class="p-4 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-700"><span class="animate-spin inline-block">⟳</span> Searching through video...</div>';
  else if (q.error) ans = `<div class="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">${esc(q.error)}</div>`;
  else if (q.answer) ans = `<div class="bg-white border border-gray-200 rounded overflow-hidden"><div class="px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-700 uppercase tracking-wide">Answer</div>
    <div class="p-4"><p class="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">${esc(q.answer.text)}</p>
    ${q.answer.citations?.length ? `<div class="mt-4 pt-4 border-t border-gray-200"><h4 class="text-xs font-medium text-gray-700 uppercase tracking-wide mb-3">Sources</h4>${q.answer.citations.map((c) => `<button data-time="${c.timestamp}" class="w-full flex gap-3 p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-left"><span class="font-mono text-xs text-gray-500 shrink-0 font-medium">${fmt(c.timestamp)}</span><span class="text-xs text-gray-700 line-clamp-2">"${esc(c.text)}"</span></button>`).join('')}</div>` : ''}
    ${q.answer.videoUrl ? `<a href="${esc(q.answer.videoUrl)}" target="_blank" rel="noopener noreferrer" class="mt-4 block text-xs text-blue-600 font-medium">Open in YouTube ↗</a>` : ''}</div></div>`;
  const ev = (q.evidence || []).map((s, i) => `<div class="bg-white border border-neutral-200 rounded-xl p-3"><div class="flex gap-3"><div class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">${i + 1}</div>
    <div class="min-w-0"><span class="font-mono text-xs text-blue-600 font-semibold">${fmt(s.timestamp ?? s.start ?? 0)}</span>${s.confidence ? ` <span class="text-xs text-neutral-500">${Math.round(s.confidence * 100)}% match</span>` : ''}
    <p class="text-xs text-neutral-700 line-clamp-2 leading-relaxed">${esc(s.text || 'Retrieved segment content')}</p>${s.rationale ? `<p class="text-xs text-neutral-500 mt-1 italic">${esc(s.rationale)}</p>` : ''}</div></div>
    <div class="mt-3 pt-2 border-t border-neutral-200"><button data-jump="${i}" class="bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg text-xs text-white font-medium">▶ Jump</button></div></div>`).join('');
  $('results').innerHTML = `<div class="p-4 space-y-4"><div class="text-sm text-gray-900 font-medium">${esc(q.text)}</div>${ans}${ev ? `<div class="mt-4"><h4 class="text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-3">Retrieved Segments (${q.evidence.length})</h4><div class="space-y-2">${ev}</div></div>` : ''}</div>`;
}

// ---------- toasts ----------
function renderToasts() {
  const c = { success: 'border-emerald-200 bg-emerald-50 text-emerald-800', error: 'border-red-200 bg-red-50 text-red-800', info: 'border-blue-200 bg-blue-50 text-blue-800' };
  $('toasts').innerHTML = state.toasts.map((t) => `<div class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${c[t.type] || c.info}"><span class="font-medium text-sm">${esc(t.message)}</span><button data-toast="${t.id}" class="ml-2 opacity-70 hover:opacity-100">✕</button></div>`).join('');
}

// ---------- upload modal ----------
async function openModal() {
  let folders = ['default'];
  try { const f = await api.getFolders(); if (f.length) folders = f; } catch {}
  $('modal').innerHTML = `<div id="overlay" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"><div class="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg shadow-2xl">
    <div class="flex items-center justify-between p-4 border-b border-neutral-200 bg-neutral-50 rounded-t-2xl"><h2 class="text-lg font-semibold">Add Video</h2><button id="mclose" class="p-2">✕</button></div>
    <div class="p-6"><div id="drop" class="border-2 border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100 rounded-xl p-8 mb-6 text-center cursor-pointer">
      <p class="text-neutral-700 text-sm mb-1 font-medium">Drag and drop a video file here, or click to browse</p><p class="text-neutral-500 text-xs">MP4, WebM, MOV up to 500MB</p>
      <input id="file" type="file" accept="video/*,.mkv" class="hidden"></div>
      <p class="text-center text-xs text-neutral-500 uppercase font-medium mb-6">or</p>
      <form id="mform"><label class="block text-sm font-medium text-neutral-700 mb-2">YouTube URL</label>
      <input id="murl" type="url" placeholder="https://youtube.com/watch?v=..." class="w-full border border-neutral-300 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-600">
      <label class="block text-sm font-medium text-neutral-700 mb-2 mt-4">Folder</label>
      <input id="mfolder" list="flist" value="default" pattern="[A-Za-z0-9._ \\-]+" class="w-full border border-neutral-300 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-600">
      <datalist id="flist">${folders.map((f) => `<option value="${esc(f)}">`).join('')}</datalist>
      <p class="text-xs text-neutral-500 mt-2">Videos in the same folder are searched together.</p>
      <p id="mwarn" class="text-xs text-amber-600 mt-2 hidden">⚠️ Please enter a valid YouTube URL</p>
      <button id="msubmit" disabled class="bg-blue-600 hover:bg-blue-700 w-full mt-5 px-4 py-3 rounded-xl font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed">Add Video</button></form></div></div></div>`;
  const close = () => ($('modal').innerHTML = ''), folder = () => $('mfolder').value.trim() || 'default';
  const valid = (u) => /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(u);
  $('mclose').onclick = close;
  $('overlay').onclick = (e) => e.target.id === 'overlay' && close();
  $('murl').oninput = () => { const u = $('murl').value.trim(); $('msubmit').disabled = !valid(u); $('mwarn').classList.toggle('hidden', !u || valid(u)); };
  $('mform').onsubmit = (e) => { e.preventDefault(); const u = $('murl').value.trim(); if (!valid(u)) return; const f = folder(); close(); S.ingestVideo(u, f); };
  const handle = (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(file.name)) return S.toast('Please choose a supported video file', 'error');
    const f = folder(); close(); S.ingestUploadedVideo(file, f);
  };
  $('drop').onclick = () => $('file').click();
  $('file').onclick = (e) => e.stopPropagation();
  $('file').onchange = (e) => handle(e.target.files[0]);
  $('drop').ondragover = (e) => { e.preventDefault(); $('drop').classList.add('border-blue-600'); };
  $('drop').ondragleave = () => $('drop').classList.remove('border-blue-600');
  $('drop').ondrop = (e) => { e.preventDefault(); handle(e.dataTransfer.files[0]); };
}

// ---------- wiring ----------
function render() { renderStatus(); renderLibrary(); renderWorkspace(); renderQuery(); renderToasts(); }
S.subscribe(render);

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act],[data-video],[data-time],[data-chip],[data-jump],[data-toast]');
  if (!t) return;
  if (t.dataset.act === 'upload') openModal();
  else if (t.dataset.video) S.setActiveVideo(t.dataset.video);
  else if (t.dataset.chip) { $('qinput').value = t.dataset.chip; $('qinput').focus(); renderQuery(); }
  else if (t.dataset.toast) S.removeToast(Number(t.dataset.toast));
  else if (t.dataset.jump !== undefined) {
    const s = state.queries[state.queries.length - 1].evidence[Number(t.dataset.jump)];
    if (s.video_id) state.activeVideoId = s.video_id;
    if (s.start !== undefined && s.end !== undefined) state.highlighted = [{ start: s.start, end: s.end }];
    S.seek(s.timestamp ?? s.start ?? 0);
  } else if (t.dataset.time !== undefined) S.seek(Number(t.dataset.time));
});
document.addEventListener('click', (e) => {
  const tl = e.target.closest('#timeline');
  if (tl && !e.target.closest('[data-time]')) {
    const r = tl.getBoundingClientRect(), v = S.getActiveVideo();
    S.seek(((e.clientX - r.left) / r.width) * (v?.duration || 600));
  }
});
$('qinput').addEventListener('input', renderQuery);
$('qform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('qinput').value.trim(), v = S.getActiveVideo();
  if (!q || v?.state?.status !== VS.READY) return;
  $('qinput').value = '';
  await S.queryVideo(q);
});

render();
S.fetchStats(); S.loadVideos(); S.checkHealth();
setInterval(S.checkHealth, 30000);
