/* ==========================================================================
   AXIS COLLEGES - ADMIN PANEL LOGIC (admin.js)
   Used only by admin.html. Uses helpers from script.js (window.AxisSite).

   VIVA NOTES
   - Every list (notices, courses, events...) is described by a small
     "schema" object called COLLECTIONS. One generic function builds the table,
     the add/edit popup form, and the save/delete logic for all of them.
   - Changes are saved to localStorage, so the public website shows them
     immediately in this browser. To publish them for everybody, click
     "Download site-data.js" and replace data/site-data.js.
   ========================================================================== */

(function () {
  'use strict';

  var S = window.AxisSite;               // helpers from script.js
  var SESSION_FLAG = 'axis_admin_session';
  var content = null;                    // working copy of all website content
  var records = null;                    // applications, enquiries, passes
  var currentView = 'dashboard';
  var appFilter = 'All';
  var noticeTimer = null;

  var STATUS_OPTIONS = ['Pending', 'Approved', 'Waitlisted', 'Rejected'];
  var NOTICE_CATEGORIES = ['Exams', 'Placements', 'Events', 'Scholarship', 'Workshop', 'General'];
  var STREAMS = ['Engineering', 'Computer Apps', 'Management', 'Pharmacy'];
  var GALLERY_CATEGORIES = ['Academics & Labs', 'Fests & Placements', 'Sports & Campus'];

  /* ------------------------------------------------------------------
     COLLECTION SCHEMAS
     key      : name of the property in the data file
     type     : text | textarea | number | date | checkbox | image
     list     : suggestions shown while typing (datalist)
     required : must not be empty
     full     : field takes the full row in the popup form
     ------------------------------------------------------------------ */
  var COLLECTIONS = {
    notices: {
      label: 'Notices', single: 'Notice', prefix: 'n',
      columns: [{ key: 'date', label: 'Date' }, { key: 'category', label: 'Category' }, { key: 'title', label: 'Title' }],
      fields: [
        { key: 'title', label: 'Notice Title', type: 'text', required: true, full: true },
        { key: 'category', label: 'Category', type: 'text', list: NOTICE_CATEGORIES, required: true },
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'body', label: 'Details', type: 'textarea', full: true }
      ]
    },
    courses: {
      label: 'Courses & Fees', single: 'Course', prefix: 'c',
      columns: [{ key: 'shortName', label: 'Short Name' }, { key: 'stream', label: 'Stream' }, { key: 'fee', label: 'Fee / Year', money: true }, { key: 'featured', label: 'Home Page', bool: true }],
      fields: [
        { key: 'id', label: 'Course Code (unique, no spaces)', type: 'text', required: true, slug: true },
        { key: 'name', label: 'Full Course Name', type: 'text', required: true, full: true },
        { key: 'shortName', label: 'Short Name', type: 'text', required: true },
        { key: 'stream', label: 'Stream', type: 'text', list: STREAMS, required: true },
        { key: 'affiliation', label: 'Affiliation / Approval', type: 'text' },
        { key: 'duration', label: 'Duration (e.g. 4 Years)', type: 'text' },
        { key: 'seats', label: 'Seats', type: 'number' },
        { key: 'fee', label: 'Annual Tuition Fee (₹)', type: 'number', required: true },
        { key: 'eligibility', label: 'Eligibility', type: 'text' },
        { key: 'admissionMode', label: 'Admission Mode', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea', full: true },
        { key: 'featured', label: 'Show on Home page', type: 'checkbox', full: true }
      ]
    },
    events: {
      label: 'Campus Events', single: 'Event', prefix: 'e',
      columns: [{ key: 'dateText', label: 'Date' }, { key: 'title', label: 'Event' }, { key: 'open', label: 'Registration Open', bool: true }],
      fields: [
        { key: 'title', label: 'Event Title', type: 'text', required: true, full: true },
        { key: 'dateText', label: 'Date (as shown to visitors)', type: 'text', required: true },
        { key: 'venue', label: 'Venue', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea', full: true },
        { key: 'open', label: 'Students can register online', type: 'checkbox', full: true }
      ]
    },
    gallery: {
      label: 'Campus Gallery', single: 'Photo', prefix: 'g',
      columns: [{ key: 'image', label: 'Photo', image: true }, { key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }],
      fields: [
        { key: 'title', label: 'Photo Title', type: 'text', required: true },
        { key: 'caption', label: 'Caption', type: 'text' },
        { key: 'category', label: 'Category', type: 'text', list: GALLERY_CATEGORIES, required: true },
        { key: 'image', label: 'Image path (e.g. images/library.jpg)', type: 'image', required: true, full: true }
      ]
    },
    faqs: {
      label: 'FAQs (About Page)', single: 'FAQ', prefix: 'f',
      columns: [{ key: 'question', label: 'Question' }],
      fields: [
        { key: 'question', label: 'Question', type: 'text', required: true, full: true },
        { key: 'answer', label: 'Answer', type: 'textarea', required: true, full: true }
      ]
    },
    testimonials: {
      label: 'Student Testimonials', single: 'Testimonial', prefix: 't',
      columns: [{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role / Placement' }],
      fields: [
        { key: 'name', label: 'Student Name', type: 'text', required: true },
        { key: 'role', label: 'Course & Placement', type: 'text' },
        { key: 'quote', label: 'Testimonial', type: 'textarea', required: true, full: true }
      ]
    }
  };

  /* Text fields on the Settings page. path = location in the data file */
  var SETTINGS_GROUPS = [
    { title: 'College Identity', fields: [
      { path: 'settings.collegeName', label: 'College Name' },
      { path: 'settings.shortName', label: 'Short Name (header logo text)' },
      { path: 'settings.tagline', label: 'Tagline' },
      { path: 'settings.approvals', label: 'Approval line (top bar & footer)' },
      { path: 'settings.footerNote', label: 'Footer note', type: 'textarea', full: true }
    ] },
    { title: 'Contact Details', fields: [
      { path: 'settings.address', label: 'Address', full: true },
      { path: 'settings.phone', label: 'Helpline Number' },
      { path: 'settings.phoneAlt', label: 'Second Helpline Number' },
      { path: 'settings.tollFree', label: 'Toll-Free Number' },
      { path: 'settings.email', label: 'General Email' },
      { path: 'settings.admissionsEmail', label: 'Admissions Email' },
      { path: 'settings.placementEmail', label: 'Placement Email' },
      { path: 'settings.officeHours', label: 'Office Hours' }
    ] },
    { title: 'Home Page Hero', fields: [
      { path: 'hero.badge', label: 'Small badge text', full: true },
      { path: 'hero.title', label: 'Main heading', full: true },
      { path: 'hero.subtitle', label: 'Sub heading', type: 'textarea', full: true },
      { path: 'hero.image', label: 'Background image path', full: true },
      { path: 'hero.primaryText', label: 'Button 1 text' },
      { path: 'hero.primaryLink', label: 'Button 1 link' },
      { path: 'hero.secondaryText', label: 'Button 2 text' },
      { path: 'hero.secondaryLink', label: 'Button 2 link' }
    ] },
    { title: 'Admissions', fields: [
      { path: 'settings.session', label: 'Academic Session (e.g. 2026–27)' },
      { path: 'settings.admissionsOpen', label: 'Online admissions are OPEN', type: 'checkbox' }
    ] },
    { title: 'About Page', fields: [
      { path: 'about.legacyTitle', label: 'Legacy heading', full: true },
      { path: 'about.legacyText', label: 'Legacy text', type: 'textarea', full: true },
      { path: 'about.approvalText', label: 'Approvals paragraph', type: 'textarea', full: true },
      { path: 'about.vision', label: 'Vision', type: 'textarea', full: true },
      { path: 'about.mission', label: 'Mission', type: 'textarea', full: true },
      { path: 'about.directorQuote', label: "Director's message", type: 'textarea', full: true },
      { path: 'about.directorName', label: 'Director name' },
      { path: 'about.directorTitle', label: 'Director designation' }
    ] },
    { title: 'Online Forms & Security', fields: [
      { path: 'settings.formEndpoint', label: 'Form endpoint URL (optional, e.g. Formspree link)', full: true },
      { path: 'settings.adminPassword', label: 'Admin panel password', full: true }
    ] }
  ];

  /* ------------------------------------------------------------------
     SMALL HELPERS
     ------------------------------------------------------------------ */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  var esc = S.esc;

  // Shows a message box at the top of the admin page
  function notify(message, type) {
    var box = $('#adminNotice');
    box.innerHTML = '<div class="alert-box alert-' + (type || 'success') + '">' + esc(message) + '</div>';
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { box.innerHTML = ''; }, 4500);
  }

  // Saves the working copy to localStorage. Shows an error if the browser is full.
  function persist() {
    if (S.saveContent(content)) return true;
    notify('Could not save: browser storage is full. Use image paths like images/photo.jpg instead of uploads.', 'error');
    return false;
  }

  // Reads a nested value like "hero.title"
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  // Writes a nested value like "hero.title", creating objects when needed
  function setPath(obj, path, value) {
    var keys = path.split('.');
    var target = obj;
    keys.slice(0, -1).forEach(function (k) {
      if (typeof target[k] !== 'object' || target[k] === null) target[k] = {};
      target = target[k];
    });
    target[keys[keys.length - 1]] = value;
  }

  function slugify(text) {
    return String(text).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function formatDateTime(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '-' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // Creates and clicks a temporary link so the browser downloads a file
  function downloadFile(filename, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); link.remove(); }, 0);
  }

  // Converts an array of objects into CSV text (opens nicely in Excel)
  function toCSV(rows, headers) {
    var lines = [headers.join(',')];
    rows.forEach(function (row) {
      lines.push(headers.map(function (h) {
        var v = row[h] == null ? '' : String(row[h]);
        return '"' + v.replace(/"/g, '""') + '"';
      }).join(','));
    });
    return '\ufeff' + lines.join('\r\n');
  }

  /* ------------------------------------------------------------------
     LOGIN
     ------------------------------------------------------------------ */

  function isLoggedIn() {
    try { return sessionStorage.getItem(SESSION_FLAG) === '1'; } catch (e) { return false; }
  }

  function showApp() {
    $('#loginScreen').hidden = true;
    $('#adminApp').hidden = false;
    go('dashboard');
  }

  function showLogin() {
    $('#loginScreen').hidden = false;
    $('#adminApp').hidden = true;
  }

  function handleLogin(e) {
    e.preventDefault();
    var typed = $('#loginPassword').value;
    if (typed === content.settings.adminPassword) {
      try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch (err) { /* ignore */ }
      $('#loginError').hidden = true;
      $('#loginPassword').value = '';
      showApp();
    } else {
      $('#loginError').textContent = 'Wrong password. Please try again.';
      $('#loginError').hidden = false;
    }
  }

  function logout() {
    try { sessionStorage.removeItem(SESSION_FLAG); } catch (e) { /* ignore */ }
    showLogin();
  }

  /* ------------------------------------------------------------------
     NAVIGATION (switches the main area)
     ------------------------------------------------------------------ */

  var VIEWS = {
    dashboard: function () { return renderDashboard(); },
    settings: function () { return renderSettings(); },
    applications: function () { return renderApplications(); },
    enquiries: function () { return renderEnquiries(); },
    passes: function () { return renderPasses(); },
    publish: function () { return renderPublish(); }
  };
  Object.keys(COLLECTIONS).forEach(function (name) {
    VIEWS[name] = function () { return renderCollection(name); };
  });

  function go(view) {
    if (!VIEWS[view]) view = 'dashboard';
    currentView = view;
    records = S.getRecords();
    $$('.admin-nav-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });
    $('#adminContent').innerHTML = VIEWS[view]();
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------
     DASHBOARD
     ------------------------------------------------------------------ */

  function renderDashboard() {
    var pending = records.applications.filter(function (a) { return a.status === 'Pending'; }).length;
    var endpoint = content.settings.formEndpoint;
    var cards = [
      { label: 'Admission Applications', value: records.applications.length, sub: pending + ' pending', go: 'applications' },
      { label: 'Enquiry Messages', value: records.messages.length, sub: 'from contact form', go: 'enquiries' },
      { label: 'Event Passes', value: records.registrations.length, sub: 'event registrations', go: 'passes' },
      { label: 'Courses', value: content.courses.length, sub: 'programs listed', go: 'courses' },
      { label: 'Notices', value: content.notices.length, sub: 'on notice board', go: 'notices' },
      { label: 'Events', value: content.events.length, sub: 'campus events', go: 'events' },
      { label: 'Gallery Photos', value: content.gallery.length, sub: 'campus photos', go: 'gallery' },
      { label: 'FAQs', value: content.faqs.length, sub: 'about page questions', go: 'faqs' }
    ];

    var statHtml = cards.map(function (c) {
      return '<button class="admin-stat" data-go="' + c.go + '" style="text-align:left;cursor:pointer">' +
        '<strong>' + c.value + '</strong><span>' + esc(c.label) + '</span><br><small class="muted">' + esc(c.sub) + '</small></button>';
    }).join('');

    var modeNote = endpoint
      ? '<div class="alert-box alert-success">Online forms are also sent to: <strong>' + esc(endpoint) + '</strong></div>'
      : '<div class="admin-hint-box"><strong>Demo mode:</strong> Forms are saved in this browser only. To receive online applications from students, add a form endpoint in <em>Website Settings → Online Forms</em>.</div>';

    return '<div class="admin-topline"><h1>Dashboard</h1><span class="muted">Session ' + esc(content.settings.session) + '</span></div>' +
      modeNote +
      '<div class="admin-stats">' + statHtml + '</div>' +
      '<div class="admin-card"><h2>Quick Actions</h2><div class="admin-actions">' +
        '<button class="btn btn-primary btn-sm" data-go="notices">+ Post a Notice</button>' +
        '<button class="btn btn-navy btn-sm" data-go="events">+ Add Event</button>' +
        '<button class="btn btn-navy btn-sm" data-go="gallery">+ Add Photo</button>' +
        '<button class="btn btn-navy btn-sm" data-go="settings">Edit Website Settings</button>' +
        '<button class="btn btn-ghost btn-sm" data-go="publish">Publish / Backup</button>' +
        '<a class="btn btn-ghost btn-sm" href="index.html" target="_blank" rel="noopener">Open Website ↗</a>' +
      '</div></div>';
  }

  /* ------------------------------------------------------------------
     GENERIC COLLECTION LIST (notices, courses, events, gallery, faqs, testimonials)
     ------------------------------------------------------------------ */

  function cellHTML(item, col) {
    var value = item[col.key];
    if (col.bool) return value ? '✅ Yes' : '—';
    if (col.money) return S.money(value);
    if (col.image) return value ? '<img class="admin-thumb" src="' + esc(value) + '" alt="">' : '—';
    return esc(value == null ? '' : value);
  }

  function renderCollection(name) {
    var cfg = COLLECTIONS[name];
    var items = content[name] || [];

    var head = cfg.columns.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('');
    var rows = items.map(function (item, index) {
      var cells = cfg.columns.map(function (c) { return '<td>' + cellHTML(item, c) + '</td>'; }).join('');
      return '<tr>' + cells +
        '<td class="actions"><button class="btn btn-ghost btn-sm" data-action="edit" data-col="' + name + '" data-index="' + index + '">Edit</button>' +
        '<button class="btn btn-danger btn-sm" data-action="delete" data-col="' + name + '" data-index="' + index + '">Delete</button></td></tr>';
    }).join('');

    var table = items.length
      ? '<div class="table-wrap"><table class="data-table"><thead><tr>' + head + '<th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<p class="empty-state">Nothing added yet. Click "Add ' + esc(cfg.single) + '" to create one.</p>';

    return '<div class="admin-topline"><h1>' + esc(cfg.label) + ' <small class="muted">(' + items.length + ')</small></h1>' +
      '<button class="btn btn-primary" data-action="add" data-col="' + name + '">+ Add ' + esc(cfg.single) + '</button></div>' +
      '<div class="admin-card">' + table + '</div>';
  }

  /* ------------------------------------------------------------------
     ADD / EDIT POPUP (built from the schema)
     ------------------------------------------------------------------ */

  function fieldHTML(f, value) {
    var id = 'f_' + f.key;
    var req = f.required ? ' <span class="required-star">*</span>' : '';
    var wrapClass = 'form-group' + (f.full ? ' full-width' : '');
    var attrs = f.required ? ' required' : '';
    var listAttr = '';
    var datalist = '';
    if (f.list) {
      listAttr = ' list="dl_' + f.key + '"';
      datalist = '<datalist id="dl_' + f.key + '">' + f.list.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>';
    }

    if (f.type === 'checkbox') {
      return '<div class="' + wrapClass + '"><label class="checkbox-row"><input type="checkbox" id="' + id + '" name="' + f.key + '"' +
        (value ? ' checked' : '') + '><span>' + esc(f.label) + '</span></label></div>';
    }
    if (f.type === 'textarea') {
      return '<div class="' + wrapClass + '"><label for="' + id + '">' + esc(f.label) + req + '</label>' +
        '<textarea class="form-control" id="' + id + '" name="' + f.key + '" rows="3"' + attrs + '>' + esc(value) + '</textarea></div>';
    }
    if (f.type === 'image') {
      return '<div class="' + wrapClass + '"><label for="' + id + '">' + esc(f.label) + req + '</label>' +
        '<input class="form-control" id="' + id + '" name="' + f.key + '" type="text" value="' + esc(value) + '"' + attrs + '>' +
        '<input type="file" accept="image/*" data-upload="' + f.key + '" class="form-control" style="margin-top:0.4rem">' +
        '<span class="admin-note">Best: upload the photo into the <code>images/</code> folder and type its path. Small uploads (under 300 KB) are also accepted.</span></div>';
    }
    var type = f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text');
    var extra = f.type === 'number' ? ' min="0" step="any"' : '';
    var valueAttr = value == null ? '' : ' value="' + esc(value) + '"';
    return '<div class="' + wrapClass + '"><label for="' + id + '">' + esc(f.label) + req + '</label>' +
      '<input class="form-control" id="' + id + '" name="' + f.key + '" type="' + type + '"' + valueAttr + extra + listAttr + attrs + '>' +
      datalist + '</div>';
  }

  function openEditor(name, index) {
    var cfg = COLLECTIONS[name];
    var isNew = index < 0;
    var item = isNew ? {} : content[name][index];
    var form = $('#editForm');

    $('#editTitle').textContent = (isNew ? 'Add new ' : 'Edit ') + cfg.single;
    form.setAttribute('data-collection', name);
    form.setAttribute('data-index', String(index));
    $('#editFields').innerHTML = cfg.fields.map(function (f) {
      return fieldHTML(f, item[f.key] === undefined && f.type !== 'checkbox' ? '' : item[f.key]);
    }).join('');
    $('#editModal').classList.add('open');
  }

  // Reads the popup form, validates it and saves the item
  function handleEditSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var name = form.getAttribute('data-collection');
    var index = Number(form.getAttribute('data-index'));
    var cfg = COLLECTIONS[name];
    var item = index >= 0 ? Object.assign({}, content[name][index]) : {};
    var errors = [];

    cfg.fields.forEach(function (f) {
      var el = form.querySelector('[name="' + f.key + '"]');
      var value;
      if (f.type === 'checkbox') value = el.checked;
      else if (f.type === 'number') value = el.value === '' ? 0 : Number(el.value);
      else value = el.value.trim();
      if (f.slug) value = slugify(value);
      if (f.required && (value === '' || value == null)) errors.push(f.label + ' is required');
      item[f.key] = value;
    });

    if (!item.id) item.id = cfg.prefix + Date.now().toString(36);
    var clash = content[name].some(function (x, i) { return x.id === item.id && i !== index; });
    if (clash) errors.push('Code "' + item.id + '" is already used by another item');
    if (errors.length) { notify(errors.join('. ') + '.', 'error'); return; }

    if (index >= 0) content[name][index] = item;
    else content[name].push(item);
    if (!persist()) return;

    $('#editModal').classList.remove('open');
    notify(cfg.single + ' saved successfully.', 'success');
    go(currentView);
  }

  function deleteItem(name, index) {
    var cfg = COLLECTIONS[name];
    var item = content[name][index];
    var label = item.title || item.name || item.question || item.shortName || cfg.single;
    if (!window.confirm('Delete "' + label + '"? This cannot be undone.')) return;
    content[name].splice(index, 1);
    if (persist()) {
      notify(cfg.single + ' deleted.', 'success');
      go(currentView);
    }
  }

  // Uploaded photo is turned into a data URL (text that browsers can show)
  function handleImageUpload(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 300 * 1024) {
      notify('Image is larger than 300 KB. Please upload it to the images/ folder and type its path instead.', 'error');
      input.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var form = $('#editForm');
      form.querySelector('[name="' + input.getAttribute('data-upload') + '"]').value = reader.result;
      notify('Photo attached. Click Save to keep it.', 'info');
    };
    reader.readAsDataURL(file);
  }

  /* ------------------------------------------------------------------
     WEBSITE SETTINGS
     ------------------------------------------------------------------ */

  function renderSettings() {
    var groups = SETTINGS_GROUPS.map(function (g) {
      var fields = g.fields.map(function (f) {
        var id = 's_' + f.path.replace(/\./g, '_');
        var value = getPath(content, f.path);
        var wrap = 'form-group' + (f.full ? ' full-width' : '');
        if (f.type === 'checkbox') {
          return '<div class="' + wrap + '"><label class="checkbox-row"><input type="checkbox" id="' + id + '" data-path="' + f.path + '"' +
            (value ? ' checked' : '') + '><span>' + esc(f.label) + '</span></label></div>';
        }
        if (f.type === 'textarea') {
          return '<div class="' + wrap + '"><label for="' + id + '">' + esc(f.label) + '</label>' +
            '<textarea class="form-control" id="' + id + '" data-path="' + f.path + '" rows="3">' + esc(value) + '</textarea></div>';
        }
        return '<div class="' + wrap + '"><label for="' + id + '">' + esc(f.label) + '</label>' +
          '<input class="form-control" id="' + id + '" data-path="' + f.path + '" type="text" value="' + esc(value) + '"></div>';
      }).join('');
      return '<div class="admin-card"><h2>' + esc(g.title) + '</h2><div class="admin-form-inline">' + fields + '</div></div>';
    }).join('');

    // Lists are edited as plain text, one item per line
    var tickerLines = (content.tickers || []).join('\n');
    var statLines = (content.stats || []).map(function (s) { return s.label + ' | ' + s.value + ' | ' + (s.suffix || ''); }).join('\n');

    return '<div class="admin-topline"><h1>Website Settings</h1><span class="muted">Changes apply instantly in this browser</span></div>' +
      '<form id="settingsForm">' + groups +
      '<div class="admin-card"><h2>Scrolling Top-Bar Messages</h2>' +
        '<div class="form-group"><label for="s_tickers">One message per line</label>' +
        '<textarea class="form-control" id="s_tickers" data-list="tickers" rows="4">' + esc(tickerLines) + '</textarea></div></div>' +
      '<div class="admin-card"><h2>Home Page Counters</h2>' +
        '<div class="form-group"><label for="s_stats">One per line in the format:  label | number | suffix</label>' +
        '<textarea class="form-control" id="s_stats" data-list="stats" rows="4">' + esc(statLines) + '</textarea>' +
        '<span class="admin-note">Example: Successful Alumni Network | 12500 | +</span></div></div>' +
      '<div class="admin-actions"><button class="btn btn-primary" type="submit">Save All Settings</button></div>' +
      '</form>';
  }

  function saveSettings(form) {
    $$('[data-path]', form).forEach(function (el) {
      var value = el.type === 'checkbox' ? el.checked : el.value.trim();
      setPath(content, el.getAttribute('data-path'), value);
    });

    var tickers = $('#s_tickers', form).value.split('\n').map(function (t) { return t.trim(); }).filter(Boolean);
    content.tickers = tickers;

    var stats = [];
    $('#s_stats', form).value.split('\n').forEach(function (line) {
      var parts = line.split('|').map(function (p) { return p.trim(); });
      if (parts[0]) stats.push({ label: parts[0], value: Number(parts[1]) || 0, suffix: parts[2] || '' });
    });
    content.stats = stats;

    if (persist()) notify('Settings saved. Open the website to see the changes.', 'success');
  }

  /* ------------------------------------------------------------------
     APPLICATIONS, ENQUIRIES & EVENT PASSES
     ------------------------------------------------------------------ */

  function renderApplications() {
    var list = records.applications.filter(function (a) {
      return appFilter === 'All' || a.status === appFilter;
    }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });

    var filterOpts = ['All'].concat(STATUS_OPTIONS).map(function (s) {
      return '<option value="' + s + '"' + (s === appFilter ? ' selected' : '') + '>' + s + '</option>';
    }).join('');

    var rows = list.map(function (a) {
      var options = STATUS_OPTIONS.map(function (s) {
        return '<option value="' + s + '"' + (s === a.status ? ' selected' : '') + '>' + s + '</option>';
      }).join('');
      return '<tr><td><strong>' + esc(a.ref) + '</strong><br><small class="muted">' + esc(formatDateTime(a.createdAt)) + '</small></td>' +
        '<td>' + esc(a.name) + '<br><small class="muted">' + esc(a.email) + ' • ' + esc(a.mobile) + '</small></td>' +
        '<td>' + esc(a.courseName) + '</td><td>' + esc(a.marks) + '%</td><td>' + esc(a.city) + '</td>' +
        '<td><select class="form-control" data-status-ref="' + esc(a.ref) + '">' + options + '</select></td>' +
        '<td class="actions"><button class="btn btn-danger btn-sm" data-del-record="applications" data-key="' + esc(a.ref) + '">Delete</button></td></tr>';
    }).join('');

    return '<div class="admin-topline"><h1>Admission Applications <small class="muted">(' + records.applications.length + ')</small></h1>' +
      '<div class="admin-actions"><select class="form-control" data-app-filter style="width:auto">' + filterOpts + '</select>' +
      '<button class="btn btn-navy" data-action="export-csv" data-kind="applications">Export CSV</button></div></div>' +
      '<div class="admin-card">' + (list.length
        ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Reference</th><th>Applicant</th><th>Course</th><th>Marks</th><th>City</th><th>Status</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<p class="empty-state">No applications yet. Submitted forms will appear here.</p>') + '</div>';
  }

  function renderEnquiries() {
    var list = records.messages.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var rows = list.map(function (m) {
      return '<tr><td>' + esc(formatDateTime(m.createdAt)) + '</td><td><strong>' + esc(m.name) + '</strong><br><small class="muted">' + esc(m.email) + ' • ' + esc(m.phone || '-') + '</small></td>' +
        '<td>' + esc(m.subject || 'General') + '</td><td style="max-width:360px">' + esc(m.message) + '</td>' +
        '<td class="actions"><button class="btn btn-danger btn-sm" data-del-record="messages" data-key="' + esc(m.ref) + '">Delete</button></td></tr>';
    }).join('');
    return '<div class="admin-topline"><h1>Enquiries <small class="muted">(' + list.length + ')</small></h1>' +
      '<div class="admin-actions"><button class="btn btn-navy" data-action="export-csv" data-kind="messages">Export CSV</button></div></div>' +
      '<div class="admin-card">' + (list.length
        ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Received</th><th>From</th><th>Subject</th><th>Message</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<p class="empty-state">No enquiries yet.</p>') + '</div>';
  }

  function renderPasses() {
    var list = records.registrations.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var rows = list.map(function (r) {
      return '<tr><td><strong>' + esc(r.passId) + '</strong></td><td>' + esc(r.name) + '<br><small class="muted">' + esc(r.email) + '</small></td>' +
        '<td>' + esc(r.rollOrCourse) + '</td><td>' + esc(r.eventTitle) + '</td><td>' + esc(formatDateTime(r.createdAt)) + '</td>' +
        '<td class="actions"><button class="btn btn-danger btn-sm" data-del-record="registrations" data-key="' + esc(r.passId) + '">Delete</button></td></tr>';
    }).join('');
    return '<div class="admin-topline"><h1>Event Passes <small class="muted">(' + list.length + ')</small></h1>' +
      '<div class="admin-actions"><button class="btn btn-navy" data-action="export-csv" data-kind="registrations">Export CSV</button></div></div>' +
      '<div class="admin-card">' + (list.length
        ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Pass ID</th><th>Student</th><th>Roll / Course</th><th>Event</th><th>Registered</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<p class="empty-state">No event registrations yet.</p>') + '</div>';
  }

  // Deletes one record from applications / messages / registrations
  function deleteRecord(kind, key) {
    var keyField = kind === 'registrations' ? 'passId' : 'ref';
    if (!window.confirm('Delete this record permanently?')) return;
    records[kind] = records[kind].filter(function (r) { return r[keyField] !== key; });
    S.saveRecords(records);
    notify('Record deleted.', 'success');
    go(currentView);
  }

  function exportCSV(kind) {
    var headers = {
      applications: ['ref', 'name', 'email', 'mobile', 'dob', 'courseName', 'marks', 'gender', 'city', 'status', 'createdAt'],
      messages: ['ref', 'name', 'email', 'phone', 'subject', 'message', 'createdAt'],
      registrations: ['passId', 'name', 'email', 'rollOrCourse', 'eventTitle', 'createdAt']
    }[kind];
    var csv = toCSV(records[kind], headers);
    downloadFile(kind + '-' + new Date().toISOString().slice(0, 10) + '.csv', csv, 'text/csv;charset=utf-8');
    notify('CSV file downloaded. Open it with Excel or Google Sheets.', 'success');
  }

  /* ------------------------------------------------------------------
     BACKUP & PUBLISH
     ------------------------------------------------------------------ */

  function renderPublish() {
    var hasLocalEdits = localStorage.getItem(S.storageKeys.content) !== null;
    return '<div class="admin-topline"><h1>Backup &amp; Publish</h1></div>' +
      '<div class="admin-card"><h2>How to publish your website</h2>' +
      '<ol style="margin-left:1.2rem;line-height:1.9">' +
        '<li>Make your changes in this admin panel and check them on the website.</li>' +
        '<li>Click <strong>Download site-data.js</strong> below.</li>' +
        '<li>Replace the file <code>data/site-data.js</code> in your project folder with the downloaded file.</li>' +
        '<li>Upload the whole <code>kushagra_proj</code> folder to any free host (Netlify Drop, GitHub Pages, Vercel, or your college server). Done!</li>' +
      '</ol>' +
      '<p class="admin-note">Local edits in this browser: <strong>' + (hasLocalEdits ? 'YES (saved in browser)' : 'No (website uses file defaults)') + '</strong></p></div>' +
      '<div class="admin-cards-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.2rem">' +
        '<div class="admin-card"><h2>Download</h2>' +
          '<div class="admin-actions" style="flex-direction:column;align-items:stretch">' +
          '<button class="btn btn-primary" data-action="dl-data">⬇ Download site-data.js</button>' +
          '<button class="btn btn-navy" data-action="dl-backup">⬇ Download full backup (.json)</button>' +
          '<a class="btn btn-ghost" href="index.html" target="_blank" rel="noopener">Preview website ↗</a></div></div>' +
        '<div class="admin-card"><h2>Restore</h2>' +
          '<p class="admin-note" style="margin-bottom:0.6rem">Upload a backup .json file made earlier.</p>' +
          '<input type="file" accept="application/json,.json" data-restore class="form-control"></div>' +
        '<div class="admin-card"><h2>Reset &amp; Clean-up</h2>' +
          '<div class="admin-actions" style="flex-direction:column;align-items:stretch">' +
          '<button class="btn btn-ghost" data-action="reset-content">Reset content to file defaults</button>' +
          '<button class="btn btn-danger" data-action="clear-records">Delete all applications, enquiries &amp; passes</button></div></div>' +
      '</div>';
  }

  function buildSiteDataFile() {
    var stamp = new Date().toLocaleString('en-IN');
    return '/* ==========================================================================\n' +
      '   AXIS COLLEGES - SITE CONTENT (data/site-data.js)\n' +
      '   Generated from the Admin Panel on ' + stamp + '\n' +
      '   ========================================================================== */\n\n' +
      'window.AXIS_DATA = ' + JSON.stringify(content, null, 2) + ';\n';
  }

  function restoreBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data.content || !data.content.settings) throw new Error('invalid');
        content = data.content;
        S.saveRecords(data.records || { applications: [], messages: [], registrations: [] });
        persist();
        notify('Backup restored successfully.', 'success');
        go('dashboard');
      } catch (err) {
        notify('This file is not a valid backup. Please choose the .json file downloaded from this panel.', 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------------
     EVENT WIRING (click / change / submit on the admin page)
     ------------------------------------------------------------------ */

  function bindEvents() {
    $('#loginForm').addEventListener('submit', handleLogin);
    $('#logoutBtn').addEventListener('click', logout);

    $$('.admin-nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { go(btn.getAttribute('data-view')); });
    });

    // All buttons inside the main area use data attributes to say what they do
    $('#adminContent').addEventListener('click', function (e) {
      var t = e.target.closest('button, a');
      if (!t) return;

      if (t.hasAttribute('data-go')) return go(t.getAttribute('data-go'));
      if (t.hasAttribute('data-del-record')) return deleteRecord(t.getAttribute('data-del-record'), t.getAttribute('data-key'));

      var action = t.getAttribute('data-action');
      if (action === 'add') return openEditor(t.getAttribute('data-col'), -1);
      if (action === 'edit') return openEditor(t.getAttribute('data-col'), Number(t.getAttribute('data-index')));
      if (action === 'delete') return deleteItem(t.getAttribute('data-col'), Number(t.getAttribute('data-index')));
      if (action === 'export-csv') return exportCSV(t.getAttribute('data-kind'));
      if (action === 'dl-data') {
        downloadFile('site-data.js', buildSiteDataFile(), 'application/javascript;charset=utf-8');
        return notify('Downloaded. Replace data/site-data.js with this file to publish.', 'success');
      }
      if (action === 'dl-backup') {
        var backup = { exportedAt: new Date().toISOString(), content: content, records: S.getRecords() };
        downloadFile('axis-website-backup.json', JSON.stringify(backup, null, 2), 'application/json');
        return notify('Backup downloaded.', 'success');
      }
      if (action === 'reset-content') {
        if (!window.confirm('Remove all admin edits in this browser and go back to the file defaults?')) return;
        S.resetContent();
        content = S.getContent();
        notify('Content reset to file defaults.', 'success');
        return go('dashboard');
      }
      if (action === 'clear-records') {
        if (!window.confirm('Delete ALL applications, enquiries and event passes saved in this browser?')) return;
        S.saveRecords({ applications: [], messages: [], registrations: [] });
        notify('All records cleared.', 'success');
        return go('publish');
      }
    });

    // Dropdowns and file pickers
    $('#adminContent').addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-status-ref')) {
        var app = records.applications.find(function (a) { return a.ref === t.getAttribute('data-status-ref'); });
        if (app) {
          app.status = t.value;
          S.saveRecords(records);
          notify('Status of ' + app.ref + ' changed to ' + app.status + '.', 'success');
          go('applications');
        }
      }
      if (t.hasAttribute('data-app-filter')) {
        appFilter = t.value;
        go('applications');
      }
      if (t.hasAttribute('data-restore') && t.files && t.files[0]) {
        restoreBackup(t.files[0]);
      }
    });

    // Settings form
    $('#adminContent').addEventListener('submit', function (e) {
      if (e.target.id === 'settingsForm') {
        e.preventDefault();
        saveSettings(e.target);
      }
    });

    // Add / edit popup
    $('#editForm').addEventListener('submit', handleEditSubmit);
    $('#editForm').addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-upload')) handleImageUpload(e.target);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    content = S.getContent();
    records = S.getRecords();
    bindEvents();
    if (isLoggedIn()) showApp();
    else showLogin();
  });
})();
