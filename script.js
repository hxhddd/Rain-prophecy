const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const RAINVIEWER_URL = "https://api.rainviewer.com/public/weather-maps.json";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const cities = [
  { name: "กรุงเทพฯ", lat: 13.7563, lon: 100.5018 },
  { name: "เชียงใหม่", lat: 18.7883, lon: 98.9853 },
  { name: "เชียงราย", lat: 19.9105, lon: 99.8406 },
  { name: "ขอนแก่น", lat: 16.4322, lon: 102.8236 },
  { name: "นครราชสีมา", lat: 14.9799, lon: 102.0978 },
  { name: "ชลบุรี", lat: 13.3611, lon: 100.9847 },
  { name: "ภูเก็ต", lat: 7.8804, lon: 98.3923 },
  { name: "หาดใหญ่", lat: 7.0084, lon: 100.4747 },
  { name: "นครศรีธรรมราช", lat: 8.4304, lon: 99.9631 },
  { name: "สุราษฎร์ธานี", lat: 9.1382, lon: 99.3217 }
];

let map;
let selectedMarker = null;
let userMarker = null;
let radarLayer = null;
let currentWeather = null;
let radarVisible = false;

document.addEventListener("DOMContentLoaded", init);

function init() {
  initMap();
  renderCities();
  bindEvents();
  loadCityOverview();
}

function initMap() {
  map = L.map("map", {
    zoomControl: true,
    minZoom: 5,
    maxZoom: 13
  }).setView([15.87, 100.99], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  map.on("click", event => {
    selectLocation(event.latlng.lat, event.latlng.lng, "จุดที่เลือก");
  });
}

function bindEvents() {
  const gpsButtons = [
    document.getElementById("gpsBtn"),
    document.getElementById("gpsBtnBottom")
  ];

  gpsButtons.forEach(btn => {
    if (btn) btn.addEventListener("click", getCurrentLocation);
  });

  const radarBtn = document.getElementById("radarBtn");
  if (radarBtn) radarBtn.addEventListener("click", toggleRadar);

  const simpleBtn = document.getElementById("simpleModeBtn");
  if (simpleBtn) simpleBtn.addEventListener("click", toggleSimpleMode);

  const devBtn = document.getElementById("devBtn");
  if (devBtn) devBtn.addEventListener("click", toggleDevPanel);

  const chatBtn = document.getElementById("chatBtn");
  if (chatBtn) chatBtn.addEventListener("click", handleChat);

  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleChat();
      }
    });
  }

  const geminiBtn = document.getElementById("geminiTestBtn");
  if (geminiBtn) geminiBtn.addEventListener("click", testGemini);

  document.querySelectorAll(".question-btn").forEach(button => {
    button.addEventListener("click", () => {
      const question = button.dataset.question || button.textContent.trim();
      const input = document.getElementById("chatInput");
      if (input) {
        input.value = question;
      }
      handleChat();
    });
  });
}

function renderCities() {
  const container = document.getElementById("cityGrid");
  if (!container) return;

  container.innerHTML = "";

  cities.forEach(city => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "city-card";
    card.dataset.city = city.name;
    card.innerHTML = `
      <strong>${city.name}</strong>
      <div class="city-weather">
        <span class="city-icon">⏳</span>
        <span class="city-temp">--°</span>
      </div>
      <div class="city-meta">กำลังตรวจสอบ...</div>
    `;

    card.addEventListener("click", () => selectLocation(city.lat, city.lon, city.name));
    container.appendChild(card);
  });
}

async function loadCityOverview() {
  for (const city of cities) {
    try {
      const weather = await fetchWeather(city.lat, city.lon);
      updateCityCard(city.name, weather);
    } catch (error) {
      updateCityCardError(city.name);
    }
  }
}

function updateCityCard(cityName, weather) {
  const card = document.querySelector(`.city-card[data-city="${CSS.escape(cityName)}"]`);
  if (!card) return;

  const current = weather.current || {};
  const rainAmount = Number(current.rain || 0);
  const precipitation = Number(current.precipitation || 0);
  const icon = weatherIcon(current?.weather_code, rainAmount, precipitation);
  const status = rainStatusFromAmount(Math.max(rainAmount, precipitation));

  const cityTemp = card.querySelector(".city-temp");
  const cityIcon = card.querySelector(".city-icon");
  const cityMeta = card.querySelector(".city-meta");

  if (cityTemp) cityTemp.textContent = current.temperature_2m != null ? `${Math.round(current.temperature_2m)}°` : "--°";
  if (cityIcon) cityIcon.textContent = icon;
  if (cityMeta) cityMeta.textContent = status.text;
}

function updateCityCardError(cityName) {
  const card = document.querySelector(`.city-card[data-city="${CSS.escape(cityName)}"]`);
  if (!card) return;

  const cityTemp = card.querySelector(".city-temp");
  const cityIcon = card.querySelector(".city-icon");
  const cityMeta = card.querySelector(".city-meta");
  if (cityIcon) cityIcon.textContent = "⚠️";
  if (cityTemp) cityTemp.textContent = "--°";
  if (cityMeta) cityMeta.textContent = "ข้อมูลไม่พร้อม";
}

async function selectLocation(lat, lon, name) {
  if (!map) return;

  map.flyTo([lat, lon], 9, { duration: 0.8 });
  setSelectedMarker(lat, lon);
  setLocationHeader(name, lat, lon);
  setPanelLoading();

  try {
    const weather = await fetchWeather(lat, lon);
    currentWeather = { ...weather, latitude: lat, longitude: lon, name };
    renderWeather(weather, name, lat, lon);
  } catch (error) {
    renderWeatherError(error);
  }
}

function setSelectedMarker(lat, lon) {
  if (selectedMarker) {
    selectedMarker.setLatLng([lat, lon]);
  } else {
    selectedMarker = L.marker([lat, lon]).addTo(map);
  }
}

function setUserMarker(lat, lon) {
  if (userMarker) {
    userMarker.setLatLng([lat, lon]);
  } else {
    userMarker = L.marker([lat, lon]).addTo(map);
  }
  userMarker.bindPopup("📍 ตำแหน่งของฉัน");
}

function setLocationHeader(name, lat, lon) {
  const nameEl = document.getElementById("selectedName");
  const coordsEl = document.getElementById("selectedCoords");

  if (nameEl) nameEl.textContent = name;
  if (coordsEl) coordsEl.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function setPanelLoading() {
  const rainStatus = document.getElementById("rainStatus");
  const recommendation = document.getElementById("recommendation");

  if (rainStatus) rainStatus.textContent = "กำลังตรวจสอบข้อมูลฝน...";
  if (recommendation) recommendation.textContent = "กำลังประเมินสภาพอากาศ...";
}

async function getCurrentLocation() {
  if (!navigator.geolocation) {
    showGpsError("อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง");
    return;
  }

  const btn = document.getElementById("gpsBtn");
  const btnBottom = document.getElementById("gpsBtnBottom");
  const buttons = [btn, btnBottom].filter(Boolean);

  buttons.forEach(el => {
    el.disabled = true;
    el.textContent = "📍 กำลังค้นหาตำแหน่ง...";
  });

  navigator.geolocation.getCurrentPosition(
    async position => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      setUserMarker(lat, lon);
      if (map) map.flyTo([lat, lon], 12, { duration: 0.8 });
      await selectLocation(lat, lon, "ตำแหน่งของฉัน");

      buttons.forEach(el => {
        el.disabled = false;
        el.textContent = "📍 ใช้ตำแหน่งของฉัน";
      });
    },
    error => {
      showGpsError(error);
      buttons.forEach(el => {
        el.disabled = false;
        el.textContent = "📍 ใช้ตำแหน่งของฉัน";
      });
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

function showGpsError(error) {
  const box = document.getElementById("gpsError");
  if (!box) return;

  let message = "ไม่สามารถระบุตำแหน่งได้";
  if (typeof error === "string") message = error;
  else if (error?.code === 1) message = "ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง";
  else if (error?.code === 2) message = "ไม่สามารถระบุตำแหน่งของอุปกรณ์ได้";
  else if (error?.code === 3) message = "การค้นหาตำแหน่งใช้เวลานานเกินไป";

  box.textContent = message;
  box.style.display = "block";

  const rainStatus = document.getElementById("rainStatus");
  if (rainStatus) rainStatus.textContent = "ยังไม่สามารถระบุตำแหน่ง";
}

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m",
    minutely_15: "precipitation,rain",
    hourly: "precipitation_probability,precipitation,temperature_2m",
    forecast_minutely_15: "8",
    forecast_hours: "3",
    timezone: "auto"
  });

  const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`);
  if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
  return response.json();
}

function renderWeather(weather, name, lat, lon) {
  const current = weather.current || {};
  const hourly = weather.hourly || {};
  const rainAmount = Number(current.rain || 0);
  const precipitation = Number(current.precipitation || 0);
  const status = rainStatusFromAmount(Math.max(rainAmount, precipitation));
  const icon = weatherIcon(current.weather_code, rainAmount, precipitation);

  const temperatureEl = document.getElementById("temperature");
  const weatherDescEl = document.getElementById("weatherDescription");
  const weatherIconEl = document.getElementById("weatherIcon");
  const rainStatusEl = document.getElementById("rainStatus");
  const recommendationEl = document.getElementById("recommendation");
  const forecastUpdatedEl = document.getElementById("forecastUpdated");

  if (temperatureEl) temperatureEl.textContent = current.temperature_2m != null ? `${Math.round(current.temperature_2m)}°C` : "--°C";
  if (weatherDescEl) weatherDescEl.textContent = status.text;
  if (weatherIconEl) weatherIconEl.textContent = icon;
  if (rainStatusEl) rainStatusEl.textContent = status.detail;
  if (recommendationEl) recommendationEl.textContent = getRecommendation(status.level);
  if (forecastUpdatedEl) forecastUpdatedEl.textContent = `อัปเดต ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;

  const detailTemp = document.getElementById("detailTemp");
  const detailRain = document.getElementById("detailRain");
  const detailProbability = document.getElementById("detailProbability");
  const detailCloud = document.getElementById("detailCloud");
  const detailWind = document.getElementById("detailWind");
  const detailUpdated = document.getElementById("detailUpdated");

  if (detailTemp) detailTemp.textContent = current.temperature_2m != null ? `${current.temperature_2m.toFixed(1)}°C` : "--";
  if (detailRain) detailRain.textContent = current.rain != null ? `${Number(current.rain).toFixed(1)} mm` : "--";
  if (detailProbability) {
    const probability = Array.isArray(hourly.precipitation_probability) && hourly.precipitation_probability.length
      ? Number(hourly.precipitation_probability[0] || 0)
      : 0;
    detailProbability.textContent = `${Math.round(probability)}%`;
  }
  if (detailCloud) detailCloud.textContent = current.cloud_cover != null ? `${current.cloud_cover}%` : "--";
  if (detailWind) detailWind.textContent = current.wind_speed_10m != null ? `${current.wind_speed_10m.toFixed(1)} km/h` : "--";
  if (detailUpdated) detailUpdated.textContent = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  renderTimeline(weather);
  setLocationHeader(name, lat, lon);
}

function renderWeatherError(error) {
  const rainStatus = document.getElementById("rainStatus");
  const recommendation = document.getElementById("recommendation");
  const gpsError = document.getElementById("gpsError");

  if (rainStatus) rainStatus.textContent = "ไม่สามารถรับข้อมูลสภาพอากาศ";
  if (recommendation) recommendation.textContent = "กรุณาลองใหม่อีกครั้ง";
  if (gpsError) {
    gpsError.textContent = "ไม่สามารถโหลดข้อมูลได้ในขณะนี้";
    gpsError.style.display = "block";
  }

  console.error(error);
}

function renderTimeline(weather) {
  const container = document.getElementById("timeline");
  if (!container) return;

  const precipitation = weather.minutely_15?.precipitation || [];
  const rain = weather.minutely_15?.rain || [];
  const times = weather.minutely_15?.time || [];

  container.innerHTML = "";

  for (let i = 0; i < 4; i++) {
    const firstIndex = i * 2;
    const amount = Number(precipitation[firstIndex] || 0) + Number(precipitation[firstIndex + 1] || 0);
    const rainAmount = Number(rain[firstIndex] || 0) + Number(rain[firstIndex + 1] || 0);
    const total = Math.max(amount, rainAmount);
    const time = times[firstIndex] ? formatTime(times[firstIndex]) : `ช่วง ${i + 1}`;
    const status = rainStatusFromAmount(total);

    const slot = document.createElement("div");
    slot.className = "time-card";
    slot.innerHTML = `
      <div class="time-label">${time}</div>
      <div class="time-icon">${status.icon}</div>
      <div class="time-rain">${formatRainAmount(total)}</div>
      <div class="time-detail">${status.title}</div>
    `;
    container.appendChild(slot);
  }
}

function rainStatusFromAmount(amount) {
  const value = Number(amount || 0);

  if (value >= 1.5) {
    return {
      level: "heavy",
      icon: "🌧️",
      title: "มีฝนค่อนข้างมาก",
      text: "มีแนวโน้มพบฝนในช่วงเวลานี้",
      detail: `ปริมาณฝนที่ตรวจพบประมาณ ${value.toFixed(1)} mm`
    };
  }

  if (value > 0.1) {
    return {
      level: "light",
      icon: "🌦️",
      title: "มีฝนเล็กน้อย",
      text: "อาจพบฝนในช่วงเวลานี้",
      detail: `ปริมาณฝนที่ตรวจพบประมาณ ${value.toFixed(1)} mm`
    };
  }

  return {
    level: "none",
    icon: "☀️",
    title: "ยังไม่พบฝนอย่างมีนัยสำคัญ",
    text: "ยังไม่พบปริมาณฝนที่มีนัยสำคัญ",
    detail: "ข้อมูลปัจจุบันยังไม่พบฝนในปริมาณที่น่าสังเกต"
  };
}

function getRecommendation(level) {
  if (level === "heavy") return "แนะนำ: หากกำลังจะออกไปข้างนอก ค���รเตรียมอุปกรณ์กันฝน";
  if (level === "light") return "แนะนำ: ควรเตรียมร่มไว้ หากต้องออกไปข้างนอก";
  return "แนะนำ: จากข้อมูลฝนล่าสุด ยังไม่พบสัญญาณฝนที่น่าสังเกต";
}

function weatherIcon(code, rain, precipitation) {
  if (Number(rain) > 0 || Number(precipitation) > 0) return "🌧️";

  const weatherCode = Number(code || 0);
  if ([1, 2, 3].includes(weatherCode)) return "⛅";
  if ([45, 48].includes(weatherCode)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return "🌦️";
  if ([61, 63, 65, 66, 67].includes(weatherCode)) return "🌧️";
  if ([71, 73, 75, 77].includes(weatherCode)) return "🌨️";
  if ([80, 81, 82].includes(weatherCode)) return "🌦️";
  if ([95, 96, 99].includes(weatherCode)) return "⛈️";
  return "☀️";
}

function formatRainAmount(amount) {
  const value = Number(amount || 0);
  if (value <= 0) return "ไม่มีฝน";
  return `${value.toFixed(1)} mm`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

async function toggleRadar() {
  if (radarVisible) {
    if (radarLayer) map.removeLayer(radarLayer);
    radarLayer = null;
    radarVisible = false;
    const btn = document.getElementById("radarBtn");
    if (btn) btn.textContent = "🌧️ เรดาร์";
    return;
  }

  const btn = document.getElementById("radarBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "🌧️ กำลังโหลด...";
  }

  try {
    const response = await fetch(RAINVIEWER_URL);
    if (!response.ok) throw new Error("Radar API error");

    const data = await response.json();
    const frames = data.radar?.past || [];
    if (!frames.length) throw new Error("No radar frames available");

    const frame = frames[frames.length - 1];
    const host = data.host || "https://tilecache.rainviewer.com";
    const tileUrl = `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;

    radarLayer = L.tileLayer(tileUrl, {
      opacity: 0.65,
      tileSize: 256,
      maxZoom: 12,
      attribution: "RainViewer"
    });

    radarLayer.addTo(map);
    radarVisible = true;
    if (btn) btn.textContent = "🌧️ ปิดเรดาร์";
  } catch (error) {
    console.error(error);
    if (btn) btn.textContent = "🌧️ เรดาร์";
    alert("ไม่สามารถโหลดข้อมูลเรดาร์ได้ในขณะนี้");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function toggleSimpleMode() {
  document.body.classList.toggle("simple-mode");
  const btn = document.getElementById("simpleModeBtn");
  if (btn) {
    btn.textContent = document.body.classList.contains("simple-mode") ? "ปิดอ่านง่าย" : "อ่านง่าย";
  }
}

function toggleDevPanel() {
  const panel = document.getElementById("devPanel");
  if (!panel) return;
  panel.classList.toggle("open");
}

function handleChat() {
  const input = document.getElementById("chatInput");
  const output = document.getElementById("chatAnswer");
  if (!input || !output) return;

  const question = input.value.trim();
  if (!question) return;

  const answer = answerLocalQuestion(question);
  output.textContent = answer;
  input.value = "";
}

function answerLocalQuestion(question) {
  if (!currentWeather) {
    return "กรุณาเลือกตำแหน่งหรือกดปุ่มตำแหน่งของฉันก่อน";
  }

  const weather = currentWeather;
  const current = weather.current || {};
  const rain = Math.max(Number(current.rain || 0), Number(current.precipitation || 0));
  const status = rainStatusFromAmount(rain);
  const lower = question.toLowerCase();

  if (lower.includes("ฝน") && (lower.includes("ตกเมื่อไหร่") || lower.includes("เมื่อไหร่"))) {
    return buildRainTimingAnswer(weather);
  }

  if (lower.includes("ออกจากบ้าน") || lower.includes("ออกไป") || lower.includes("ไปข้างนอก")) {
    return getRecommendation(status.level);
  }

  if (lower.includes("ตอนนี้") || lower.includes("อากาศ")) {
    const temp = current.temperature_2m != null ? `${Math.round(current.temperature_2m)}°C` : "ไม่ทราบอุณหภูมิ";
    return `ตอนนี้ ${weather.name} อุณหภูมิประมาณ ${temp} และ${status.text}`;
  }

  return `ตอนนี้ ${weather.name} ${status.text} ${getRecommendation(status.level)}`;
}

function buildRainTimingAnswer(weather) {
  const precipitation = weather.minutely_15?.precipitation || [];
  const rain = weather.minutely_15?.rain || [];
  const times = weather.minutely_15?.time || [];

  for (let i = 0; i < 4; i++) {
    const firstIndex = i * 2;
    const amount = Number(precipitation[firstIndex] || 0) + Number(precipitation[firstIndex + 1] || 0);
    const rainAmount = Number(rain[firstIndex] || 0) + Number(rain[firstIndex + 1] || 0);
    const total = Math.max(amount, rainAmount);

    if (total > 0.1) {
      const time = times[firstIndex] ? formatTime(times[firstIndex]) : "ช่วงถัดไป";
      return `จากข้อมูลที่ได้รับ มีสัญญาณฝนในช่วงประมาณ ${time} เป็นต้นไป`;
    }
  }

  return "จากข้อมูลฝนล่วงหน้า 2 ชั่วโมงที่ได้รับ ยังไม่พบช่วงที่มีฝนอย่างมีนัยสำคัญ";
}

async function testGemini() {
  const keyInput = document.getElementById("geminiKey");
  const promptInput = document.getElementById("devPrompt");
  const responseElement = document.getElementById("devResponse");
  const button = document.getElementById("geminiTestBtn");

  if (!keyInput || !promptInput || !responseElement) return;

  const apiKey = keyInput.value.trim();
  const userPrompt = promptInput.value.trim();

  if (!apiKey) {
    responseElement.textContent = "กรุณาใส่ API Key สำหรับการทดสอบ";
    return;
  }

  if (!userPrompt) {
    responseElement.textContent = "กรุณาใส่คำถามหรือ Prompt";
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "กำลังทดสอบ...";
  }

  responseElement.textContent = "กำลังส่งคำขอ...";

  try {
    const weatherContext = currentWeather
      ? JSON.stringify({
          location: currentWeather.name,
          latitude: currentWeather.latitude,
          longitude: currentWeather.longitude,
          current: currentWeather.current,
          minutely_15: currentWeather.minutely_15,
          hourly: currentWeather.hourly
        })
      : "ยังไม่มีข้อมูลสภาพอากาศ";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
      contents: [{
        role: "user",
        parts: [{
          text: `คุณกำลังช่วยตอบคำถามเกี่ยวกับสภาพอากาศ\n\nใช้เฉพาะข้อมูลสภาพอากาศที่ได้รับด้านล่างเท่านั้น ห้ามสร้างข้อมูลสภาพอากาศขึ้นมาเอง และหากข้อมูลไม่เพียงพอให้บอกว่าไม่เพียงพอ\n\nข้อมูลสภาพอากาศ:\n${weatherContext}\n\nคำถาม:\n${userPrompt}\n\nตอบเป็นภาษาไทยแบบสั้น กระชับ และเข้าใจง่าย`
        }]
      }]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Request failed: ${response.status}`);

    const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "ไม่ได้รับข้อความตอบกลับ";
    responseElement.textContent = text;
  } catch (error) {
    console.error(error);
    responseElement.textContent = `เกิดข้อผิดพลาด: ${error.message}`;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "ทดสอบ Gemini";
    }
  }
}
