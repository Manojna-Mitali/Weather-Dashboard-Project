/* app.js — Modern Weather Dashboard
   - Uses EC2 Flask backend: API_BASE (kept as provided)
   - Tries to fetch RapidAPI key at: GET ${API_BASE}/config/geodb
   - Falls back to local city list if backend doesn't provide RapidAPI key
   - Renders hourly chart (Chart.js), mini-sparkline, hourly carousel
   - Animates SVG gauges (AQI, UV, Feels, Cloud)
   - Dark/light mode persisted in localStorage
*/

/* ================== CONFIG ================== */
const API_BASE = "http://43.204.136.173:5000/api"; // <-- your EC2 Flask API (kept)
const CONFIG_ENDPOINT = `${API_BASE}/config/geodb`; // optional endpoint to return { rapidapiKey: "..." }
const DEFAULT_CITY = "Bhubaneswar";

/* Local fallback city list (used when backend does not return RapidAPI key) */
const CITIES = [
  "Bhubaneswar, Odisha, India", "Bengaluru, Karnataka, India", "Mumbai, Maharashtra, India",
  "Delhi, India", "Kolkata, West Bengal, India", "Chennai, Tamil Nadu, India",
  "Hyderabad, Telangana, India", "Pune, Maharashtra, India", "Jaipur, Rajasthan, India",
  "Lucknow, Uttar Pradesh, India", "Surat, Gujarat, India"
];

/* ================== DOM ================== */
const searchInput = document.getElementById("searchInput");
const autocompleteList = document.getElementById("autocompleteList");
const locBtn = document.getElementById("locBtn");
const refreshBtn = document.getElementById("refreshBtn");
const backTopBtn = document.getElementById("backTopBtn");
const themeSwitch = document.getElementById("themeSwitch");
const hourlyToggleFeels = document.getElementById("toggleFeels");

const locationName = document.getElementById("locationName");
const summaryText = document.getElementById("summaryText");
const mainTemp = document.getElementById("mainTemp");
const feelsLike = document.getElementById("feelsLike");
const mainIcon = document.getElementById("mainIcon");
const keyMetrics = document.getElementById("keyMetrics");
const sunriseShort = document.getElementById("sunriseShort");
const sunsetShort = document.getElementById("sunsetShort");
const aqiShort = document.getElementById("aqiShort");
const currentTempCompact = document.getElementById("currentTempCompact");

const hourlyCarousel = document.getElementById("hourlyCarousel");
const precipRow = document.getElementById("precipRow");

const tempNowSmall = document.getElementById("tempNowSmall");
const tempStatus = document.getElementById("tempStatus");
const feelsDiff = document.getElementById("feelsDiff");
const cloudPct = document.getElementById("cloudPct");
const cloudArc = document.getElementById("cloudArc");
const precipTotal = document.getElementById("precipTotal");
const windSpeed = document.getElementById("windSpeed");
const windDir = document.getElementById("windDir");
const humidityBar = document.getElementById("humidityBar");
const dewPoint = document.getElementById("dewPoint");
const uvIndex = document.getElementById("uvIndex");
const aqiVal = document.getElementById("aqiVal");
const mapFrame = document.getElementById("mapFrame");

/* Chart instances */
let tempChart = null;
let miniTempChart = null;

/* RapidAPI key holder (fetched from backend or empty) */
let RAPIDAPI_KEY = "";

/* ================== CONFIG FETCH (get RapidAPI key from backend) ================== */
async function loadConfigFromBackend() {
  try {
    const res = await fetch(CONFIG_ENDPOINT, { method: "GET" });
    if (!res.ok) throw new Error("No config endpoint or non-200 response");
    const json = await res.json();
    if (json && json.rapidapiKey) {
      RAPIDAPI_KEY = json.rapidapiKey;
      console.log("Loaded RapidAPI key from backend.");
      return;
    }
  } catch (err) {
    console.log("No RapidAPI key from backend — using fallback list.", err.message || err);
  }
  RAPIDAPI_KEY = "";
}

/* ================== GeoDB autocomplete (uses RapidAPI key if available) ================== */
async function geoSearch(q) {
  if (!q) return [];
  // If key present, call GeoDB via RapidAPI
  if (RAPIDAPI_KEY) {
    const url = `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${encodeURIComponent(q)}&limit=6&sort=-population`;
    try {
      const res = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": "wft-geo-db.p.rapidapi.com"
        }
      });
      if (!res.ok) throw new Error("GeoDB returned non-OK");
      const json = await res.json();
      // Format: "City, Region, Country"
      return json.data.map(c => `${c.city}${c.region ? `, ${c.region}` : ""}, ${c.country}`);
    } catch (err) {
      console.warn("GeoDB call failed, falling back to local list.", err.message || err);
      return CITIES.filter(c => c.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
    }
  } else {
    // local fallback
    return CITIES.filter(c => c.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  }
}

/* ================== Autocomplete UI ================== */
let autocompleteTimeout = null;
searchInput.addEventListener("input", (e) => {
  const q = e.target.value.trim();
  clearTimeout(autocompleteTimeout);
  if (!q) return showAutocomplete([]);
  autocompleteTimeout = setTimeout(async () => {
    const matches = await geoSearch(q);
    showAutocomplete(matches);
  }, 140); // debounce
});

function showAutocomplete(list) {
  autocompleteList.innerHTML = "";
  if (!list || !list.length) {
    autocompleteList.style.display = "none";
    return;
  }
  list.forEach(item => {
    const el = document.createElement("div");
    el.className = "autocomplete-item";
    el.textContent = item;
    el.addEventListener("click", () => {
      searchInput.value = item;
      autocompleteList.style.display = "none";
      fetchWeather(item);
    });
    autocompleteList.appendChild(el);
  });
  autocompleteList.style.display = "block";
}

/* Hide when clicking outside */
document.addEventListener("click", (ev) => {
  if (!ev.target.closest(".search-box")) autocompleteList.style.display = "none";
});

/* ================== Theme handling ================== */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  if (themeSwitch) themeSwitch.checked = (theme === "dark");
}
if (themeSwitch) {
  themeSwitch.addEventListener("change", () => applyTheme(themeSwitch.checked ? "dark" : "light"));
}
const savedTheme = localStorage.getItem("theme") || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light");
applyTheme(savedTheme);

/* ================== Navigation behavior ================== */
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    btn.classList.add("active");
    const section = document.getElementById(btn.dataset.section);
    if (section) section.scrollIntoView({ behavior: "smooth" });
  });
});

/* ================== Helpers ================== */
function formatTimeFromUnix(ts) {
  if (!ts) return "—:—";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatHourLabel(ts) {
  const d = new Date((ts || 0) * 1000);
  const h = d.getHours();
  if (h === new Date().getHours()) return "Now";
  return d.toLocaleTimeString([], { hour: 'numeric', hour12: true });
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function mapIconClass(s) {
  if (!s) return "wi wi-day-sunny";
  s = s.toString().toLowerCase();
  if (s.includes("clear") || s.includes("sun")) return "wi wi-day-sunny";
  if (s.includes("cloud")) return "wi wi-cloudy";
  if (s.includes("rain") || s.includes("drizzle")) return "wi wi-rain";
  if (s.includes("snow")) return "wi wi-snow";
  if (s.includes("thunder")) return "wi wi-thunderstorm";
  if (s.includes("fog") || s.includes("mist") || s.includes("haze")) return "wi wi-fog";
  return "wi wi-day-cloudy";
}

/* ================== Fetch weather from backend ================== */
async function fetchWeather(cityOrCoords) {
  try {
    showLoading(true);
    const q = encodeURIComponent(cityOrCoords);
    const url = `${API_BASE}/weather?city=${q}`;
    console.log("Fetching weather:", url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
    const data = await res.json();
    applyWeatherData(data);
  } catch (err) {
    console.error("fetchWeather error:", err);
    alert("Could not fetch weather. Check EC2 backend or city name.");
  } finally {
    showLoading(false);
  }
}

/* ================== Apply data to UI ================== */
function applyWeatherData(data) {
  const current = data.current || {};
  const hourly = data.hourly || [];
  const daily = data.daily || [];
  const suggestion = data.suggestion || "";
  const coords = data.map || {};

  // Summary
  locationName.textContent = data.location || current.location || "Unknown location";
  summaryText.textContent = suggestion || current.summary || current.weather || "";
  mainTemp.textContent = `${Math.round(current.temp ?? 0)}°`;
  currentTempCompact.textContent = `${Math.round(current.temp ?? 0)}°`;
  feelsLike.textContent = `${Math.round(current.feels_like ?? 0)}°`;
  tempNowSmall.textContent = `${Math.round(current.temp ?? 0)}°`;
  tempStatus.textContent = current.trend || "Steady";

  // Icon
  mainIcon.innerHTML = `<i class="${mapIconClass(current.icon || current.weather)}"></i>`;

  // Key metrics
  keyMetrics.innerHTML = "";
  const metrics = [
    { label: "Air Quality", value: data.aqi?.value ?? "—", icon: "fa-solid fa-smog" },
    { label: "Wind", value: `${current.wind ?? "—"} m/s`, icon: "fa-solid fa-wind" },
    { label: "Humidity", value: `${current.humidity ?? "—"}%`, icon: "fa-solid fa-droplet" },
    { label: "Visibility", value: `${current.visibility ?? "—"} km`, icon: "fa-solid fa-eye" },
    { label: "Pressure", value: `${current.pressure ?? "—"} hPa`, icon: "fa-solid fa-tachometer-alt" },
    { label: "Dew Point", value: `${current.dew_point ?? "—"}°`, icon: "fa-solid fa-temperature-quarter" },
  ];
  metrics.forEach(m => {
    const el = document.createElement("div");
    el.className = "metric";
    el.innerHTML = `<i class="${m.icon}"></i><div><div class="m-label">${m.label}</div><div class="m-value">${m.value}</div></div>`;
    keyMetrics.appendChild(el);
  });

  // Sunrise / Sunset / AQI
  sunriseShort.textContent = current.sunrise ? formatTimeFromUnix(current.sunrise) : "—:—";
  sunsetShort.textContent = current.sunset ? formatTimeFromUnix(current.sunset) : "—:—";
  aqiShort.textContent = data.aqi?.value ?? "—";

  // Map iframe
  if (coords.lat && coords.lon) {
    mapFrame.src = `https://www.google.com/maps?q=${coords.lat},${coords.lon}&z=10&output=embed`;
  } else {
    mapFrame.src = "";
  }

  // Hourly + charts
  renderHourly(hourly);
  drawTempChart(hourly);
  drawMiniTempChart(hourly);

  // Details cards
  const feelsDelta = Math.round((current.feels_like ?? 0) - (current.temp ?? 0));
  feelsDiff.textContent = `${feelsDelta > 0 ? "+" : ""}${feelsDelta}°`;
  const cloud = current.clouds ?? 0;
  cloudPct.textContent = `${cloud}%`;
  if (cloudArc) cloudArc.setAttribute("stroke-dasharray", `${cloud}, 100`);
  precipTotal.textContent = `${(current.precipitation ?? 0)} mm`;
  windSpeed.textContent = `${current.wind ?? "—"} m/s`;
  windDir.textContent = current.wind_dir ?? "—";
  humidityBar.style.width = `${current.humidity ?? 0}%`;
  dewPoint.textContent = `${current.dew_point ?? "—"}°`;
  uvIndex.textContent = `${current.uvi ?? "—"}`;
  aqiVal.textContent = `${data.aqi?.value ?? "—"}`;

  // Animate arcs (UV, AQI, Feels)
  const uvArcEl = document.getElementById("uvArc");
  const aqiArcEl = document.getElementById("aqiArc");
  const feelsArcEl = document.getElementById("feelsArc");

  animateArc(uvArcEl, clamp((current.uvi ?? 0) / 11 * 100, 0, 100), getUvColor(current.uvi ?? 0));
  animateArc(aqiArcEl, clamp(((data.aqi?.value ?? 0) / 500) * 100, 0, 100), getAqiColor(data.aqi?.value ?? 0));
  animateArc(feelsArcEl, clamp(Math.abs(feelsDelta) / 15 * 100, 0, 100), feelsDelta >= 0 ? "var(--warn)" : "var(--accent)");

  // Save last searched city
  localStorage.setItem("lastCity", locationName.textContent);
}

/* ================== Hourly rendering ================== */
function renderHourly(hourly) {
  hourlyCarousel.innerHTML = "";
  precipRow.innerHTML = "";

  (hourly || []).slice(0, 24).forEach((h, idx) => {
    const card = document.createElement("div");
    card.className = "hour-card";
    if (idx === 0) card.classList.add("active");
    card.innerHTML = `
      <div class="time">${formatHourLabel(h.dt || h.time)}</div>
      <div class="icon"><i class="${mapIconClass(h.icon || h.weather)}"></i></div>
      <div class="temp">${Math.round(h.temp ?? 0)}°</div>
      <div class="precip-small" style="font-size:12px;color:var(--muted)">${Math.round((h.pop ?? 0) * 100)}%</div>
    `;
    hourlyCarousel.appendChild(card);

    // Precip item below chart
    const p = document.createElement("div");
    p.style.minWidth = "44px";
    p.style.textAlign = "center";
    p.innerHTML = `<div style="font-size:12px">${Math.round((h.pop ?? 0) * 100)}%</div><div style="font-size:18px">💧</div>`;
    precipRow.appendChild(p);
  });

  // enable mouse drag scrolling
  makeScrollable(hourlyCarousel);
}

/* ================== Charts (Chart.js) ================== */
function drawTempChart(hourly) {
  const hours = (hourly || []).slice(0, 24);
  const labels = hours.map(h => formatHourLabel(h.dt || h.time));
  const data = hours.map(h => Math.round(h.temp ?? 0));
  const feels = hours.map(h => Math.round(h.feels_like ?? h.temp ?? 0));

  const ctx = document.getElementById("tempChart").getContext("2d");
  if (tempChart) tempChart.destroy();

  tempChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Temp",
          data,
          fill: true,
          tension: 0.32,
          pointRadius: 2,
          borderWidth: 2,
          backgroundColor: "rgba(37,99,235,0.12)",
          borderColor: "rgba(37,99,235,1)"
        },
        {
          label: "Feels",
          data: feels,
          fill: false,
          tension: 0.32,
          pointRadius: 0,
          borderDash: [4, 4],
          borderColor: "rgba(99,102,241,0.85)",
          borderWidth: 1.5,
          hidden: !hourlyToggleFeels.checked
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(2,6,23,0.04)" } }
      }
    }
  });

  // toggle feels
  hourlyToggleFeels.addEventListener("change", (e) => {
    if (!tempChart) return;
    tempChart.data.datasets[1].hidden = !e.target.checked;
    tempChart.update();
  });
}

function drawMiniTempChart(hourly) {
  const arr = (hourly || []).slice(0, 12);
  const labels = arr.map(it => formatHourLabel(it.dt || it.time));
  const data = arr.map(it => Math.round(it.temp ?? 0));
  const ctx = document.getElementById("miniTempChart").getContext("2d");
  if (miniTempChart) miniTempChart.destroy();
  miniTempChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ data, fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.3, borderColor: "rgba(37,99,235,0.9)" }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
  });
}

/* ================== SVG arc animation & color helpers ================== */
function animateArc(elem, percent, color) {
  if (!elem) return;
  elem.style.stroke = color || "var(--accent)";
  // stroke-dasharray accepts "<value>, 100"
  elem.setAttribute("stroke-dasharray", `${percent}, 100`);
}

function getUvColor(uvi) {
  if (uvi <= 2) return "var(--good)";
  if (uvi <= 5) return "var(--accent-2)";
  if (uvi <= 7) return "var(--warn)";
  return "var(--bad)";
}
function getAqiColor(aqi) {
  if (aqi <= 50) return "var(--good)";
  if (aqi <= 100) return "var(--accent-2)";
  if (aqi <= 200) return "var(--warn)";
  return "var(--bad)";
}

/* ================== Utilities ================== */
function makeScrollable(el) {
  if (!el) return;
  let isDown = false, startX, scrollLeft;
  el.addEventListener('mousedown', (e) => { isDown = true; el.classList.add('active-drag'); startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; });
  el.addEventListener('mouseleave', () => { isDown = false; el.classList.remove('active-drag'); });
  el.addEventListener('mouseup', () => { isDown = false; el.classList.remove('active-drag'); });
  el.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - el.offsetLeft; const walk = (x - startX) * 1.5; el.scrollLeft = scrollLeft - walk; });
}

function showLoading(on) {
  document.body.style.cursor = on ? "wait" : "default";
}

/* ================== Events ================== */
if (locBtn) {
  locBtn.addEventListener("click", () => {
    if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      try {
        showLoading(true);
        // your backend may support lat/lon query, try both
        let res = await fetch(`${API_BASE}/weather?lat=${lat}&lon=${lon}`);
        if (!res.ok) {
          // fallback to text lat,lon param (if backend expects city param only)
          res = await fetch(`${API_BASE}/weather?city=${lat},${lon}`);
        }
        if (!res.ok) throw new Error("Location fetch failed");
        const data = await res.json();
        applyWeatherData(data);
      } catch (err) {
        console.error("locBtn error:", err);
        alert("Unable to fetch weather for current location.");
      } finally {
        showLoading(false);
      }
    }, () => alert("Location access denied or unavailable"));
  });
}

if (refreshBtn) refreshBtn.addEventListener("click", () => { const last = localStorage.getItem("lastCity") || DEFAULT_CITY; fetchWeather(last); });
if (backTopBtn) backTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const q = searchInput.value.trim() || DEFAULT_CITY;
    fetchWeather(q);
    autocompleteList.style.display = "none";
  }
});

/* ================== Init ================== */
(async function init() {
  await loadConfigFromBackend(); // attempt to load RapidAPI key (optional)
  const last = localStorage.getItem("lastCity") || DEFAULT_CITY;
  // pre-fill input with last city for convenience
  searchInput.value = last;
  fetchWeather(last);
})();
