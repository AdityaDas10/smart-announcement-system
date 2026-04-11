
// === SMART DISPLAY ENHANCED VERSION ===

let voiceEnabled = false;
let lastUpdateTime = Date.now();

// Enable voice on first interaction (Chrome/Safari fix)
document.addEventListener('click', () => {
  voiceEnabled = true;
}, { once: true });

// Wake animation
function wakeEffect() {
  document.body.classList.add("wake");
  setTimeout(() => document.body.classList.remove("wake"), 600);
}

// Idle / Active mode
function setIdleMode() {
  document.body.style.filter = "brightness(0.5)";
}

function setActiveMode() {
  document.body.style.filter = "brightness(1)";
}

// Check idle every 10s
setInterval(() => {
  if (Date.now() - lastUpdateTime > 30000) {
    setIdleMode();
  }
}, 10000);

// Voice function
function speakAnnouncement(text) {
  if (!voiceEnabled) return;

  const indicator = document.getElementById("voice-indicator");
  indicator.classList.remove("hidden");

  const utter = new SpeechSynthesisUtterance("New announcement: " + text);
  utter.rate = 0.85;
  utter.pitch = 1;
  utter.lang = "en-IN";

  utter.onend = () => indicator.classList.add("hidden");

  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

// Firebase listener
firebase.database().ref("announcements").on("value", snap => {
  const data = snap.val();
  if (!data) return;

  const items = Object.values(data).sort((a,b)=>b.timestamp-a.timestamp);
  const latest = items[0];

  lastUpdateTime = Date.now();
  setActiveMode();
  wakeEffect();
  speakAnnouncement(latest.text);
});
