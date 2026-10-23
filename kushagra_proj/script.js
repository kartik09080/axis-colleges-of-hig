/* ==========================================================================
   AXIS COLLEGES OF HIGHER EDUCATION - MAIN JAVASCRIPT (script.js)
   Project Folder : kushagra_proj
   Technologies   : Basic Vanilla JavaScript (DOM, events, validation, localStorage)

   WHAT THIS FILE DOES (viva notes)
   1. Reads the content from data/site-data.js (window.AXIS_DATA).
   2. Applies any changes saved from the Admin Panel (localStorage override).
   3. Builds the header, top bar and footer on every page (same code = no repeats).
   4. Fills every list on the site from data: notices, courses, gallery, events,
      FAQs, testimonials, colleges table, stats counters, etc.
   5. Handles user actions: filters, search, FAQ accordion, fee calculator,
      photo lightbox, event registration, admission form, enquiry form and
      application tracking.
   6. Saves submitted forms in the browser (localStorage). If a form endpoint
      is set in settings, the same data is also sent to it.
   ========================================================================== */

/* ---------- Storage keys (names used in localStorage) ---------- */
var STORAGE_CONTENT = 'axis_cms_content';   // admin edits (content override)
var STORAGE_RECORDS = 'axis_records';       // applications, enquiries, event passes

/* ---------- Small helper functions ---------- */

// Short form of document.querySelector
function $(selector, root) { return (root || document).querySelector(selector); }

// Short form of querySelectorAll, returns a real array
function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

// Escapes HTML so that user text can never break the page (security basics)
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Formats a number as Indian rupees, e.g. 95000 -> ₹95,000
function money(amount) { return '₹' + Number(amount || 0).toLocaleString('en-IN'); }

// Reads JSON from localStorage safely (returns fallback if missing or broken)
function readJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

// Writes JSON to localStorage. Returns false if the browser refuses (e.g. storage full)
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

// Converts "2026-10-24" into a Date object
function parseISO(iso) {
  var parts = String(iso || '').split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function dayOf(iso) { return String(parseISO(iso).getDate()).padStart(2, '0'); }
function monthOf(iso) { return parseISO(iso).toLocaleString('en-US', { month: 'short' }); }

// Removes spaces, brackets and dashes from a phone number for tel: links
function cleanPhone(phone) { return String(phone || '').replace(/[^+\d]/g, ''); }

// Reads a value by path, e.g. getPath(DATA, 'settings.phone')
function getPath(obj, path) {
  return String(path).split('.').reduce(function (o, key) { return o == null ? undefined : o[key]; }, obj);
}

// Returns the list of unique values in an array (keeps original order)
function unique(list) {
  return list.filter(function (item, index) { return list.indexOf(item) === index; });
}

// Name of the current page file, e.g. "courses.html" (home page = index.html)
function currentFile() {
  var name = window.location.pathname.split('/').pop();
  return name || 'index.html';
}

/* ---------- 1. CONTENT LOADING (data file + admin overrides) ---------- */

// Default content comes from data/site-data.js.
// If the admin saved changes in this browser, those saved values replace the defaults.
function loadContent() {
  var defaults = window.AXIS_DATA || {};
  var saved = readJSON(STORAGE_CONTENT, null);
  var merged = {};
  Object.keys(defaults).forEach(function (key) { merged[key] = defaults[key]; });
  if (saved && typeof saved === 'object') {
    Object.keys(saved).forEach(function (key) { merged[key] = saved[key]; });
  }
  return merged;
}

var DATA = loadContent();

/* ---------- 2. RECORDS (applications, enquiries, event passes) ---------- */

function getRecords() {
  var empty = { applications: [], messages: [], registrations: [] };
  var records = readJSON(STORAGE_RECORDS, empty);
  ['applications', 'messages', 'registrations'].forEach(function (key) {
    if (!Array.isArray(records[key])) records[key] = [];
  });
  return records;
}

function saveRecords(records) { return writeJSON(STORAGE_RECORDS, records); }

// Sends a form to an external endpoint (Formspree, Google Apps Script, etc.)
// Only runs if settings.formEndpoint is filled in. Failure never blocks the user.
function sendToEndpoint(formType, data) {
  var url = DATA.settings && DATA.settings.formEndpoint;
  if (!url) return Promise.resolve(false);
  var body = Object.assign({ _form: formType, _submittedAt: new Date().toISOString() }, data);
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body)
  }).then(function (res) { return res.ok; })
    .catch(function () { return false; });
}

// Random reference numbers like AXIS-2026-48213
function makeRef(prefix) {
  var rand = Math.floor(10000 + Math.random() * 90000);
  return prefix + '-' + new Date().getFullYear() + '-' + rand;
}

/* ---------- 3. SHARED LAYOUT (top bar, header, footer) ---------- */

function renderLayout() {
  var s = DATA.settings;
  var file = currentFile();

  // Top bar with rotating announcement + helpline
  var top = $('#site-topbar');
  if (top) {
    var firstTicker = (DATA.tickers && DATA.tickers[0]) || '';
    top.innerHTML =
      '<div class="top-bar"><div class="top-bar-inner">' +
        '<div class="top-notice"><span class="badge-live">Update</span>' +
        '<span id="topTickerText">' + esc(firstTicker) + '</span></div>' +
        '<div class="top-contact">Helpline: <a href="tel:' + esc(cleanPhone(s.phone)) + '">' + esc(s.phone) + '</a>' +
        '<span>|</span>' + esc(s.approvals) + '</div>' +
      '</div></div>';
  }

  // Header with logo and navigation menu
  var header = $('#site-header');
  if (header) {
    var links = [
      { text: 'Home', href: 'index.html' },
      { text: 'About Us', href: 'about.html' },
      { text: 'Courses & Fees', href: 'courses.html' },
      { text: 'Campus & Events', href: 'campus.html' },
      { text: 'Contact', href: 'admissions.html#contact' },
      { text: 'Apply Online', href: 'admissions.html', cta: true }
    ];
    var linkHtml = links.map(function (link) {
      var isActive = link.href.split('#')[0] === file ? ' active' : '';
      var ctaClass = link.cta ? ' nav-cta' : '';
      return '<a href="' + link.href + '" class="' + ctaClass + isActive + '">' + esc(link.text) + '</a>';
    }).join('');

    header.innerHTML =
      '<nav class="navbar" aria-label="Main navigation">' +
        '<a href="index.html" class="brand"><span class="brand-crest">A</span>' +
        '<span class="brand-text"><strong>' + esc(s.shortName) + '</strong>' +
        '<small>' + esc(s.tagline) + '</small></span></a>' +
        '<button class="menu-toggle" id="menuToggleBtn" aria-label="Open menu" aria-expanded="false">☰</button>' +
        '<div class="nav-links" id="mainNavLinks">' + linkHtml + '</div>' +
      '</nav>';
  }

  // Footer with contact details and quick links
  var footer = $('#site-footer');
  if (footer) {
    var quick = DATA.footerLinks.map(function (l) {
      return '<li><a href="' + esc(l.href) + '">' + esc(l.text) + '</a></li>';
    }).join('');
    var popular = DATA.courses.filter(function (c) { return c.featured; }).map(function (c) {
      return '<li><a href="admissions.html?course=' + esc(c.id) + '">' + esc(c.shortName) + '</a></li>';
    }).join('');

    footer.innerHTML =
      '<div class="container"><div class="footer-grid">' +
        '<div><h4>' + esc(s.collegeName) + '</h4>' +
        '<p>' + esc(s.address) + '</p>' +
        '<p>' + esc(s.footerNote) + '</p>' +
        '<p>Email: <a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></p></div>' +
        '<div><h4>Quick Navigation</h4><ul class="footer-links">' + quick + '</ul></div>' +
        '<div><h4>Popular Courses</h4><ul class="footer-links">' + popular + '</ul></div>' +
        '<div><h4>Admission Office</h4>' +
        '<p>' + esc(s.officeHours) + '</p>' +
        '<p>Helpline: <a href="tel:' + esc(cleanPhone(s.phone)) + '">' + esc(s.phone) + '</a></p>' +
        '<p>Toll-Free: ' + esc(s.tollFree) + '</p>' +
        '<p><a href="admin.html">Staff Login</a></p></div>' +
      '</div>' +
      '<div class="footer-bottom"><span>© ' + new Date().getFullYear() + ' ' + esc(s.collegeName) + '. All Rights Reserved.</span>' +
      '<span>' + esc(s.approvals) + '</span></div></div>';
  }
}

/* ---------- 4. DATA BINDING (data-bind="path" attributes) ----------
   Any element with data-bind="settings.phone" gets its text replaced by
   the value from the data file. This keeps static HTML pages dynamic. */

function applyBindings() {
  $$('[data-bind]').forEach(function (el) {
    var value = getPath(DATA, el.getAttribute('data-bind'));
    if (value != null) el.textContent = value;
  });

  $$('[data-bind-href]').forEach(function (el) {
    var value = getPath(DATA, el.getAttribute('data-bind-href'));
    if (value == null) return;
    var prefix = el.getAttribute('data-prefix') || '';
    var text = prefix === 'tel:' ? cleanPhone(value) : String(value);
    el.setAttribute('href', prefix + text);
  });

  $$('[data-bind-src]').forEach(function (el) {
    var value = getPath(DATA, el.getAttribute('data-bind-src'));
    if (value != null) el.setAttribute('src', value);
  });

  $$('[data-bind-bg]').forEach(function (el) {
    var value = getPath(DATA, el.getAttribute('data-bind-bg'));
    if (value != null) el.style.setProperty('--hero-img', "url('" + value + "')");
  });
}

/* ---------- 5. MOBILE MENU & TOP TICKER ---------- */

function initMobileNavbar() {
  var menuBtn = $('#menuToggleBtn');
  var navLinks = $('#mainNavLinks');
  if (!menuBtn || !navLinks) return;

  menuBtn.addEventListener('click', function () {
    navLinks.classList.toggle('show');
    var isOpen = navLinks.classList.contains('show');
    menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    menuBtn.textContent = isOpen ? '✕' : '☰';
  });
}

// Changes the top bar message every few seconds
function initTopTicker() {
  var tickerText = $('#topTickerText');
  var messages = DATA.tickers || [];
  if (!tickerText || messages.length < 2) return;

  var index = 0;
  setInterval(function () {
    index = (index + 1) % messages.length;
    tickerText.textContent = messages[index];
  }, 4500);
}

/* ---------- 6. HOME: ANIMATED STATS COUNTER ---------- */

function renderStats() {
  var box = $('#statsStrip');
  if (!box) return;

  box.innerHTML = '<div class="container"><div class="stats-grid">' +
    DATA.stats.map(function (item) {
      return '<div class="stat-item"><div class="stat-number">' +
        '<b class="js-counter" data-target="' + Number(item.value) + '">0</b>' +
        '<span>' + esc(item.suffix || '') + '</span></div>' +
        '<div class="stat-label">' + esc(item.label) + '</div></div>';
    }).join('') +
    '</div></div>';

  $$('.js-counter', box).forEach(animateCounter);
}

// Counts from 0 up to data-target in about 1.3 seconds
function animateCounter(el) {
  var target = Number(el.getAttribute('data-target')) || 0;
  var steps = 40;
  var step = Math.max(1, Math.ceil(target / steps));
  var current = 0;
  var timer = setInterval(function () {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current.toLocaleString('en-IN');
  }, 32);
}

/* ---------- 7. HOME: NOTICE BOARD FILTER ---------- */

function noticeHTML(notice) {
  return '<article class="notice-item" data-cat="' + esc(notice.category) + '">' +
    '<div class="notice-date"><strong>' + dayOf(notice.date) + '</strong>' + monthOf(notice.date) + '</div>' +
    '<div class="notice-info"><span class="notice-cat">' + esc(notice.category) + '</span>' +
    '<h4>' + esc(notice.title) + '</h4><p>' + esc(notice.body) + '</p></div></article>';
}

function renderNotices() {
  var list = $('#noticeList');
  var filters = $('#noticeFilters');
  if (!list || !filters) return;

  var categories = ['All'].concat(unique(DATA.notices.map(function (n) { return n.category; })));
  filters.innerHTML = categories.map(function (cat, i) {
    return '<button class="pill-btn' + (i === 0 ? ' active' : '') + '" data-cat="' + esc(cat) + '">' + esc(cat) + '</button>';
  }).join('');

  // Newest notices first
  var sorted = DATA.notices.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });

  function draw(category) {
    var items = sorted.filter(function (n) { return category === 'All' || n.category === category; });
    list.innerHTML = items.length
      ? items.map(noticeHTML).join('')
      : '<p class="empty-state">No notices in this category yet.</p>';
  }

  filters.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    $$('button', filters).forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    draw(btn.getAttribute('data-cat'));
  });

  draw('All');
}

/* ---------- 8. HOME: PROGRAMS, FACILITIES, PLACEMENTS, TESTIMONIALS ---------- */

function renderFeaturedPrograms() {
  var box = $('#featuredPrograms');
  if (!box) return;
  var featured = DATA.courses.filter(function (c) { return c.featured; });
  box.innerHTML = featured.map(function (c) {
    return '<article class="feature-card program-card"><div class="card-body">' +
      '<span class="course-dept">' + esc(c.stream) + ' • ' + esc(c.affiliation) + '</span>' +
      '<h3>' + esc(c.name) + '</h3>' +
      '<p class="course-desc">' + esc(c.description) + '</p>' +
      '<p class="course-meta"><strong>Duration</strong><span>' + esc(c.duration) + '</span>' +
      '<strong>Annual Fee</strong><span>' + money(c.fee) + '</span></p>' +
      '<a class="btn btn-outline btn-sm" href="courses.html#fees">View Fee &amp; Details</a>' +
      '</div></article>';
  }).join('');
}

function renderFacilities() {
  var box = $('#facilitiesGrid');
  if (!box) return;
  box.innerHTML = (DATA.facilities || []).map(function (f) {
    return '<article class="feature-card"><img src="' + esc(f.image) + '" alt="' + esc(f.title) + '" loading="lazy">' +
      '<div class="card-body"><h3>' + esc(f.title) + '</h3><p>' + esc(f.text) + '</p></div></article>';
  }).join('');
}

function renderRecruiters() {
  var box = $('#recruiterBadges');
  if (!box) return;
  box.innerHTML = (DATA.recruiters || []).map(function (name) {
    return '<span>' + esc(name) + '</span>';
  }).join('');
}

function renderTestimonials() {
  var box = $('#testimonialGrid');
  if (!box) return;
  box.innerHTML = (DATA.testimonials || []).map(function (t) {
    return '<figure class="quote-card"><p>' + esc(t.quote) + '</p>' +
      '<figcaption class="quote-author">' + esc(t.name) + '<small>' + esc(t.role) + '</small></figcaption></figure>';
  }).join('');
}

/* ---------- 9. ABOUT: COLLEGES TABLE & FAQ ACCORDION ---------- */

function renderColleges() {
  var body = $('#collegesBody');
  if (!body) return;
  body.innerHTML = DATA.colleges.map(function (c) {
    return '<tr><td><strong>' + esc(c.name) + '</strong></td><td>' + esc(c.programs) + '</td>' +
      '<td>' + esc(c.university) + '</td><td>' + esc(c.approval) + '</td><td>' + esc(c.established) + '</td></tr>';
  }).join('');
}

function renderFaqs() {
  var list = $('#faqList');
  if (!list) return;
  list.innerHTML = DATA.faqs.map(function (f) {
    return '<div class="faq-item card">' +
      '<button class="faq-question" aria-expanded="false">' + esc(f.question) + '<span class="faq-icon">+</span></button>' +
      '<div class="faq-answer">' + esc(f.answer) + '</div></div>';
  }).join('');

  // Click on a question opens or closes its answer
  list.addEventListener('click', function (e) {
    var btn = e.target.closest('.faq-question');
    if (!btn) return;
    var item = btn.parentElement;
    var isOpen = item.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}

/* ---------- 10. COURSES: SEARCH, STREAM FILTER & CARDS ---------- */

var STREAM_CLASS = {
  'Computer Apps': 'stream-computer',
  'Management': 'stream-management',
  'Pharmacy': 'stream-pharmacy'
};

function courseCardHTML(c) {
  return '<article class="course-card ' + (STREAM_CLASS[c.stream] || '') + '">' +
    '<span class="course-dept">' + esc(c.stream) + ' • ' + esc(c.affiliation) + '</span>' +
    '<h3>' + esc(c.name) + '</h3>' +
    '<p class="course-desc">' + esc(c.description) + '</p>' +
    '<div class="course-meta">' +
      '<strong>Duration / Seats</strong><span>' + esc(c.duration) + ' • ' + esc(c.seats) + ' Seats</span>' +
      '<strong>Eligibility</strong><span>' + esc(c.eligibility) + '</span>' +
      '<strong>Admission</strong><span>' + esc(c.admissionMode) + '</span>' +
    '</div>' +
    '<p class="course-fee">' + money(c.fee) + ' <small>/ year tuition</small></p>' +
    '<a class="btn btn-primary btn-sm" href="admissions.html?course=' + esc(c.id) + '">Apply for ' + esc(c.shortName) + '</a>' +
    '</article>';
}

function renderCourses() {
  var grid = $('#courseGrid');
  var search = $('#courseSearch');
  var filters = $('#streamFilters');
  if (!grid) return;

  var streams = ['All'].concat(unique(DATA.courses.map(function (c) { return c.stream; })));
  var activeStream = 'All';

  if (filters) {
    filters.innerHTML = streams.map(function (s, i) {
      return '<button class="pill-btn' + (i === 0 ? ' active' : '') + '" data-stream="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('');
  }

  function draw() {
    var query = search ? search.value.trim().toLowerCase() : '';
    var items = DATA.courses.filter(function (c) {
      var text = (c.name + ' ' + c.shortName + ' ' + c.description + ' ' + c.affiliation).toLowerCase();
      var matchStream = activeStream === 'All' || c.stream === activeStream;
      return matchStream && text.indexOf(query) !== -1;
    });
    grid.innerHTML = items.length
      ? items.map(courseCardHTML).join('')
      : '<p class="empty-state">No programs match your search. Try another keyword.</p>';
    var count = $('#courseCount');
    if (count) count.textContent = 'Showing ' + items.length + ' of ' + DATA.courses.length + ' Programs';
  }

  if (search) search.addEventListener('input', draw);
  if (filters) {
    filters.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-stream]');
      if (!btn) return;
      $$('button', filters).forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeStream = btn.getAttribute('data-stream');
      draw();
    });
  }
  draw();
}

/* ---------- 11. FEE ESTIMATOR (scholarship + hostel) ----------
   Net fee = base tuition - (tuition x scholarship %) + hostel charge */

function findSlab(percent) {
  // feeSlabs is sorted from highest "min" to lowest, so the first match wins
  var slabs = DATA.feeSlabs;
  for (var i = 0; i < slabs.length; i++) {
    if (percent >= slabs[i].min) return slabs[i];
  }
  return slabs[slabs.length - 1];
}

function calculateFee(courseId, percent, hostelId) {
  var course = DATA.courses.find(function (c) { return c.id === courseId; });
  var hostel = DATA.hostelOptions.find(function (h) { return h.id === hostelId; }) || DATA.hostelOptions[0];
  var slab = findSlab(percent);
  var base = course ? course.fee : 0;
  var discount = Math.round(base * slab.discount / 100);
  return {
    course: course,
    slab: slab,
    base: base,
    discount: discount,
    hostel: hostel.charge,
    net: base - discount + hostel.charge
  };
}

function renderFeeCalculator() {
  var form = $('#feeForm');
  if (!form) return;

  var courseSel = $('#feeCourse');
  var hostelSel = $('#feeHostel');
  var slabList = $('#slabList');

  if (courseSel) {
    courseSel.innerHTML = DATA.courses.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.shortName) + ' (' + money(c.fee) + ' / Yr)</option>';
    }).join('');
  }
  if (hostelSel) {
    hostelSel.innerHTML = DATA.hostelOptions.map(function (h) {
      return '<option value="' + esc(h.id) + '">' + esc(h.label) + '</option>';
    }).join('');
  }
  if (slabList) {
    slabList.innerHTML = DATA.feeSlabs.map(function (s) {
      var text = s.discount > 0 ? s.discount + '% Waiver on Annual Tuition Fee' : 'Standard Tuition (Eligible for UP Govt. Scholarship)';
      return '<li><strong>' + esc(s.label) + '</strong> — ' + esc(text) + '</li>';
    }).join('');
  }

  // Pre-select a course if the user came from a "Check fee" link
  var preset = new URLSearchParams(window.location.search).get('course');
  if (preset && courseSel) courseSel.value = preset;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var marksInput = $('#feeMarks');
    var errorBox = $('#feeError');
    var percent = parseFloat(marksInput.value);

    if (isNaN(percent) || percent < 0 || percent > 100) {
      errorBox.textContent = 'Please enter marks between 0 and 100.';
      errorBox.hidden = false;
      $('#feeResult').hidden = true;
      return;
    }

    errorBox.hidden = true;
    var result = calculateFee(courseSel.value, percent, hostelSel.value);

    $('#resCourse').textContent = result.course ? result.course.shortName : '-';
    $('#resBase').textContent = money(result.base);
    $('#resSlab').textContent = result.slab.label;
    $('#resDiscount').textContent = '- ' + money(result.discount);
    $('#resHostel').textContent = money(result.hostel);
    $('#resNet').textContent = money(result.net);
    // "Apply Now" button opens the admission form with this course pre-selected
    $('#resApply').href = 'admissions.html?course=' + encodeURIComponent(courseSel.value);
    $('#feeResult').hidden = false;
  });
}

/* ---------- 12. CAMPUS: GALLERY, LIGHTBOX & EVENTS ---------- */

var galleryView = [];   // photos currently shown after filtering
var lightboxIndex = 0;

function renderGallery() {
  var grid = $('#galleryGrid');
  var filters = $('#galleryFilters');
  if (!grid) return;

  var categories = ['All'].concat(unique(DATA.gallery.map(function (g) { return g.category; })));
  if (filters) {
    filters.innerHTML = categories.map(function (cat, i) {
      return '<button class="pill-btn' + (i === 0 ? ' active' : '') + '" data-cat="' + esc(cat) + '">' + esc(cat) + '</button>';
    }).join('');
    filters.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-cat]');
      if (!btn) return;
      $$('button', filters).forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      draw(btn.getAttribute('data-cat'));
    });
  }

  function draw(cat) {
    galleryView = DATA.gallery.filter(function (g) { return cat === 'All' || g.category === cat; });
    grid.innerHTML = galleryView.length
      ? galleryView.map(function (g, i) {
          return '<figure class="gallery-item" tabindex="0" role="button" data-index="' + i + '" aria-label="Open ' + esc(g.title) + '">' +
            '<img src="' + esc(g.image) + '" alt="' + esc(g.title) + '" loading="lazy">' +
            '<figcaption class="gallery-caption"><strong>' + esc(g.title) + '</strong><small>' + esc(g.caption) + '</small></figcaption></figure>';
        }).join('')
      : '<p class="empty-state">No photos in this category.</p>';
  }

  // Clicking (or pressing Enter on) a photo opens the lightbox
  grid.addEventListener('click', function (e) {
    var item = e.target.closest('.gallery-item');
    if (item) openLightbox(Number(item.getAttribute('data-index')));
  });
  grid.addEventListener('keydown', function (e) {
    var item = e.target.closest('.gallery-item');
    if (item && e.key === 'Enter') openLightbox(Number(item.getAttribute('data-index')));
  });

  draw('All');
}

function showLightboxPhoto() {
  var photo = galleryView[lightboxIndex];
  if (!photo) return;
  $('#lbImg').src = photo.image;
  $('#lbImg').alt = photo.title;
  $('#lbTitle').textContent = photo.title;
  $('#lbCounter').textContent = (lightboxIndex + 1) + ' / ' + galleryView.length;
}

function openLightbox(index) {
  lightboxIndex = index;
  showLightboxPhoto();
  openModal('lightbox');
}

function changeLightbox(step) {
  if (!galleryView.length) return;
  lightboxIndex = (lightboxIndex + step + galleryView.length) % galleryView.length;
  showLightboxPhoto();
}

function renderEvents() {
  var list = $('#eventList');
  if (!list) return;
  list.innerHTML = DATA.events.map(function (ev) {
    var button = ev.open
      ? '<button class="btn btn-primary btn-sm" data-event-id="' + esc(ev.id) + '">Register for Event</button>'
      : '<span class="status-badge">Registration Closed</span>';
    return '<article class="card event-card">' +
      '<div class="event-date">' + esc(ev.dateText) + '</div>' +
      '<div><h3>' + esc(ev.title) + '</h3><p>' + esc(ev.description) + '</p>' +
      '<span class="event-venue">📍 ' + esc(ev.venue) + '</span></div>' +
      '<div>' + button + '</div></article>';
  }).join('');

  // Event "Register" buttons open the registration popup
  list.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-event-id]');
    if (!btn) return;
    var ev = DATA.events.find(function (x) { return x.id === btn.getAttribute('data-event-id'); });
    if (!ev) return;
    $('#regEventId').value = ev.id;
    $('#regEventTitle').textContent = ev.title;
    $('#eventRegForm').hidden = false;
    $('#regSuccess').hidden = true;
    $('#eventRegForm').reset();
    clearFormErrors($('#eventRegForm'));
    openModal('eventRegModal');
  });

  var regForm = $('#eventRegForm');
  if (regForm) regForm.addEventListener('submit', handleEventRegistration);
}

function handleEventRegistration(e) {
  e.preventDefault();
  var form = e.target;
  clearFormErrors(form);

  var name = fieldValue('regName');
  var roll = fieldValue('regRoll');
  var email = fieldValue('regEmail');
  var ok = true;

  if (name.length < 3) { showError('regName', 'Please enter your full name (min 3 letters).'); ok = false; }
  if (roll.length < 2) { showError('regRoll', 'Enter your roll number or course & year.'); ok = false; }
  if (!isValidEmail(email)) { showError('regEmail', 'Enter a valid email address.'); ok = false; }
  if (!ok) return;

  var eventId = fieldValue('regEventId');
  var ev = DATA.events.find(function (x) { return x.id === eventId; });
  var passId = makeRef('PASS');
  var record = {
    passId: passId,
    eventId: eventId,
    eventTitle: ev ? ev.title : eventId,
    name: name,
    rollOrCourse: roll,
    email: email,
    createdAt: new Date().toISOString()
  };

  var records = getRecords();
  records.registrations.push(record);
  saveRecords(records);
  sendToEndpoint('event-registration', record);

  $('#passCode').textContent = passId;
  $('#passEvent').textContent = record.eventTitle;
  form.hidden = true;
  $('#regSuccess').hidden = false;
}

/* ---------- 13. MODALS (open / close) ---------- */

function openModal(id) {
  var modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  var modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

function initModalControls() {
  // Buttons with data-close="modalId" close that modal
  document.addEventListener('click', function (e) {
    var closeBtn = e.target.closest('[data-close]');
    if (closeBtn) { closeModal(closeBtn.getAttribute('data-close')); return; }
    // Clicking the dark background (not the white box) also closes it
    if (e.target.classList && e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
    }
  });

  // Keyboard: Esc closes, arrow keys move through photos
  document.addEventListener('keydown', function (e) {
    var lightbox = document.getElementById('lightbox');
    if (e.key === 'Escape') {
      $$('.modal-overlay.open').forEach(function (m) { m.classList.remove('open'); });
    }
    if (lightbox && lightbox.classList.contains('open')) {
      if (e.key === 'ArrowRight') changeLightbox(1);
      if (e.key === 'ArrowLeft') changeLightbox(-1);
    }
  });

  var prev = $('#lbPrev');
  var next = $('#lbNext');
  if (prev) prev.addEventListener('click', function () { changeLightbox(-1); });
  if (next) next.addEventListener('click', function () { changeLightbox(1); });
}

/* ---------- 14. FORM VALIDATION HELPERS ---------- */

function fieldValue(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

// Indian mobile: 10 digits, starts with 6, 7, 8 or 9
function isValidMobile(value) {
  return /^[6-9]\d{9}$/.test(value);
}

// Shows a red message under a field and highlights it
function showError(fieldId, message) {
  var field = document.getElementById(fieldId);
  var msg = document.getElementById('err_' + fieldId);
  if (field) field.classList.add('input-error');
  if (msg) msg.textContent = message;
}

// Removes all red error messages from a form
function clearFormErrors(form) {
  if (!form) return;
  $$('.input-error', form).forEach(function (el) { el.classList.remove('input-error'); });
  $$('.error-msg', form).forEach(function (el) { el.textContent = ''; });
}

// Shows a success or error box at the top of a form
function showAlert(id, type, message) {
  var box = document.getElementById(id);
  if (!box) return;
  box.className = 'alert-box alert-' + type;
  box.textContent = message;
  box.hidden = false;
}

/* ---------- 15. ADMISSIONS PAGE: FORM, TRACKING & ENQUIRY ---------- */

function renderAdmissionPage() {
  var form = $('#admissionForm');
  var contactForm = $('#contactForm');
  var trackForm = $('#trackForm');
  var stepsBox = $('#admissionSteps');
  var docsBox = $('#documentList');

  if (stepsBox) {
    stepsBox.innerHTML = DATA.admissionSteps.map(function (s, i) {
      return '<article class="step-card"><div class="step-num">' + (i + 1) + '</div>' +
        '<h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></article>';
    }).join('');
  }
  if (docsBox) {
    docsBox.innerHTML = DATA.documents.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('');
  }

  if (form) {
    // Fill the course dropdown from the data file
    var courseSel = $('#a_course');
    courseSel.innerHTML = '<option value="">-- Select Program --</option>' +
      DATA.courses.map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
      }).join('');

    // ?course=btech-cse in the URL pre-selects the program
    var preset = new URLSearchParams(window.location.search).get('course');
    if (preset) courseSel.value = preset;

    // Admissions can be closed from the admin panel
    if (DATA.settings.admissionsOpen === false) {
      showAlert('admissionAlert', 'info', 'Online admissions are currently closed. Please contact the admission office.');
      $$('input, select, textarea, button', form).forEach(function (el) { el.disabled = true; });
    }

    form.addEventListener('submit', handleAdmissionSubmit);

    // "Submit another" shows the empty form again
    var again = $('#applyAnother');
    if (again) {
      again.addEventListener('click', function () {
        $('#admissionSuccess').hidden = true;
        form.hidden = false;
        form.reset();
        clearFormErrors(form);
        if (preset) courseSel.value = preset;
      });
    }

    // Reset button clears the course pre-selection too
    form.addEventListener('reset', function () {
      setTimeout(function () {
        clearFormErrors(form);
        if (preset) courseSel.value = preset;
      }, 0);
    });
  }

  if (contactForm) contactForm.addEventListener('submit', handleContactSubmit);
  if (trackForm) trackForm.addEventListener('submit', handleTrackSubmit);
}

function handleAdmissionSubmit(e) {
  e.preventDefault();
  var form = e.target;
  clearFormErrors(form);
  var ok = true;

  var name = fieldValue('a_name');
  var email = fieldValue('a_email');
  var mobile = fieldValue('a_mobile').replace(/[\s-]/g, '');
  var dob = fieldValue('a_dob');
  var courseId = fieldValue('a_course');
  var marks = parseFloat(fieldValue('a_marks'));
  var city = fieldValue('a_city');
  var consent = document.getElementById('a_consent').checked;

  if (name.length < 3) { showError('a_name', 'Name must be at least 3 characters.'); ok = false; }
  if (!isValidEmail(email)) { showError('a_email', 'Enter a valid email address (e.g. name@mail.com).'); ok = false; }
  if (!isValidMobile(mobile)) { showError('a_mobile', 'Enter a valid 10-digit mobile number.'); ok = false; }
  if (!dob || new Date(dob) > new Date()) { showError('a_dob', 'Select a valid date of birth.'); ok = false; }
  if (!courseId) { showError('a_course', 'Please select a program.'); ok = false; }
  if (isNaN(marks) || marks < 0 || marks > 100) { showError('a_marks', 'Enter marks between 0 and 100.'); ok = false; }
  if (city.length < 2) { showError('a_city', 'Enter your city and state.'); ok = false; }
  if (!consent) { showAlert('admissionAlert', 'error', 'Please tick the consent box to continue.'); ok = false; }
  if (!ok) return;

  var course = DATA.courses.find(function (c) { return c.id === courseId; });
  var gender = (form.querySelector('input[name="a_gender"]:checked') || {}).value || 'Not specified';
  var record = {
    ref: makeRef('AXIS'),
    name: name,
    email: email,
    mobile: mobile,
    dob: dob,
    courseId: courseId,
    courseName: course ? course.name : courseId,
    marks: marks,
    gender: gender,
    city: city,
    message: fieldValue('a_message'),
    status: 'Pending',
    createdAt: new Date().toISOString()
  };

  var records = getRecords();
  records.applications.push(record);
  if (!saveRecords(records)) {
    showAlert('admissionAlert', 'error', 'Browser storage is full. Please clear some site data and try again.');
    return;
  }
  sendToEndpoint('admission-application', record);

  $('#refId').textContent = record.ref;
  $('#refCourse').textContent = record.courseName;
  $('#admissionAlert').hidden = true;
  form.hidden = true;
  $('#admissionSuccess').hidden = false;
  $('#trackRef').value = record.ref;
  $('#trackMobile').value = record.mobile;
}

function handleContactSubmit(e) {
  e.preventDefault();
  var form = e.target;
  clearFormErrors(form);
  var name = fieldValue('c_name');
  var email = fieldValue('c_email');
  var message = fieldValue('c_message');
  var ok = true;

  if (name.length < 3) { showError('c_name', 'Please enter your name.'); ok = false; }
  if (!isValidEmail(email)) { showError('c_email', 'Enter a valid email address.'); ok = false; }
  if (message.length < 10) { showError('c_message', 'Message should be at least 10 characters.'); ok = false; }
  if (!ok) return;

  var record = {
    ref: makeRef('ENQ'),
    name: name,
    email: email,
    phone: fieldValue('c_phone'),
    subject: fieldValue('c_subject'),
    message: message,
    createdAt: new Date().toISOString()
  };
  var records = getRecords();
  records.messages.push(record);
  saveRecords(records);
  sendToEndpoint('contact-enquiry', record);

  form.reset();
  showAlert('contactAlert', 'success', 'Thank you! Your enquiry ' + record.ref + ' has been received. Our team will reply soon.');
}

function handleTrackSubmit(e) {
  e.preventDefault();
  var ref = fieldValue('trackRef').toUpperCase();
  var mobile = fieldValue('trackMobile').replace(/[\s-]/g, '');
  var box = $('#trackResult');
  var found = getRecords().applications.find(function (a) {
    return a.ref === ref && a.mobile === mobile;
  });

  if (!found) {
    box.innerHTML = '<div class="alert-box alert-error">No application found with this reference number and mobile number in this browser.</div>';
    return;
  }
  var statusClass = 'status-' + String(found.status).toLowerCase();
  box.innerHTML = '<div class="alert-box alert-info">' +
    '<strong>' + esc(found.name) + '</strong> — ' + esc(found.courseName) + '<br>' +
    'Reference: <strong>' + esc(found.ref) + '</strong><br>' +
    'Status: <span class="status-badge ' + statusClass + '">' + esc(found.status) + '</span></div>';
}

/* ---------- 16. START EVERYTHING WHEN THE PAGE IS READY ---------- */

document.addEventListener('DOMContentLoaded', function () {
  renderLayout();          // top bar, header, footer
  applyBindings();         // data-bind text on any page
  initMobileNavbar();
  initTopTicker();

  renderStats();           // home
  renderNotices();
  renderFeaturedPrograms();
  renderFacilities();
  renderRecruiters();
  renderTestimonials();

  renderColleges();        // about
  renderFaqs();

  renderCourses();         // courses
  renderFeeCalculator();

  renderGallery();         // campus
  renderEvents();

  renderAdmissionPage();   // admissions
  initModalControls();     // modals, lightbox & Esc key
});

// Other scripts (admin.js) can use these helpers through window.AxisSite
window.AxisSite = {
  storageKeys: { content: STORAGE_CONTENT, records: STORAGE_RECORDS },
  defaults: window.AXIS_DATA,
  getContent: loadContent,
  saveContent: function (content) { return writeJSON(STORAGE_CONTENT, content); },
  resetContent: function () { try { localStorage.removeItem(STORAGE_CONTENT); } catch (e) { /* ignore */ } },
  getRecords: getRecords,
  saveRecords: saveRecords,
  esc: esc,
  money: money,
  isValidEmail: isValidEmail,
  isValidMobile: isValidMobile
};
