/* Axis Drive - main app (plain JavaScript, no frameworks).
 *
 * All text coming from the server is inserted with textContent (never innerHTML),
 * so a file named "<img onerror=...>" is shown as plain text.
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);

  // el('div', {class: 'x', onclick: fn}, child1, 'text', null)
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  const pad = (n) => String(n).padStart(2, '0');

  function fmtBytes(n) {
    if (!n) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let value = n;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
    return (i < 2 ? Math.round(value) : value.toFixed(1)) + ' ' + units[i];
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(String(iso).replace(/\.\d+/, ''));   // drop microseconds if present
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const KIND_ICON = { folder: '📁', image: '🖼️', video: '🎞️', audio: '🎵', pdf: '📕', text: '📝', other: '📄' };
  const iconFor = (item) => (item.type === 'folder' ? KIND_ICON.folder : KIND_ICON[item.kind] || KIND_ICON.other);

  // Same list as INLINE_SAFE on the server: these can be previewed in the browser.
  const INLINE = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm',
    'application/pdf',
  ]);

  // ------------------------------------------------------------------
  // API
  // ------------------------------------------------------------------
  // Login token: kept in localStorage and sent as a header. Cookies alone can be blocked
  // when the app is shown inside another page (embedded preview), so we do not rely on them.
  const TOKEN_KEY = 'axisDriveToken';
  let memoryToken = null;
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || memoryToken; } catch (_) { return memoryToken; }
  }
  function setToken(token) {
    memoryToken = token || null;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (_) { /* storage blocked: memory copy is still used */ }
  }
  // Sent twice (standard header + custom header) in case a proxy drops one of them
  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: 'Bearer ' + token, 'X-Drive-Token': token } : {};
  }

  async function api(path, options = {}) {
    const opts = { method: options.method || 'GET', headers: authHeaders(), credentials: 'same-origin' };
    if (opts.method !== 'GET') opts.headers['X-Drive-Client'] = '1';
    if (options.body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(options.body);
    }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (_) { /* not JSON */ }
    if (!res.ok) {
      const error = new Error((data && data.error) || `Something went wrong (${res.status}).`);
      error.status = res.status;
      throw error;
    }
    return data;
  }

  // ------------------------------------------------------------------
  // State and small UI helpers
  // ------------------------------------------------------------------
  const state = { user: null };
  let renderSeq = 0;
  let toastTimer = null;

  function showToast(message, isError) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.toggle('error', !!isError);
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 3800);
  }

  function notifyError(e) {
    if (e.status === 401) return showAuth();
    showToast(e.message || 'Something went wrong.', true);
  }

  function updateStorage(user) {
    if (!user) return;
    const pct = user.quota ? Math.min(100, (user.used / user.quota) * 100) : 0;
    const fill = $('#storage-fill');
    fill.style.width = pct.toFixed(1) + '%';
    fill.className = 'storage-fill' + (pct >= 100 ? ' full' : pct >= 80 ? ' warn' : '');
    $('#storage-text').textContent = `${fmtBytes(user.used)} of ${fmtBytes(user.quota)} used`;
    $('#user-name').textContent = user.name;
    $('#avatar').textContent = (user.name || '?').trim().charAt(0).toUpperCase();
    $('#account-email').textContent = user.email;
  }

  // Fetch a protected file with the login header and return a local blob: URL
  async function fetchObjectUrl(path) {
    const res = await fetch(path, { headers: authHeaders(), credentials: 'same-origin' });
    if (!res.ok) {
      let message = `Could not load the file (${res.status}).`;
      try { message = (await res.json()).error || message; } catch (_) { /* not JSON */ }
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    return URL.createObjectURL(await res.blob());
  }

  const thumbCache = new Map();   // file id -> Promise of blob URL
  function thumbUrl(id) {
    if (!thumbCache.has(id)) {
      const p = fetchObjectUrl(`/api/files/${id}/thumb`);
      thumbCache.set(id, p);
      p.catch(() => thumbCache.delete(id));
    }
    return thumbCache.get(id);
  }

  // Put a thumbnail into an <img>; if it cannot be loaded, show the fallback icon instead
  function fillThumb(img, id, fallbackText) {
    thumbUrl(id).then((u) => { img.src = u; }).catch(() => {
      img.replaceWith(document.createTextNode(fallbackText));
    });
  }

  function clearMediaCache() {
    thumbCache.forEach((p) => p.then((u) => URL.revokeObjectURL(u), () => {}));
    thumbCache.clear();
  }

  async function loadMe() {
    try {
      state.user = await api('/api/me');
      updateStorage(state.user);
    } catch (e) {
      if (e.status === 401) showAuth();
    }
  }

  // ------------------------------------------------------------------
  // Login / sign-up screen
  // ------------------------------------------------------------------
  let authMode = 'login';

  function setAuthMode(mode) {
    authMode = mode;
    document.querySelectorAll('.tab').forEach((t) => {
      const active = t.dataset.mode === mode;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.signup-only').forEach((n) => n.classList.toggle('hidden', mode !== 'signup'));
    $('#auth-submit').textContent = mode === 'signup' ? 'Create account' : 'Log in';
    $('#auth-error').textContent = '';
  }

  function showAuth() {
    state.user = null;
    clearMediaCache();
    $('#app-screen').classList.add('hidden');
    $('#auth-screen').classList.remove('hidden');
    $('#auth-form [name="password"]').value = '';
    setAuthMode(authMode);
  }

  function enterApp(user) {
    state.user = user;
    $('#auth-screen').classList.add('hidden');
    $('#app-screen').classList.remove('hidden');
    updateStorage(user);
    if (!location.hash || location.hash === '#') {
      location.hash = '#/drive';            // triggers hashchange -> refreshView
    } else {
      refreshView();
    }
  }

  async function submitAuth(e) {
    e.preventDefault();
    const form = e.currentTarget;
    // Use form.elements: "form.name" would return the form's own name attribute, not the input
    const fields = form.elements;
    const errorBox = $('#auth-error');
    const payload = {
      email: fields.email.value.trim(),
      password: fields.password.value,
    };
    if (authMode === 'signup') payload.name = fields.name.value.trim();
    const button = $('#auth-submit');
    button.disabled = true;
    errorBox.textContent = '';
    try {
      const user = await api(authMode === 'signup' ? '/api/signup' : '/api/login', {
        method: 'POST', body: payload,
      });
      fields.password.value = '';
      setToken(user.token);
      delete user.token;
      enterApp(user);
    } catch (err) {
      errorBox.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  }

  // ------------------------------------------------------------------
  // Menus (the "⋮" menu, the New menu, the account menu)
  // ------------------------------------------------------------------
  function hideMenus() {
    document.querySelectorAll('.menu').forEach((m) => m.classList.add('hidden'));
  }

  function placeMenu(menu, anchor) {
    menu.classList.remove('hidden');
    const r = anchor instanceof Element
      ? anchor.getBoundingClientRect()
      : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    const left = Math.min(r.left, window.innerWidth - mw - 8);
    let top = r.bottom + 4;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';
  }

  function menuButton(label, action, danger) {
    return el('button', {
      type: 'button',
      class: 'menu-item' + (danger ? ' danger' : ''),
      onclick: () => { hideMenus(); action(); },
    }, label);
  }

  function openItemMenu(item, anchor, ctx) {
    hideMenus();
    const menu = $('#item-menu');
    const items = [];
    if (ctx.mode === 'trash') {
      items.push(menuButton('Restore', () => restoreItem(item)));
      items.push(menuButton('Delete forever', () => deleteForever(item), true));
    } else {
      if (item.type === 'file') {
        items.push(menuButton('Open preview', () => openPreview(item, ctx.files)));
        items.push(menuButton('Download', () => downloadFile(item)));
        items.push(menuButton(item.starred ? 'Remove from starred' : 'Add to starred', () => setStarred(item, !item.starred)));
      } else {
        items.push(menuButton('Open folder', () => { location.hash = `#/drive/${item.id}`; }));
      }
      items.push(menuButton('Rename', () => renameItem(item)));
      items.push(menuButton('Move to…', () => moveItem(item)));
      if (item.type === 'file') items.push(menuButton('Share link', () => shareDialog(item)));
      items.push(el('div', { class: 'menu-sep' }));
      items.push(menuButton('Move to trash', () => trashItem(item), true));
    }
    menu.replaceChildren(...items);
    placeMenu(menu, anchor);
  }

  function openNewMenu(anchor) {
    hideMenus();
    placeMenu($('#new-menu'), anchor);
  }

  // ------------------------------------------------------------------
  // Actions on files and folders
  // ------------------------------------------------------------------
  function currentRoute() { return parseRoute(); }

  async function setStarred(item, value) {
    try {
      await api(`/api/files/${item.id}`, { method: 'PATCH', body: { starred: value } });
      showToast(value ? 'Added to starred' : 'Removed from starred');
      refreshView();
    } catch (e) { notifyError(e); }
  }

  async function renameItem(item) {
    const name = await promptText({
      title: item.type === 'folder' ? 'Rename folder' : 'Rename file',
      label: 'Name', value: item.name, confirm: 'Rename',
    });
    if (!name || name === item.name) return;
    try {
      const path = item.type === 'folder' ? `/api/folders/${item.id}` : `/api/files/${item.id}`;
      await api(path, { method: 'PATCH', body: { name } });
      refreshView();
    } catch (e) { notifyError(e); }
  }

  async function moveItem(item) {
    let folders;
    try {
      ({ folders } = await api('/api/folders/all'));
    } catch (e) { return notifyError(e); }
    const original = item.type === 'folder' ? item.parent_id : item.folder_id;
    let selected = original;
    openModal((dialog, close) => {
      const buttons = [];
      const list = el('div', { class: 'folder-pick', role: 'listbox' });
      const options = [{ id: null, path: 'My Drive' }, ...folders]
        .filter((opt) => !(item.type === 'folder' && opt.id === item.id));
      for (const opt of options) {
        const b = el('button', {
          type: 'button', role: 'option',
          onclick: () => {
            selected = opt.id;
            buttons.forEach((x) => x.classList.remove('selected'));
            b.classList.add('selected');
          },
        }, opt.id === null ? '🏠 ' : '📁 ', opt.path);
        if (opt.id === selected) b.classList.add('selected');
        buttons.push(b);
        list.append(b);
      }
      const errorBox = el('p', { class: 'error' });
      const confirm = el('button', {
        type: 'button', class: 'btn primary', text: 'Move here',
        onclick: async () => {
          confirm.disabled = true;
          try {
            const path = item.type === 'folder' ? `/api/folders/${item.id}` : `/api/files/${item.id}`;
            const body = item.type === 'folder' ? { parent_id: selected } : { folder_id: selected };
            await api(path, { method: 'PATCH', body });
            close();
            showToast('Moved');
            refreshView();
          } catch (e) {
            errorBox.textContent = e.message;
            confirm.disabled = false;
          }
        },
      });
      dialog.append(
        el('h2', { text: `Move “${item.name}”` }),
        list,
        errorBox,
        el('div', { class: 'buttons' },
          el('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: close }),
          confirm),
      );
    });
  }

  async function trashItem(item) {
    try {
      const path = item.type === 'folder' ? `/api/folders/${item.id}` : `/api/files/${item.id}`;
      await api(path, { method: 'DELETE' });
      showToast(`Moved “${item.name}” to trash`);
      refreshView();
      loadMe();
    } catch (e) { notifyError(e); }
  }

  async function restoreItem(item) {
    try {
      await api('/api/trash/restore', { method: 'POST', body: { type: item.type, id: item.id } });
      showToast(`Restored “${item.name}”`);
      refreshView();
      loadMe();
    } catch (e) { notifyError(e); }
  }

  async function deleteForever(item) {
    if (!confirm(`Delete “${item.name}” forever? This cannot be undone.`)) return;
    try {
      const path = item.type === 'folder' ? `/api/folders/${item.id}` : `/api/files/${item.id}`;
      await api(path + '?permanent=1', { method: 'DELETE' });
      showToast('Deleted forever');
      refreshView();
      loadMe();
    } catch (e) { notifyError(e); }
  }

  async function emptyTrash() {
    if (!confirm('Permanently delete everything in the trash? This cannot be undone.')) return;
    try {
      await api('/api/trash/empty', { method: 'POST' });
      showToast('Trash emptied');
      refreshView();
      loadMe();
    } catch (e) { notifyError(e); }
  }

  function downloadFile(item) {
    fetchObjectUrl(`/api/files/${item.id}/content?download=1`).then((u) => {
      const a = el('a', { href: u, download: item.name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    }).catch(notifyError);
  }

  function copyText(text, input) {
    const fallback = () => {
      input.select();
      try { document.execCommand('copy'); showToast('Link copied'); }
      catch (_) { showToast('Press Ctrl+C to copy the link', true); }
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => showToast('Link copied'), fallback);
    } else {
      fallback();
    }
  }

  function shareDialog(item) {
    let token = item.share_token;
    openModal((dialog, close) => {
      const body = el('div');
      const errorBox = el('p', { class: 'error' });

      const draw = () => {
        body.replaceChildren();
        if (!token) {
          body.append(
            el('p', { text: 'Create a link. Anyone with the link can view or download this file. No login is needed.' }),
            el('div', { class: 'buttons' },
              el('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: close }),
              el('button', { type: 'button', class: 'btn primary', text: 'Create link', onclick: createLink })),
          );
        } else {
          const url = `${location.origin}/s/${token}`;
          const input = el('input', { type: 'text', readonly: true, value: url, 'aria-label': 'Share link' });
          body.append(
            el('p', { text: 'Anyone with this link can view this file. You can stop sharing at any time.' }),
            el('div', { class: 'share-box' },
              input,
              el('button', { type: 'button', class: 'btn', text: 'Copy', onclick: () => copyText(url, input) })),
            el('div', { class: 'buttons' },
              el('button', { type: 'button', class: 'btn danger', text: 'Stop sharing', onclick: revoke }),
              el('button', { type: 'button', class: 'btn primary', text: 'Done', onclick: () => { close(); refreshView(); } })),
          );
        }
      };

      async function createLink() {
        try {
          const data = await api(`/api/files/${item.id}/share`, { method: 'POST' });
          token = data.share_token;
          item.share_token = token;
          draw();
        } catch (e) { errorBox.textContent = e.message; }
      }

      async function revoke() {
        try {
          await api(`/api/files/${item.id}/share`, { method: 'DELETE' });
          token = null;
          item.share_token = null;
          draw();
          showToast('Link removed');
        } catch (e) { errorBox.textContent = e.message; }
      }

      dialog.append(el('h2', { text: `Share “${item.name}”` }), body, errorBox);
      draw();
    });
  }

  // ------------------------------------------------------------------
  // Dialog helpers
  // ------------------------------------------------------------------
  function openModal(build, onDismiss) {
    const overlay = el('div', { class: 'overlay' });
    const dialog = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' });
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      if (onDismiss) onDismiss();
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    overlay.append(dialog);
    $('#modal-root').append(overlay);
    build(dialog, close);
    const first = dialog.querySelector('input, select, button');
    if (first) first.focus();
    return close;
  }

  function promptText({ title, label, value = '', confirm: confirmLabel = 'OK' }) {
    return new Promise((resolve) => {
      let finished = false;
      const finish = (result) => {
        if (finished) return;
        finished = true;
        resolve(result);
        close();
      };
      const close = openModal((dialog) => {
        const input = el('input', { type: 'text', value, maxlength: '200', 'aria-label': label });
        const errorBox = el('p', { class: 'error' });
        dialog.append(el('form', {
          onsubmit: (e) => {
            e.preventDefault();
            const v = input.value.trim();
            if (!v) { errorBox.textContent = 'Please enter a name.'; return; }
            finish(v);
          },
        },
          el('h2', { text: title }),
          el('label', { class: 'field' }, el('span', { text: label }), input),
          errorBox,
          el('div', { class: 'buttons' },
            el('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: () => finish(null) }),
            el('button', { type: 'submit', class: 'btn primary', text: confirmLabel }))));
        setTimeout(() => { input.focus(); input.select(); }, 0);
      }, () => finish(null));
    });
  }

  // ------------------------------------------------------------------
  // Preview (images, video, audio, PDF)
  // ------------------------------------------------------------------
  let preview = null;

  function openPreview(item, list) {
    closePreview();
    const files = (list || []).filter((f) => f.type === 'file');
    if (!files.some((f) => f.id === item.id)) files.unshift(item);
    const index = files.findIndex((f) => f.id === item.id);
    const overlay = el('div', { class: 'preview', role: 'dialog', 'aria-modal': 'true' });
    const title = el('div', { class: 'preview-title' });
    const counter = el('span', { class: 'hint' });
    const body = el('div', { class: 'preview-body' });
    const prevBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Previous', text: '‹', onclick: () => step(-1) });
    const nextBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Next', text: '›', onclick: () => step(1) });
    const bar = el('div', { class: 'preview-bar' },
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', text: '✕', onclick: closePreview }),
      title,
      counter,
      prevBtn,
      nextBtn,
      el('button', { type: 'button', class: 'btn', text: 'Download', onclick: () => downloadFile(preview.files[preview.index]) }));
    overlay.append(bar, body);
    document.body.append(overlay);
    const onKey = (e) => {
      if (e.key === 'Escape') closePreview();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    };
    document.addEventListener('keydown', onKey);
    preview = { overlay, body, title, counter, prevBtn, nextBtn, files, index, onKey, urls: [], loadSeq: 0 };
    showPreviewItem();

    function step(delta) {
      if (!preview) return;
      const next = preview.index + delta;
      if (next < 0 || next >= preview.files.length) return;
      preview.index = next;
      showPreviewItem();
    }
  }

  function showPreviewItem() {
    const p = preview;
    const item = p.files[p.index];
    const url = `/api/files/${item.id}/content`;
    p.title.textContent = item.name;
    p.counter.textContent = p.files.length > 1 ? `${p.index + 1} / ${p.files.length}` : '';
    p.prevBtn.classList.toggle('hidden', p.files.length < 2);
    p.nextBtn.classList.toggle('hidden', p.files.length < 2);
    p.prevBtn.disabled = p.index === 0;
    p.nextBtn.disabled = p.index === p.files.length - 1;
    p.body.replaceChildren();   // removing old media also stops playback
    p.urls.forEach((u) => URL.revokeObjectURL(u));
    p.urls = [];

    const canInline = INLINE.has(item.mime);
    if (!canInline || !['image', 'video', 'audio', 'pdf'].includes(item.kind)) {
      p.body.append(el('div', { class: 'nopreview' },
        el('div', { class: 'big', text: iconFor(item) }),
        el('p', { text: 'No preview for this file type.' }),
        el('button', { type: 'button', class: 'btn', text: 'Download', onclick: () => downloadFile(item) })));
      return;
    }

    const token = ++p.loadSeq;
    p.body.append(el('p', { class: 'nopreview', text: 'Loading…' }));
    fetchObjectUrl(url).then((blobUrl) => {
      // The user may have moved on to another file while this one was loading
      if (preview !== p || p.loadSeq !== token) { URL.revokeObjectURL(blobUrl); return; }
      p.urls.push(blobUrl);
      let media;
      if (item.kind === 'image') media = el('img', { src: blobUrl, alt: item.name });
      else if (item.kind === 'video') media = el('video', { src: blobUrl, controls: true, autoplay: true, preload: 'metadata' });
      else if (item.kind === 'audio') media = el('audio', { src: blobUrl, controls: true, autoplay: true, preload: 'metadata' });
      else media = el('iframe', { src: blobUrl, title: item.name });
      p.body.replaceChildren(media);
    }).catch((e) => {
      if (preview !== p || p.loadSeq !== token) return;
      p.body.replaceChildren(el('div', { class: 'nopreview' },
        el('p', { text: e.message || 'Could not load this file.' })));
    });
  }

  function closePreview() {
    if (!preview) return;
    document.removeEventListener('keydown', preview.onKey);
    preview.overlay.remove();
    preview.urls.forEach((u) => URL.revokeObjectURL(u));
    preview = null;
  }

  // ------------------------------------------------------------------
  // Upload (multi-file, progress bars, drag & drop)
  // ------------------------------------------------------------------
  function startUploads(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const route = currentRoute();
    const folderId = route.view === 'drive' ? route.folderId : null;

    const panel = $('#upload-panel');
    const list = $('#upload-list');
    const title = $('#upload-title');
    panel.classList.remove('hidden');
    title.textContent = `Uploading ${files.length} file${files.length > 1 ? 's' : ''}`;

    let used = state.user ? state.user.used : 0;
    const quota = state.user ? state.user.quota : Infinity;
    const jobs = [];

    for (const file of files) {
      const status = el('span', { text: '0%' });
      const bar = el('div', { class: 'up-bar' }, el('div'));
      const errorBox = el('div', { class: 'up-err hidden' });
      const row = el('li', {},
        el('div', { class: 'up-name' }, el('span', { text: file.name }), status),
        bar, errorBox);
      list.append(row);
      const ui = {
        setProgress(ratio) { bar.firstChild.style.width = Math.round(ratio * 100) + '%'; status.textContent = Math.round(ratio * 100) + '%'; },
        setDone() { bar.classList.add('done'); status.textContent = '✓'; },
        setError(msg) { bar.classList.add('err'); status.textContent = '✕'; errorBox.textContent = msg; errorBox.classList.remove('hidden'); },
      };
      if (used + file.size > quota) {
        ui.setError('Not enough storage space. Delete some files or empty the trash.');
        continue;
      }
      used += file.size;
      jobs.push({ file, ui });
    }

    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        await uploadOne(job.file, folderId, job.ui);
      }
    };
    const workers = Array.from({ length: Math.min(3, jobs.length) }, worker);
    Promise.all(workers).then(() => {
      const failed = list.querySelectorAll('.up-err:not(.hidden)').length;
      title.textContent = failed
        ? `${files.length - failed} uploaded, ${failed} failed`
        : `${files.length} uploaded`;
      refreshView();
      loadMe();
    });
  }

  function uploadOne(file, folderId, ui) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/files');
      xhr.setRequestHeader('X-Drive-Client', '1');
      const token = getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.setRequestHeader('X-Drive-Token', token);
      }
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) ui.setProgress(e.loaded / e.total); };
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch (_) { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) ui.setDone();
        else if (xhr.status === 401) ui.setError('Please log in again.');
        else ui.setError(data.error || `Upload failed (${xhr.status}).`);
        resolve();
      };
      xhr.onerror = () => { ui.setError('Network error. Check your connection and try again.'); resolve(); };
      const form = new FormData();
      form.append('file', file, file.name);
      form.append('folder_id', folderId === null || folderId === undefined ? 'root' : String(folderId));
      xhr.send(form);
    });
  }

  let dragDepth = 0;
  function hasFiles(e) {
    return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  }

  function wireDragAndDrop() {
    const overlay = $('#drop-overlay');
    window.addEventListener('dragenter', (e) => {
      if (!hasFiles(e) || $('#app-screen').classList.contains('hidden')) return;
      e.preventDefault();
      dragDepth++;
      overlay.classList.remove('hidden');
    });
    window.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();                        // allows dropping
      e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('dragleave', (e) => {
      if (!hasFiles(e)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) overlay.classList.add('hidden');
    });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      overlay.classList.add('hidden');
      if ($('#app-screen').classList.contains('hidden')) return;
      startUploads(e.dataTransfer.files);
    });
  }

  // ------------------------------------------------------------------
  // Routing and views
  // ------------------------------------------------------------------
  function parseRoute() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [seg, ...rest] = hash.split('/');
    if (seg === 'photos') return { view: 'photos' };
    if (seg === 'starred') return { view: 'starred' };
    if (seg === 'trash') return { view: 'trash' };
    if (seg === 'search') {
      let q = '';
      try { q = decodeURIComponent(rest.join('/')); } catch (_) { q = ''; }
      return { view: 'search', q };
    }
    if (seg === 'drive' && rest[0] && /^\d+$/.test(rest[0])) {
      return { view: 'drive', folderId: Number(rest[0]) };
    }
    return { view: 'drive', folderId: null };
  }

  function refreshView() {
    const seq = ++renderSeq;
    const route = parseRoute();
    document.querySelectorAll('.nav-item').forEach((a) => {
      a.classList.toggle('active', a.dataset.nav === route.view);
    });
    const searchInput = $('#search-input');
    if (route.view === 'search') {
      if (searchInput.value !== route.q) searchInput.value = route.q;
    } else if (document.activeElement !== searchInput) {
      searchInput.value = '';
    }
    $('#sidebar').classList.remove('open');
    buildView(route).then((node) => {
      if (seq !== renderSeq) return;
      $('#content').replaceChildren(node);
      loadMe();
    }).catch((e) => {
      if (seq !== renderSeq) return;
      if (e.status === 401) return showAuth();
      if (e.status === 404 && route.view === 'drive' && route.folderId !== null) {
        location.hash = '#/drive';
        return;
      }
      $('#content').replaceChildren(el('div', { class: 'empty' },
        el('div', { class: 'big', text: '⚠️' }), e.message || 'Something went wrong.'));
    });
  }

  function buildView(route) {
    if (route.view === 'photos') return photosView();
    if (route.view === 'starred') return starredView();
    if (route.view === 'trash') return trashView();
    if (route.view === 'search') return searchView(route.q);
    return driveView(route.folderId);
  }

  // Card for a folder or file (My Drive, Starred, Search)
  function thumbNode(item) {
    if (!item.has_thumb) return iconFor(item);
    const img = el('img', { alt: '', loading: 'lazy' });
    fillThumb(img, item.id, iconFor(item));
    return img;
  }

  function makeCard(item, ctx) {
    const isFolder = item.type === 'folder';
    const thumb = isFolder
      ? el('div', { class: 'card-thumb folder', text: '📁' })
      : el('div', { class: 'card-thumb' }, thumbNode(item));
    const more = el('button', {
      type: 'button', class: 'more-btn', title: 'More actions', 'aria-label': `More actions for ${item.name}`,
      onclick: (e) => { e.stopPropagation(); openItemMenu(item, e.currentTarget, ctx); },
    }, '⋮');
    return el('div', {
      class: 'card', tabindex: '0', role: 'button', title: item.name,
      onclick: () => activate(item, ctx),
      onkeydown: (e) => { if (e.key === 'Enter') activate(item, ctx); },
      oncontextmenu: (e) => { e.preventDefault(); openItemMenu(item, { x: e.clientX, y: e.clientY }, ctx); },
    },
      item.starred ? el('span', { class: 'star-badge', title: 'Starred', text: '★' }) : null,
      thumb,
      el('div', { class: 'card-foot' },
        el('div', { style: 'min-width:0;flex:1' },
          el('div', { class: 'card-name', text: item.name }),
          el('div', { class: 'card-meta', text: isFolder ? 'Folder' : fmtBytes(item.size) })),
        more));
  }

  function activate(item, ctx) {
    if (item.type === 'folder') {
      location.hash = `#/drive/${item.id}`;
    } else {
      openPreview(item, ctx.files);
    }
  }

  function grid(items, ctx) {
    return el('div', { class: 'grid' }, items.map((item) => makeCard(item, ctx)));
  }

  function emptyState(icon, message) {
    return el('div', { class: 'empty' }, el('div', { class: 'big', text: icon }), message);
  }

  async function driveView(folderId) {
    const data = await api(`/api/list?folder=${folderId === null ? 'root' : folderId}`);
    const ctx = { mode: 'drive', files: data.files };

    const crumbs = el('div', { class: 'crumbs' },
      el('button', {
        type: 'button', class: 'crumb' + (data.breadcrumb.length === 0 ? ' current' : ''),
        text: 'My Drive', onclick: () => { location.hash = '#/drive'; },
      }));
    data.breadcrumb.forEach((c, i) => {
      const last = i === data.breadcrumb.length - 1;
      crumbs.append(el('span', { class: 'crumb-sep', text: '›' }));
      crumbs.append(el('button', {
        type: 'button', class: 'crumb' + (last ? ' current' : ''), text: c.name,
        onclick: last ? null : () => { location.hash = `#/drive/${c.id}`; },
      }));
    });

    const toolbar = el('div', { class: 'toolbar' },
      crumbs,
      el('button', { type: 'button', class: 'btn', text: '+ New folder', onclick: () => createFolder(folderId) }),
      el('button', { type: 'button', class: 'btn primary', text: 'Upload files', onclick: () => $('#file-input').click() }));

    const wrap = el('div', {}, toolbar);
    if (!data.folders.length && !data.files.length) {
      wrap.append(emptyState('📂', 'This folder is empty. Drag files here, or click “Upload files”.'));
      return wrap;
    }
    if (data.folders.length) {
      wrap.append(el('div', { class: 'section-label', text: 'Folders' }), grid(data.folders, ctx));
    }
    if (data.files.length) {
      wrap.append(el('div', { class: 'section-label', text: 'Files' }), grid(data.files, ctx));
    }
    return wrap;
  }

  async function createFolder(parentId) {
    const name = await promptText({ title: 'New folder', label: 'Folder name', value: 'Untitled folder', confirm: 'Create' });
    if (!name) return;
    try {
      await api('/api/folders', { method: 'POST', body: { name, parent_id: parentId } });
      showToast('Folder created');
      refreshView();
    } catch (e) { notifyError(e); }
  }

  function dayKey(f) {
    if (f.taken_at) return f.taken_at.slice(0, 10);
    const d = new Date(f.created_at);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function dayLabel(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  function photoTile(f, ctx) {
    const media = f.has_thumb
      ? (() => { const img = el('img', { alt: f.name, loading: 'lazy' }); fillThumb(img, f.id, '🖼️'); return img; })()
      : el('span', { text: f.kind === 'video' ? '🎞️' : '🖼️' });
    return el('div', {
      class: 'photo' + (f.has_thumb ? '' : ' fallback'), tabindex: '0', role: 'button', title: f.name,
      onclick: () => openPreview(f, ctx.files),
      onkeydown: (e) => { if (e.key === 'Enter') openPreview(f, ctx.files); },
      oncontextmenu: (e) => { e.preventDefault(); openItemMenu(f, { x: e.clientX, y: e.clientY }, ctx); },
    },
      media,
      f.kind === 'video' ? el('div', { class: 'play' }, el('span', { text: '▶' })) : null,
      f.starred ? el('span', { class: 'star-badge', text: '★' }) : null,
      el('button', {
        type: 'button', class: 'more-btn photo-more', 'aria-label': `More actions for ${f.name}`,
        onclick: (e) => { e.stopPropagation(); openItemMenu(f, e.currentTarget, ctx); },
      }, '⋮'));
  }

  async function photosView() {
    const data = await api('/api/photos');
    const ctx = { mode: 'photos', files: data.files };
    const wrap = el('div', {}, el('h1', { class: 'view-title', text: 'Photos' }));
    if (!data.files.length) {
      wrap.append(emptyState('🖼️', 'No photos or videos yet. Upload pictures to see them here, newest first.'));
      return wrap;
    }
    const groups = new Map();
    for (const f of data.files) {
      const key = dayKey(f);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    }
    for (const [key, items] of groups) {
      wrap.append(
        el('div', { class: 'date-head', text: dayLabel(key) }),
        el('div', { class: 'photo-grid' }, items.map((f) => photoTile(f, ctx))));
    }
    return wrap;
  }

  async function starredView() {
    const data = await api('/api/starred');
    const ctx = { mode: 'starred', files: data.files };
    const wrap = el('div', {}, el('h1', { class: 'view-title', text: 'Starred' }));
    if (!data.files.length) {
      wrap.append(emptyState('☆', 'Nothing starred yet. Use “⋮ → Add to starred” on a file.'));
      return wrap;
    }
    wrap.append(grid(data.files, ctx));
    return wrap;
  }

  async function searchView(q) {
    const wrap = el('div', {}, el('h1', { class: 'view-title', text: q ? `Results for “${q}”` : 'Search' }));
    if (!q) {
      wrap.append(emptyState('🔍', 'Type a name in the search box above.'));
      return wrap;
    }
    const data = await api(`/api/search?q=${encodeURIComponent(q)}`);
    const ctx = { mode: 'search', files: data.files };
    if (!data.folders.length && !data.files.length) {
      wrap.append(emptyState('🔍', 'No files or folders match your search.'));
      return wrap;
    }
    if (data.folders.length) wrap.append(el('div', { class: 'section-label', text: 'Folders' }), grid(data.folders, ctx));
    if (data.files.length) wrap.append(el('div', { class: 'section-label', text: 'Files' }), grid(data.files, ctx));
    return wrap;
  }

  async function trashView() {
    const data = await api('/api/trash');
    const ctx = { mode: 'trash', files: [] };
    const items = [...data.folders, ...data.files];
    const header = el('div', { class: 'toolbar' },
      el('h1', { class: 'view-title', text: 'Trash', style: 'margin:0;flex:1' }),
      items.length ? el('button', { type: 'button', class: 'btn danger', text: 'Empty trash', onclick: emptyTrash }) : null);
    const wrap = el('div', {}, header,
      el('p', { class: 'hint', text: 'Items in the trash stay here until you restore them or delete them forever.' }));
    if (!items.length) {
      wrap.append(emptyState('🗑️', 'Trash is empty.'));
      return wrap;
    }
    const rows = items.map((item) => el('tr', {},
      el('td', {}, el('div', { class: 'file-cell' },
        el('span', { class: 'ico', text: iconFor(item) }),
        el('span', { class: 'name', text: item.name }))),
      el('td', { text: item.type === 'folder' ? 'Folder' : fmtBytes(item.size) }),
      el('td', { text: fmtDate(item.trashed_at) }),
      el('td', { class: 'actions' },
        el('button', { type: 'button', class: 'btn', text: 'Restore', onclick: () => restoreItem(item) }),
        el('button', { type: 'button', class: 'btn danger', text: 'Delete forever', onclick: () => deleteForever(item) }),
        el('button', { type: 'button', class: 'more-btn', 'aria-label': 'More actions', text: '⋮',
          onclick: (e) => { e.stopPropagation(); openItemMenu(item, e.currentTarget, ctx); } }))));
    wrap.append(el('table', { class: 'list' },
      el('thead', {}, el('tr', {},
        el('th', { text: 'Name' }), el('th', { text: 'Size' }), el('th', { text: 'Deleted' }), el('th', { text: '' }))),
      el('tbody', {}, rows)));
    return wrap;
  }

  // ------------------------------------------------------------------
  // Wiring: buttons, search, upload input, menus
  // ------------------------------------------------------------------
  function wireUi() {
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setAuthMode(t.dataset.mode)));
    $('#auth-form').addEventListener('submit', submitAuth);

    $('#menu-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#new-btn').addEventListener('click', (e) => { e.stopPropagation(); openNewMenu(e.currentTarget); });
    $('#new-menu').addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]');
      if (!action) return;
      hideMenus();
      if (action.dataset.action === 'new-folder') {
        const route = currentRoute();
        createFolder(route.view === 'drive' ? route.folderId : null);
      } else if (action.dataset.action === 'upload-files') {
        $('#file-input').click();
      }
    });

    $('#avatar').addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = $('#account-menu');
      const open = menu.classList.contains('hidden');
      hideMenus();
      if (open) menu.classList.remove('hidden');
    });
    $('#account-menu').addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]');
      if (action && action.dataset.action === 'logout') {
        hideMenus();
        try { await api('/api/logout', { method: 'POST' }); } catch (_) { /* ignore */ }
        setToken(null);
        showAuth();
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menu, #avatar, #new-btn, .more-btn')) hideMenus();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideMenus();
    });

    const fileInput = $('#file-input');
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []);
      fileInput.value = '';
      startUploads(files);
    });

    $('#upload-close').addEventListener('click', () => {
      $('#upload-panel').classList.add('hidden');
      $('#upload-list').replaceChildren();
    });

    let searchTimer = null;
    const searchInput = $('#search-input');
    const goSearch = () => {
      const q = searchInput.value.trim();
      if (!q) {
        if (parseRoute().view === 'search') location.hash = '#/drive';
        return;
      }
      location.hash = '#/search/' + encodeURIComponent(q);
    };
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(goSearch, 300);
    });
    $('#search-form').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(searchTimer); goSearch(); });

    window.addEventListener('hashchange', () => {
      if (!$('#app-screen').classList.contains('hidden')) refreshView();
    });

    wireDragAndDrop();
  }

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------
  async function init() {
    wireUi();
    setAuthMode('login');
    try {
      const user = await api('/api/me');
      enterApp(user);
    } catch (_) {
      showAuth();
    }
  }

  // Service worker: lets Chrome/Android install the app. It does not cache data (see sw.js).
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* optional feature */ });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    init();
  });
})();
