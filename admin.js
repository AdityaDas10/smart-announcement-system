// admin.js — Smart Campus Admin Panel

// ── Firebase init ─────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db  = firebase.database();
const ref = db.ref('announcements');

// ── State ─────────────────────────────────────────────────
let editingKey = null;

// ── Connection status dot ─────────────────────────────────
db.ref('.info/connected').on('value', snap => {
  const dot = document.getElementById('status-dot');
  if (snap.val()) {
    dot.classList.add('connected');
    dot.classList.remove('disconnected');
    dot.title = 'Connected to Firebase';
  } else {
    dot.classList.remove('connected');
    dot.classList.add('disconnected');
    dot.title = 'Disconnected';
  }
});

// ── Character counter ─────────────────────────────────────
document.getElementById('ann-input').addEventListener('input', function () {
  document.getElementById('char-count').textContent =
    this.value.length + ' / 300';
});


// ═══════════════════════════════════════════════════════════
// POST NEW ANNOUNCEMENT
// ═══════════════════════════════════════════════════════════
function postAnnouncement() {
  const text   = document.getElementById('ann-input').value.trim();
  const author = document.getElementById('author-input').value.trim() || 'Admin';
  const target = document.getElementById('target-select').value;

  if (!text) {
    showFeedback('Please enter an announcement.', 'error');
    return;
  }

  const newRef = ref.push();
 newRef.set({
  text:      text,
  author:    author,
  target:    target,   // 🔥 ADD THIS LINE
  timestamp: Date.now(),
}).then(() => {
    document.getElementById('ann-input').value   = '';
    document.getElementById('char-count').textContent = '0 / 300';
    showFeedback('✓ Announcement posted!', 'success');
  }).catch(err => {
    showFeedback('Error: ' + err.message, 'error');
  });
}

function showFeedback(msg, type) {
  const el = document.getElementById('post-feedback');
  el.textContent  = msg;
  el.style.color  = type === 'error' ? '#ff4d4d' : '#00d4a0';
  setTimeout(() => { el.textContent = ''; }, 3000);
}

// Allow Enter key to post (Shift+Enter for newline)
document.getElementById('ann-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    postAnnouncement();
  }
});


// ═══════════════════════════════════════════════════════════
// REAL-TIME LIST
// ═══════════════════════════════════════════════════════════
function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

ref.on('value', snap => {
  const data = snap.val();
  const list = document.getElementById('ann-list');
  const countEl = document.getElementById('ann-count');

  if (!data) {
    list.innerHTML = '<div class="empty-msg">No announcements yet</div>';
    countEl.textContent = '0';
    return;
  }

  const items = Object.entries(data)
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => b.timestamp - a.timestamp);

  countEl.textContent = items.length;

  list.innerHTML = items.map(item => `
    <div class="ann-item">
      <div class="ann-item-text">${item.text}</div>
      <div class="ann-item-meta">
        By ${item.author || 'Admin'} &nbsp;·&nbsp; ${timeAgo(item.timestamp)}
      </div>
      <div class="ann-item-actions">
        <button class="btn-edit"   onclick="openEdit('${item.key}', \`${item.text.replace(/`/g, "'")}\`)">Edit</button>
        <button class="btn-delete" onclick="deleteAnnouncement('${item.key}')">Delete</button>
      </div>
    </div>
  `).join('');
});


// ═══════════════════════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════════════════════
function deleteAnnouncement(key) {
  if (!confirm('Delete this announcement?')) return;
  ref.child(key).remove().catch(err => {
    alert('Error deleting: ' + err.message);
  });
}


// ═══════════════════════════════════════════════════════════
// EDIT MODAL
// ═══════════════════════════════════════════════════════════
function openEdit(key, text) {
  editingKey = key;
  document.getElementById('edit-input').value = text;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  editingKey = null;
  document.getElementById('modal').classList.add('hidden');
}

function saveEdit() {
  const text = document.getElementById('edit-input').value.trim();
  if (!text || !editingKey) return;

  ref.child(editingKey).update({
    text:      text,
    editedAt:  Date.now(),
  }).then(() => {
    closeModal();
  }).catch(err => {
    alert('Error saving: ' + err.message);
  });
}

// Close modal on overlay click
document.getElementById('modal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
