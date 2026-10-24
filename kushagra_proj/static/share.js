/* Public share page: /s/<token>. No login needed.
 * Shows the file if the browser can display it, plus a download button.
 * Text is inserted with textContent only.
 */
(function () {
  'use strict';

  const card = document.getElementById('share-card');
  const token = decodeURIComponent(location.pathname.replace(/^\/s\//, '').replace(/\/+$/, ''));

  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function fmtBytes(n) {
    if (!n) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let value = n;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
    return (i < 2 ? Math.round(value) : value.toFixed(1)) + ' ' + units[i];
  }

  function showError(message) {
    card.replaceChildren(el('div', { class: 'share-error' },
      el('div', { class: 'big', text: '🔗' }),
      el('h1', { text: 'Link not available' }),
      el('p', { class: 'share-meta', text: message || 'This link is invalid or the file was removed.' }),
      el('a', { href: '/', text: 'Go to Axis Drive' })));
  }

  function stage(info, url) {
    const canInline = info.inline;
    if (canInline && info.kind === 'image') return el('img', { src: url, alt: info.name });
    if (canInline && info.kind === 'video') return el('video', { src: url, controls: true, preload: 'metadata' });
    if (canInline && info.kind === 'audio') return el('audio', { src: url, controls: true, preload: 'metadata' });
    if (canInline && info.kind === 'pdf') return el('iframe', { src: url, title: info.name });
    return el('div', { class: 'nopreview' }, '📄', el('p', { class: 'share-meta', style: 'color:#dadce0;font-size:15px' }, 'No preview for this file type.'));
  }

  async function load() {
    let info;
    try {
      const res = await fetch(`/api/public/${encodeURIComponent(token)}`);
      if (!res.ok) {
        let message = null;
        try { message = (await res.json()).error; } catch (_) { /* ignore */ }
        return showError(message);
      }
      info = await res.json();
    } catch (_) {
      return showError('Could not reach the server. Please try again.');
    }

    const base = `/api/public/${encodeURIComponent(token)}/content`;
    const downloadUrl = `${base}?download=1`;
    const link = el('a', { class: 'btn primary', href: downloadUrl, download: info.name, text: 'Download' });
    card.replaceChildren(
      el('div', { class: 'share-stage' }, stage(info, base)),
      el('h1', { text: info.name }),
      el('p', { class: 'share-meta', text: `${fmtBytes(info.size)} · shared with Axis Drive` }),
      el('div', { class: 'share-actions' }, link));
    document.title = `${info.name} - Axis Drive`;
  }

  load();
})();
