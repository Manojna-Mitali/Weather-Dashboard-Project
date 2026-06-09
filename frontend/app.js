// ======================= CONFIGURATION =========================
const API_BASE = "http://13.203.200.236:5000/api"; // ✅ Your backend endpoint

// ======================= DOM ELEMENTS ===========================
const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");
const unitToggle = document.getElementById("unitToggle");
const suggestionsBox = document.getElementById("suggestions");

const elTemp = document.getElementById("temperature");
const elFeels = document.getElementById("feelsLike");
const elDesc = document.getElementById("weatherDesc");
const elWind = document.getElementById("wind");
const elPressure = document.getElementById("pressure");
const elHumidity = document.getElementById("humidity");
const elPrecip = document.getElementById("precip");
const elSunrise = document.getElementById("sunrise");
const elSunset = document.getElementById("sunset");
const elWeatherIcon = document.getElementById("weatherIcon");
const elTempHigh = document.getElementById("tempHigh");
const elTempLow = document.getElementById("tempLow");
const elDayName = document.getElementById("dayName");
const elDate = document.getElementById("date");
const hourlyEl = document.getElementById("hourlyForecast");
const weeklyEl = document.getElementById("weeklyForecast");
const outsideTextEl = document.getElementById("outsideText");
const outsideEmojiEl = document.getElementById("outsideEmoji");
const dayProgressEl = document.getElementById("dayProgress");
const mapIframe = document.getElementById("map");

let units = "metric";

// ======================= AUTOCOMPLETE ===========================
searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  suggestionsBox.innerHTML = "";
  if (!query) return (suggestionsBox.style.display = "none");

  const matched = cities.filter(c => c.toLowerCase().startsWith(query)).slice(0, 8);
  matched.forEach(city => {
    const div = document.createElement("div");
    div.textContent = city;
    div.classList.add("suggestion-item");
    div.addEventListener("click", () => {
      searchInput.value = city;
      suggestionsBox.innerHTML = "";
      suggestionsBox.style.display = "none";
      getWeather(city);
    });
    suggestionsBox.appendChild(div);
  });
  suggestionsBox.style.display = matched.length ? "block" : "none";
});

// ======================= BACKGROUND LOGIC =======================
function updateBackground(weather, description, temp) {
  const month = new Date().getMonth() + 1;
  const isWinter = month === 12 || month <= 2;

  weather = (weather || "").toLowerCase();
  description = (description || "").toLowerCase();

  let bgImage = "default.jpg";

  // 🌡️ Temperature-sensitive backgrounds FIRST
  if (temp <= -10) {
    bgImage = "freezing.jpg"; // very cold
  } else if (temp > -10 && temp < 15) {
    bgImage = "cold.jpg"; // mild cold
  } else if (temp > 30) {
    bgImage = "hot.jpg"; // summer heat
  }

  // ☁️ Weather-based only if temperature not extreme
  if (temp > 5 && !weather.includes("clear")) {
    if (weather.includes("snow")) {
      bgImage = "snowy.jpg";
    } else if (weather.includes("rain") || description.includes("rain") || description.includes("drizzle")) {
      bgImage = "rainy.jpg";
    } else if (weather.includes("cloud")) {
      bgImage = "cloudy.jpg";
    } else if (description.includes("fog") || description.includes("haze") || description.includes("mist")) {
      bgImage = "foggy.jpg";
    }
  }

  // ❄️ Winter fallback
  if (isWinter && temp < 0 && !weather.includes("rain")) {
    bgImage = "freezing.jpg";
  }

  document.body.style.backgroundImage = `url('${bgImage}')`;
}

// ======================= EMOJI LOGIC ============================
function updateEmoji(weather, description, temp) {
  weather = (weather || "").toLowerCase();
  description = (description || "").toLowerCase();

  if (temp <= 0) return "🥶";
  if (weather.includes("snow")) return "❄️";
  if (weather.includes("rain") || description.includes("drizzle")) return "🌧️";
  if (weather.includes("cloud")) return "☁️";
  if (weather.includes("clear") || description.includes("sun")) return "☀️";
  if (description.includes("mist") || description.includes("fog") || description.includes("haze")) return "🌫️";
  if (weather.includes("thunderstorm")) return "⛈️";
  return "🌤️";
}

// ======================= FETCH WEATHER ==========================
async function getWeather(city) {
  try {
    const res = await fetch(`${API_BASE}/weather?city=${city}`);
    if (!res.ok) throw new Error("Failed to fetch weather data");
    const data = await res.json();
    applyWeatherData(data);
  } catch (err) {
    console.error(err);
    alert("City not found or server error!");
  }
}

// ======================= APPLY WEATHER DATA =====================
function applyWeatherData(data) {
  const current = data.current;
  const hourly = data.hourly;
  const daily = data.daily;

  // Temperature and details
  elTemp.innerText = `${Math.round(current.temp)}°`;
  elFeels.innerText = `Feels like ${Math.round(current.feels_like)}°`;
  elDesc.innerText = current.description || current.weather;
  elWind.innerText = `${current.wind} m/s`;
  elPressure.innerText = `${current.pressure} hPa`;
  elHumidity.innerText = `${current.humidity}%`;
  elPrecip.innerText = "45%";
  elDayName.innerText = current.day;

  // Local time
  const utc = new Date().getTime() + new Date().getTimezoneOffset() * 60000;
  const localTime = new Date(utc + current.timezone * 1000);
  elDate.innerText = `${localTime.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;

  // Weather Icon
  const iconCode = current.icon || "01d";
  elWeatherIcon.innerHTML = `<img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="${current.weather}">`;

  // Background + Emoji
  updateBackground(current.weather, current.description, current.temp);
  outsideEmojiEl.textContent = updateEmoji(current.weather, current.description, current.temp);

  // Suggestion Text (more expressive)
  let suggestionText;
  if (current.temp <= 0) suggestionText = "Brrr 🥶 It's freezing! Stay cozy inside.";
  else if (current.temp > 0 && current.temp <= 10) suggestionText = "Chilly winds today — wrap up warm 🧣";
  else if (current.temp > 10 && current.temp <= 25) suggestionText = "Lovely weather 🌤 — take a stroll or breathe in the air!";
  else if (current.temp > 25 && current.temp <= 35) suggestionText = "Warm and sunny ☀️ — stay hydrated and enjoy your day!";
  else suggestionText = "Hot out there 🥵 — find some shade and keep sipping water!";
  outsideTextEl.innerText = data.suggestion || suggestionText;

  // Localized Sunrise & Sunset
  // ✅ Correct sunrise & sunset conversion
  const sunriseTs = current.sunrise * 1000; // use directly, don't add timezone
  const sunsetTs = current.sunset * 1000;

  elSunrise.innerText = new Date(sunriseTs).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  elSunset.innerText = new Date(sunsetTs).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // keep your daylight progress as-is
  updateDaylightProgress(sunriseTs, sunsetTs);


  // Map
  if (data.map.lat && data.map.lon) {
    mapIframe.src = `https://www.google.com/maps?q=${data.map.lat},${data.map.lon}&z=10&output=embed`;
  }

  // Hourly forecast
  hourlyEl.innerHTML = "";
  hourly.slice(0, 6).forEach((h) => {
    const iconCode = h.icon || "02d";
    const icon = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    const card = `
      <div class="forecast-card">
        <p>${h.time}</p>
        <img src="${icon}" width="50">
        <p>${Math.round(h.temp)}°</p>
      </div>`;
    hourlyEl.innerHTML += card;
  });

  // Weekly forecast
  weeklyEl.innerHTML = "";
  daily.slice(0, 7).forEach((d) => {
    const dayName = new Date(d.date).toLocaleDateString("en-US", { weekday: "short" });
    const iconCode = d.icon || "03d";
    const icon = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    const card = `
      <div class="forecast-card">
        <p>${dayName}</p>
        <img src="${icon}" width="50">
        <p>${Math.round(d.temp_max)}° / ${Math.round(d.temp_min)}°</p>
      </div>`;
    weeklyEl.innerHTML += card;
  });

  // High/Low temps
  elTempHigh.innerText = Math.round(daily[0].temp_max);
  elTempLow.innerText = Math.round(daily[0].temp_min);
}

// ======================= DAYLIGHT PROGRESS ======================
function updateDaylightProgress(sunrise, sunset) {
  const now = new Date().getTime();
  const total = sunset - sunrise;
  const elapsed = now - sunrise;
  const percent = Math.max(0, Math.min(1, elapsed / total));
  dayProgressEl.style.width = `${Math.round(percent * 100)}%`;
  dayProgressEl.title = `${Math.round((1 - percent) * 100)}% daylight remaining`;
}

// ======================= EVENTS ================================
searchBtn.addEventListener("click", () => {
  const city = searchInput.value.trim() || "Bhubaneswar";
  getWeather(city);
});
searchInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") getWeather(searchInput.value.trim() || "Bhubaneswar");
});
unitToggle.addEventListener("change", (e) => {
  units = e.target.value;
  getWeather(searchInput.value || "Bhubaneswar");
});

// ======================= DEFAULT LOAD ===========================
getWeather("Bhubaneswar");
