// ── Firebase ──────────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ✅ Dynamic group (NO HARDCODING)
let DISPLAY_GROUP = localStorage.getItem("group") || "ALL";

// ── Voice unlock ──────────────────────────────────────────
let voiceEnabled = false;
let lastUpdateTime = Date.now();

document.addEventListener('click', () => {
  voiceEnabled = true;
}, { once: true });

// ✅ Change group
function changeGroup(group) {
  DISPLAY_GROUP = group;
  localStorage.setItem("group", group);
  location.reload();
}

// ✅ Set dropdown + label
document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("group-select");
  if (select) select.value = DISPLAY_GROUP;

  const label = document.getElementById("group-name");
  if (label) label.innerText = DISPLAY_GROUP;
});

// ── ThingSpeak ────────────────────────────────────────────
const TS_CHANNEL_ID = "3332831";
const TS_READ_KEY   = "PSHTRPA2UHYDLTTY";

// ── OpenWeatherMap ────────────────────────────────────────
const OWM_API_KEY = "5b146a579bcabefe2bf82ca22d301fd3";
const OWM_CITY    = "Kozhikode,IN";

// ── Carousel state ────────────────────────────────────────
let slides = [];
let currentIndex = 0;
let autoTimer = null;
let knownKeys = new Set();
let isFirstLoad = true;

const AUTO_DELAY = 5000;

// ── SMART DISPLAY ─────────────────────────────────────────
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

setInterval(() => {
  if (Date.now() - lastUpdateTime > 30000) {
    setIdleMode();
  }
}, 10000);

// ═══════════════════════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  document.getElementById('time').innerText =
    now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  document.getElementById('date').innerText = now.toDateString();
}
updateClock();
setInterval(updateClock,1000);

// ═══════════════════════════════════════════════════════════
// WEATHER
// ═══════════════════════════════════════════════════════════
async function getWeather(){
  try{
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${OWM_CITY}&appid=${OWM_API_KEY}&units=metric`);
    const data = await res.json();
    document.getElementById('weather').innerText =
      `${Math.round(data.main.temp)}°C · ${data.weather[0].description}`;
  }catch{
    document.getElementById('weather').innerText='Weather unavailable';
  }
}
getWeather();
setInterval(getWeather,600000);

// ═══════════════════════════════════════════════════════════
// 🔥 TIMETABLE (NEW FEATURE)
// ═══════════════════════════════════════════════════════════
function loadTimetable() {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const today = days[new Date().getDay()];

  const timetableData = {

    Mon: ["9:30 – EOS","10:45 – RC","11:45 – IoT","1:30 – MOOC","2:30 – EOS Lab"],
    Tue: ["9:30 – AML","10:45 – IoT","11:45 – EOS","1:30 – AML","2:30 – AML Lab"],
    Wed: ["9:30 – RC","10:45 – EOS","11:45 – AML","1:30 – RC","2:30 – RC Lab"],
    Thu: ["9:30 – IoT","10:45 – IoT","11:45 – EOS","1:30 – MOOC","2:30 – IoT Lab"],
    Fri: ["9:30 – AML","10:45 – RC","11:45 – Audit","1:30 – MOOC","2:30 – MOOC / Audit"]

  };

  const list = document.getElementById("timetable");

  if (!timetableData[today]) {
    list.innerHTML = "<li>No classes today 🎉</li>";
    return;
  }

  list.innerHTML =
    `<li><strong>${today} Schedule</strong></li>` +
    timetableData[today].map(item => `<li>${item}</li>`).join('');
}

loadTimetable();

// ═══════════════════════════════════════════════════════════
// CAROUSEL
// ═══════════════════════════════════════════════════════════
function buildSlides(items){
  const track=document.getElementById('carousel-track');

  if(items.length===0){
    track.innerHTML='<div class="empty-slide">No announcements</div>';
    return;
  }

  track.innerHTML = items.map(item=>`
    <div class="carousel-slide">
      <div class="slide-text">${item.text}</div>
      <div class="slide-meta">By ${item.author||'Admin'}</div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════
// FIREBASE
// ═══════════════════════════════════════════════════════════
db.ref('announcements').on('value', snap => {
  const data = snap.val();

const items = data
  ? Object.entries(data)
      .map(([key,val]) => ({key,...val}))
      .filter(item => (item.target || "ALL") === "ALL" || item.target === DISPLAY_GROUP)
      .sort((a,b)=>b.timestamp-a.timestamp)
      .slice(0, 5) // ✅ LIMIT TO LAST 5
  : [];

  if (!isFirstLoad) {
    items.forEach(item => {
      if (!knownKeys.has(item.key)) {
        lastUpdateTime = Date.now();
        setActiveMode();
        wakeEffect();
        speakAnnouncement(item.text);
        currentIndex = 0;
      }
    });
  }

  items.forEach(item => knownKeys.add(item.key));

  buildSlides(items);
  isFirstLoad = false;
});

// ═══════════════════════════════════════════════════════════
// VOICE
// ═══════════════════════════════════════════════════════════
function speakAnnouncement(text){
  if(!voiceEnabled) return;

  const indicator=document.getElementById('voice-indicator');
  indicator.classList.remove('hidden');

  const utter=new SpeechSynthesisUtterance("New announcement: "+text);
  utter.rate=0.9;
  utter.lang="en-IN";

  utter.onend=()=>indicator.classList.add('hidden');

  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

// ═══════════════════════════════════════════════════════════
// SENSORS
// ═══════════════════════════════════════════════════════════
async function fetchSensorData(){
  try{
    const res=await fetch(`https://api.thingspeak.com/channels/${TS_CHANNEL_ID}/feeds.json?api_key=${TS_READ_KEY}&results=1`);
    const data=await res.json();
    const f=data.feeds[0];

    document.getElementById('temp').innerText=f.field1||'--';
    document.getElementById('hum').innerText=f.field2||'--';
    document.getElementById('air').innerText=f.field3||'--';

  }catch(e){console.log(e);}
}
fetchSensorData();
setInterval(fetchSensorData,15000);
