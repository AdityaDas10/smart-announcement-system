// display.js — Smart Campus Display Panel (with Carousel)

// ── Firebase ──────────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const DISPLAY_GROUP = "CSE"; // change per device
let voiceEnabled = false;
let lastUpdateTime = Date.now();

document.addEventListener('click', () => {
  voiceEnabled = true;
}, { once: true });

// ── ThingSpeak ────────────────────────────────────────────
const TS_CHANNEL_ID = "3332831";
const TS_READ_KEY   = "PSHTRPA2UHYDLTTY";

// ── OpenWeatherMap ────────────────────────────────────────
const OWM_API_KEY = "5b146a579bcabefe2bf82ca22d301fd3";
const OWM_CITY    = "Kozhikode,IN";

// ── Carousel state ────────────────────────────────────────
let slides         = [];        // array of announcement objects
let currentIndex   = 0;
let autoTimer      = null;
let progressTimer  = null;
let knownKeys      = new Set();
let isFirstLoad    = true;

const AUTO_DELAY   = 5000;      // 5 seconds per slide

// ── SMART DISPLAY FUNCTIONS ───────────────────────────────

function setIdleMode() {
  document.body.style.filter = "brightness(0.5)";
}

function setActiveMode() {
  document.body.style.filter = "brightness(1)";
}

function wakeEffect() {
  document.body.classList.add("wake");
  setTimeout(() => document.body.classList.remove("wake"), 600);
}

// idle checker
setInterval(() => {
  if (Date.now() - lastUpdateTime > 30000) {
    setIdleMode();
  }
}, 10000);

// ── Touch state ───────────────────────────────────────────
let touchStartX  = 0;
let touchStartY  = 0;
let isDragging   = false;


// ═══════════════════════════════════════════════════════════
// 1. CLOCK
// ═══════════════════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  document.getElementById('time').innerText =
    now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  document.getElementById('date').innerText = now.toDateString();
}
updateClock();
setInterval(updateClock, 1000);


// ═══════════════════════════════════════════════════════════
// 2. WEATHER
// ═══════════════════════════════════════════════════════════
const weatherIcons = {
  '01d':'☀️','01n':'🌙','02d':'⛅','02n':'⛅','03d':'☁️','03n':'☁️',
  '04d':'☁️','04n':'☁️','09d':'🌧','09n':'🌧','10d':'🌦','10n':'🌦',
  '11d':'⛈','11n':'⛈','13d':'❄️','13n':'❄️','50d':'🌫','50n':'🌫',
};

async function getWeather() {
  try {
    const res  = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${OWM_CITY}&appid=${OWM_API_KEY}&units=metric`
    );
    const data = await res.json();
    if (data.cod !== 200) throw new Error();
    const icon = weatherIcons[data.weather[0].icon] || '🌡';
    document.getElementById('weather').innerHTML =
      `${icon} ${Math.round(data.main.temp)}°C &nbsp;·&nbsp; ${data.weather[0].description}<br>
       <span style="font-size:13px;opacity:0.7">
         💧${data.main.humidity}% &nbsp; 💨${Math.round(data.wind.speed * 3.6)}km/h
       </span>`;
  } catch {
    document.getElementById('weather').innerText = 'Weather unavailable';
  }
}
getWeather();
setInterval(getWeather, 10 * 60 * 1000);


// ═══════════════════════════════════════════════════════════
// 3. CAROUSEL — CORE
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

function buildSlides(items) {
  const track = document.getElementById('carousel-track');
  const dots   = document.getElementById('carousel-dots');

  if (items.length === 0) {
    track.innerHTML = `<div class="empty-slide">No announcements yet</div>`;
    dots.innerHTML  = '';
    document.getElementById('announce-count').textContent = '0';
    document.getElementById('carousel-pos').textContent   = '';
    return;
  }

  document.getElementById('announce-count').textContent = items.length;

  track.innerHTML = items.map((item, i) => `
    <div class="carousel-slide ${!knownKeys.has(item.key) && !isFirstLoad ? 'new-slide' : ''}"
         data-index="${i}">
      <div class="slide-number">ANNOUNCEMENT ${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}</div>
      <div class="slide-text">${item.text}</div>
      <div class="slide-meta">
        Posted by ${item.author || 'Admin'} &nbsp;·&nbsp; ${timeAgo(item.timestamp)}
      </div>
    </div>
  `).join('');

  dots.innerHTML = items.map((_, i) => `
    <div class="carousel-dot ${i === currentIndex ? 'active' : ''}"
         onclick="goToSlide(${i})"></div>
  `).join('');

  // Attach touch events to each slide
  document.querySelectorAll('.carousel-slide').forEach(slide => {
    slide.addEventListener('touchstart', onTouchStart, { passive: true });
    slide.addEventListener('touchend',   onTouchEnd,   { passive: true });
    slide.addEventListener('mousedown',  onMouseDown);
    slide.addEventListener('mouseup',    onMouseUp);
  });

  goToSlide(currentIndex, false);
}

function goToSlide(index, animate = true) {
  const track = document.getElementById('carousel-track');
  const allSlides = document.querySelectorAll('.carousel-slide');

  if (allSlides.length === 0) return;

  // Clamp index
  currentIndex = Math.max(0, Math.min(index, allSlides.length - 1));

  // Move track
  if (!animate) track.style.transition = 'none';
  track.style.transform = `translateX(-${currentIndex * 100}%)`;
  if (!animate) requestAnimationFrame(() => { track.style.transition = ''; });

  // Update dots
  document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
  });

  // Update position label
  document.getElementById('carousel-pos').textContent =
    allSlides.length > 0 ? `${currentIndex + 1} / ${allSlides.length}` : '';

  // Update arrow opacity
  document.getElementById('arr-left').classList.toggle('faded',  currentIndex === 0);
  document.getElementById('arr-right').classList.toggle('faded', currentIndex === allSlides.length - 1);

  // Restart auto-advance
  restartAutoAdvance();
}

function nextSlide() {
  const total = document.querySelectorAll('.carousel-slide').length;
  goToSlide(currentIndex < total - 1 ? currentIndex + 1 : 0);
}

function prevSlide() {
  const total = document.querySelectorAll('.carousel-slide').length;
  goToSlide(currentIndex > 0 ? currentIndex - 1 : total - 1);
}

// ── Auto-advance with progress bar ────────────────────────
function restartAutoAdvance() {
  clearInterval(autoTimer);
  clearInterval(progressTimer);

  const bar = document.querySelector('.progress-bar');
  if (bar) {
    bar.style.transition = 'none';
    bar.style.width      = '0%';
    requestAnimationFrame(() => {
      bar.style.transition = `width ${AUTO_DELAY}ms linear`;
      bar.style.width      = '100%';
    });
  }

  autoTimer = setTimeout(() => {
    nextSlide();
  }, AUTO_DELAY);
}


// ═══════════════════════════════════════════════════════════
// 4. TOUCH + MOUSE SWIPE
// ═══════════════════════════════════════════════════════════
function onTouchStart(e) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}

function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
    dx < 0 ? nextSlide() : prevSlide();
  }
}

function onMouseDown(e) {
  touchStartX = e.clientX;
  isDragging  = true;
}

function onMouseUp(e) {
  if (!isDragging) return;
  isDragging = false;
  const dx = e.clientX - touchStartX;
  if (Math.abs(dx) > 40) {
    dx < 0 ? nextSlide() : prevSlide();
  }
}

// Keyboard arrow support
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') nextSlide();
  if (e.key === 'ArrowLeft')  prevSlide();
});


// ═══════════════════════════════════════════════════════════
// 5. FIREBASE — REAL-TIME ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════
db.ref('announcements').on('value', snap => {
  const data  = snap.val();
  const items = data
  ? Object.entries(data)
      .map(([key, val]) => ({ key, ...val }))
      .filter(item => item.target === "ALL" || item.target === DISPLAY_GROUP) // ✅ ADD THIS LINE
      .sort((a, b) => b.timestamp - a.timestamp)
  : [];

  // Voice for new items
  if (!isFirstLoad) {
    items.forEach(item => {
      if (!knownKeys.has(item.key)) {
        lastUpdateTime = Date.now();
        setActiveMode();
        wakeEffect();
        speakAnnouncement(item.text);
        // Jump to the new slide (it'll be at index 0 since sorted newest first)
        currentIndex = 0;
      }
    });
  }

  items.forEach(item => knownKeys.add(item.key));

  buildSlides(items);
  isFirstLoad = false;
});


// ═══════════════════════════════════════════════════════════
// 6. VOICE
// ═══════════════════════════════════════════════════════════
function speakAnnouncement(text) {
  const indicator = document.getElementById('voice-indicator');
  indicator.classList.remove('hidden');

  const utterance = new SpeechSynthesisUtterance(
    'New announcement: ' + text.replace(/[^\w\s.,!?]/g, '')
  );
  utterance.rate   = 0.9;
  utterance.pitch  = 1;
  utterance.volume = 1;
  utterance.lang   = 'en-IN';
  utterance.onend  = () => indicator.classList.add('hidden');

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}


// ═══════════════════════════════════════════════════════════
// 7. THINGSPEAK — SENSORS
// ═══════════════════════════════════════════════════════════
function getStatusInfo(type, val) {
  val = parseFloat(val);
  if (type === 'temp') {
    if (val < 18) return ['s-warn', 'Too Cold'];
    if (val > 35) return ['s-bad',  'Too Hot'];
    return ['s-good', 'Comfortable'];
  }
  if (type === 'hum') {
    if (val < 30) return ['s-warn', 'Low'];
    if (val > 70) return ['s-bad',  'High'];
    return ['s-good', 'Normal'];
  }
  if (type === 'aqi') {
    if (val < 50)  return ['s-good', 'Good'];
    if (val < 100) return ['s-warn', 'Moderate'];
    return ['s-bad', 'Unhealthy'];
  }
  return ['s-good', ''];
}

function updateSensorCard(id, value, type) {
  const el  = document.getElementById(id);
  const sta = document.getElementById(id + '-status');
  if (!el) return;
  el.innerText = parseFloat(value).toFixed(type === 'aqi' ? 0 : 1);
  const [cls, label] = getStatusInfo(type, value);
  sta.className = 'sensor-status ' + cls;
  sta.innerText = label;
}

async function fetchSensorData() {
  try {
    const url =
      `https://api.thingspeak.com/channels/${TS_CHANNEL_ID}/feeds.json` +
      `?api_key=${TS_READ_KEY}&results=1`;
    const res   = await fetch(url);
    const data  = await res.json();
    const feeds = data.feeds || [];
    if (feeds.length === 0) return;

    const f = feeds[feeds.length - 1];
    updateSensorCard('temp', f.field1 || 0, 'temp');
    updateSensorCard('hum',  f.field2 || 0, 'hum');
    updateSensorCard('air',  f.field3 || 0, 'aqi');

    document.getElementById('alertBox')
      .classList.toggle('hidden', parseFloat(f.field3) < 100);

    document.getElementById('last-updated').innerText =
      new Date(f.created_at).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
  } catch (err) {
    console.error('ThingSpeak error:', err);
  }
}

fetchSensorData();
setInterval(fetchSensorData, 15000);


// ═══════════════════════════════════════════════════════════
// 8. TIMETABLE
// ═══════════════════════════════════════════════════════════
const timetable = [
  '9:00 AM  — Embedded Systems',
  '11:00 AM — IoT Lab',
  '2:00 PM  — VLSI Design',
];

document.getElementById('timetable').innerHTML =
  timetable.map(t => `<li>${t}</li>`).join('');


// ═══════════════════════════════════════════════════════════
// 9. PARTICLE BACKGROUND
// ═══════════════════════════════════════════════════════════
const canvas = document.getElementById('particles');
const pctx   = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const particles = Array.from({ length: 80 }, () => ({
  x:      Math.random() * canvas.width,
  y:      Math.random() * canvas.height,
  size:   Math.random() * 2,
  speedX: (Math.random() - 0.5) * 0.6,
  speedY: (Math.random() - 0.5) * 0.6,
}));

function animateParticles() {
  pctx.clearRect(0, 0, canvas.width, canvas.height);
  pctx.fillStyle = '#00eaff';
  particles.forEach(p => {
    p.x += p.speedX;
    p.y += p.speedY;
    if (p.x < 0 || p.x > canvas.width)  p.speedX *= -1;
    if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;
    pctx.beginPath();
    pctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    pctx.fill();
  });
  requestAnimationFrame(animateParticles);
}
animateParticles();
