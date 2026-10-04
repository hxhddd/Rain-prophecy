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
    zoomControl: true
  }).setView([15.87, 100.99], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  map.on("click", event => {
    selectLocation(
      event.latlng.lat,
      event.latlng.lng,
      "จุดที่เลือก"
    );
  });
}

function bindEvents() {
  const gpsButton = document.getElementById("gpsButton");
  const radarButton = document.getElementById("radarButton");
  const easyButton = document.getElementById("easyButton");
  const devButton = document.getElementById("devButton");
  const chatButton = document.getElementById("chatButton");
  const chatInput = document.getElementById("chatInput");
  const geminiButton = document.getElementById("geminiButton");

  if (gpsButton) {
    gpsButton.addEventListener("click", getCurrentLocation);
  }

  if (radarButton) {
    radarButton.addEventListener("click", toggleRadar);
  }

  if (easyButton) {
    easyButton.addEventListener("click", toggleEasyMode);
  }

  if (devButton) {
    devButton.addEventListener("click", toggleDevPanel);
  }

  if (chatButton) {
    chatButton.addEventListener("click", handleChat);
  }

  if (chatInput) {
    chatInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        handleChat();
      }
    });
  }

  if (geminiButton) {
    geminiButton.addEventListener("click", testGemini);
  }
}

function renderCities() {
  const container = document.getElementById("cityGrid");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  cities.forEach(city => {
    const card = document.createElement("button");
    card.className = "city-card";
    card.type = "button";
    card.dataset.city = city.name;

    card.innerHTML = `
      <div class="city-name">${city.name}</div>
      <div class="city-weather">
        <div class="city-icon">⏳</div>
        <div class="city-temp">--°</div>
      </div>
      <div class="city-rain">กำลังตรวจสอบ...</div>
    `;

    card.addEventListener("click", () => {
      selectLocation(city.lat, city.lon, city.name);
    });

    container.appendChild(card);
  });
}

async function loadCityOverview() {
  const requests = cities.map(async city => {
    try {
      const weather = await fetchWeather(city.lat, city.lon);
      updateCityCard(city.name, weather);
    } catch (error) {
      updateCityCardError(city.name);
    }
  });

  await Promise.all(requests);
}

function updateCityCard(cityName, weather) {
  const card = document.querySelector(
    `.city-card[data-city="${CSS.escape(cityName)}"]`
  );

  if (!card) {
    return;
  }

  const current = weather.current;
  const rainAmount = Number(current?.rain || 0);
  const precipitation = Number(current?.precipitation || 0);

  const icon = weatherIcon(
    current?.weather_code,
    rainAmount,
    precipitation
  );

  const status = rainStatusFromAmount(
    Math.max(rainAmount, precipitation)
  );

  card.querySelector(".city-icon").textContent = icon;
  card.querySelector(".city-temp").textContent =
    current?.temperature_2m != null
      ? `${Math.round(current.temperature_2m)}°`
      : "--°";

  card.querySelector(".city-rain").textContent = status.text;
}

function updateCityCardError(cityName) {
  const card = document.querySelector(
    `.city-card[data-city="${CSS.escape(cityName)}"]`
  );

  if (!card) {
    return;
  }

  card.querySelector(".city-icon").textContent = "⚠️";
  card.querySelector(".city-temp").textContent = "--°";
  card.querySelector(".city-rain").textContent = "ข้อมูลไม่พร้อม";
}

async function selectLocation(lat, lon, name) {
  if (!map) {
    return;
  }

  map.flyTo([lat, lon], 9, {
    duration: 0.8
  });

  setSelectedMarker(lat, lon);

  setLocationHeader(name, lat, lon);
  setPanelLoading();

  try {
    const weather = await fetchWeather(lat, lon);

    currentWeather = {
      ...weather,
      latitude: lat,
      longitude: lon,
      name
    };

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
  const nameElement = document.getElementById("locationName");
  const coordsElement = document.getElementById("locationCoords");

  if (nameElement) {
    nameElement.textContent = name;
  }

  if (coordsElement) {
    coordsElement.textContent =
      `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
}

function setPanelLoading() {
  const statusTitle = document.getElementById("statusTitle");
  const statusText = document.getElementById("statusText");
  const recommendation = document.getElementById("recommendation");

  if (statusTitle) {
    statusTitle.textContent = "กำลังตรวจสอบสภาพอากาศ";
  }

  if (statusText) {
    statusText.textContent = "กำลังรับข้อมูลล่าสุดจากระบบพยากรณ์";
  }

  if (recommendation) {
    recommendation.textContent = "";
  }
}

async function getCurrentLocation() {
  if (!navigator.geolocation) {
    showGpsError("อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง");
    return;
  }

  const button = document.getElementById("gpsButton");

  if (button) {
    button.disabled = true;
    button.textContent = "📍 กำลังค้นหาตำแหน่ง...";
  }

  navigator.geolocation.getCurrentPosition(
    async position => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      setUserMarker(lat, lon);

      if (map) {
        map.flyTo([lat, lon], 12, {
          duration: 0.8
        });
      }

      await selectLocation(
        lat,
        lon,
        "ตำแหน่งของฉัน"
      );

      if (button) {
        button.disabled = false;
        button.textContent = "📍 ตำแหน่งของฉัน";
      }
    },
    error => {
      showGpsError(error);

      if (button) {
        button.disabled = false;
        button.textContent = "📍 ตำแหน่งของฉัน";
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

function showGpsError(error) {
  let message = "ไม่สามารถระบุตำแหน่งได้";

  if (typeof error === "string") {
    message = error;
  } else if (error?.code === 1) {
    message = "ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง";
  } else if (error?.code === 2) {
    message = "ไม่สามารถระบุตำแหน่งของอุปกรณ์ได้";
  } else if (error?.code === 3) {
    message = "การค้นหาตำแหน่งใช้เวลานานเกินไป";
  }

  const statusTitle = document.getElementById("statusTitle");
  const statusText = document.getElementById("statusText");

  if (statusTitle) {
    statusTitle.textContent = "ยังไม่สามารถระบุตำแหน่ง";
  }

  if (statusText) {
    statusText.textContent = message;
  }
}

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m",
    minutely_15: "precipitation,rain",
    hourly: "precipitation_probability,precipitation,rain,cloud_cover,wind_speed_10m",
    timezone: "auto",
    forecast_minutely_15: "8",
    forecast_hours: "3"
  });

  const response = await fetch(
    `${OPEN_METEO_URL}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  return response.json();
}

function renderWeather(weather, name, lat, lon) {
  const current = weather.current || {};

  const rainAmount = Number(current.rain || 0);
  const precipitation = Number(current.precipitation || 0);

  const status = rainStatusFromAmount(
    Math.max(rainAmount, precipitation)
  );

  const icon = weatherIcon(
    current.weather_code,
    rainAmount,
    precipitation
  );

  const weatherIconElement = document.getElementById("weatherIcon");
  const weatherTemp = document.getElementById("weatherTemp");
  const weatherDescription =
    document.getElementById("weatherDescription");

  if (weatherIconElement) {
    weatherIconElement.textContent = icon;
  }

  if (weatherTemp) {
    weatherTemp.textContent =
      current.temperature_2m != null
        ? `${Math.round(current.temperature_2m)}°`
        : "--°";
  }

  if (weatherDescription) {
    weatherDescription.textContent = status.text;
  }

  const statusTitle = document.getElementById("statusTitle");
  const statusText = document.getElementById("statusText");
  const recommendation = document.getElementById("recommendation");

  if (statusTitle) {
    statusTitle.textContent = status.title;
  }

  if (statusText) {
    statusText.textContent = status.detail;
  }

  if (recommendation) {
    recommendation.textContent =
      getRecommendation(status.level);
  }

  renderTimeline(weather);
  renderDetails(weather);

  setLocationHeader(name, lat, lon);
}

function renderWeatherError(error) {
  const statusTitle = document.getElementById("statusTitle");
  const statusText = document.getElementById("statusText");

  if (statusTitle) {
    statusTitle.textContent = "ไม่สามารถรับข้อมูลสภาพอากาศ";
  }

  if (statusText) {
    statusText.textContent =
      "กรุณาลองเลือกตำแหน่งอีกครั้ง";
  }

  console.error(error);
}

function renderTimeline(weather) {
  const container = document.getElementById("timeline");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const precipitation =
    weather.minutely_15?.precipitation || [];

  const rain =
    weather.minutely_15?.rain || [];

  const times =
    weather.minutely_15?.time || [];

  for (let i = 0; i < 4; i++) {
    const firstIndex = i * 2;

    const amount =
      Number(precipitation[firstIndex] || 0) +
      Number(precipitation[firstIndex + 1] || 0);

    const rainAmount =
      Number(rain[firstIndex] || 0) +
      Number(rain[firstIndex + 1] || 0);

    const total = Math.max(amount, rainAmount);

    const time =
      times[firstIndex]
        ? formatTime(times[firstIndex])
        : `ช่วง ${i + 1}`;

    const status = rainStatusFromAmount(total);

    const slot = document.createElement("div");
    slot.className = "time-slot";

    slot.innerHTML = `
      <div class="time-label">${time}</div>
      <div class="time-icon">${status.icon}</div>
      <div class="time-rain">${formatRainAmount(total)}</div>
    `;

    container.appendChild(slot);
  }
}

function renderDetails(weather) {
  const current = weather.current || {};
  const container = document.getElementById("detailGrid");

  if (!container) {
    return;
  }

  const details = [
    [
      "อุณหภูมิ",
      current.temperature_2m != null
        ? `${current.temperature_2m} °C`
        : "ไม่ทราบ"
    ],
    [
      "ฝน",
      current.rain != null
        ? `${current.rain} mm`
        : "ไม่ทราบ"
    ],
    [
      "เมฆ",
      current.cloud_cover != null
        ? `${current.cloud_cover}%`
        : "ไม่ทราบ"
    ],
    [
      "ลม",
      current.wind_speed_10m != null
        ? `${current.wind_speed_10m} km/h`
        : "ไม่ทราบ"
    ]
  ];

  container.innerHTML = "";

  details.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "detail";

    item.innerHTML = `
      <div class="detail-label">${label}</div>
      <div class="detail-value">${value}</div>
    `;

    container.appendChild(item);
  });
}

function rainStatusFromAmount(amount) {
  const value = Number(amount || 0);

  if (value >= 1.5) {
    return {
      level: "heavy",
      icon: "🌧️",
      title: "มีฝนค่อนข้างมาก",
      text: "มีแนวโน้มพบฝนในช่วงเวลานี้",
      detail: `ปริมาณฝนที่ตรวจพบในช่วงสั้น ๆ ประมาณ ${value.toFixed(1)} mm`
    };
  }

  if (value > 0.1) {
    return {
      level: "light",
      icon: "🌦️",
      title: "มีฝนเล็กน้อย",
      text: "อาจพบฝนในช่วงเวลานี้",
      detail: `ปริมาณฝนที่ตรวจพบในช่วงสั้น ๆ ประมาณ ${value.toFixed(1)} mm`
    };
  }

  return {
    level: "none",
    icon: "☀️",
    title: "ยังไม่พบฝนอย่างมีนัยสำคัญ",
    text: "ยังไม่พบปริมาณฝนที่มีนัยสำคัญในข้อมูลล่าสุด",
    detail: "ข้อมูลปัจจุบันยังไม่พบฝนในปริมาณที่น่าสังเกต"
  };
}

function getRecommendation(level) {
  if (level === "heavy") {
    return "แนะนำ: หากกำลังจะออกไปข้างนอก ควรเตรียมอุปกรณ์กันฝน";
  }

  if (level === "light") {
    return "แนะนำ: ควรเตรียมร่มไว้ หากต้องออกไปข้างนอก";
  }

  return "แนะนำ: จากข้อมูลฝนล่าสุด ยังไม่พบสัญญาณฝนที่น่าสังเกต";
}

function weatherIcon(code, rain, precipitation) {
  if (Number(rain) > 0 || Number(precipitation) > 0) {
    return "🌧️";
  }

  const weatherCode = Number(code);

  if ([1, 2, 3].includes(weatherCode)) {
    return "⛅";
  }

  if ([45, 48].includes(weatherCode)) {
    return "🌫️";
  }

  if ([51, 53, 55, 56, 57].includes(weatherCode)) {
    return "🌦️";
  }

  if ([61, 63, 65, 66, 67].includes(weatherCode)) {
    return "🌧️";
  }

  if ([71, 73, 75, 77].includes(weatherCode)) {
    return "🌨️";
  }

  if ([80, 81, 82].includes(weatherCode)) {
    return "🌦️";
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return "⛈️";
  }

  return "☀️";
}

function formatRainAmount(amount) {
  const value = Number(amount || 0);

  if (value <= 0) {
    return "ไม่มีฝน";
  }

  return `${value.toFixed(1)} mm`;
}

function formatTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function toggleRadar() {
  if (radarVisible) {
    if (radarLayer) {
      map.removeLayer(radarLayer);
    }

    radarLayer = null;
    radarVisible = false;

    const button = document.getElementById("radarButton");

    if (button) {
      button.textContent = "🌧️ เรดาร์";
    }

    return;
  }

  const button = document.getElementById("radarButton");

  if (button) {
    button.disabled = true;
    button.textContent = "🌧️ กำลังโหลด...";
  }

  try {
    const response = await fetch(RAINVIEWER_URL);

    if (!response.ok) {
      throw new Error("Radar API error");
    }

    const data = await response.json();

    const frames = data.radar?.past || [];

    if (!frames.length) {
      throw new Error("No radar frames available");
    }

    const frame = frames[frames.length - 1];

    const host =
      data.host ||
      "https://tilecache.rainviewer.com";

    const tileUrl =
      `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;

    radarLayer = L.tileLayer(tileUrl, {
      opacity: 0.65,
      tileSize: 256,
      maxZoom: 12,
      attribution: "RainViewer"
    });

    radarLayer.addTo(map);
    radarVisible = true;

    if (button) {
      button.textContent = "🌧️ ปิดเรดาร์";
    }
  } catch (error) {
    console.error(error);

    if (button) {
      button.textContent = "🌧️ เรดาร์";
    }

    alert("ไม่สามารถโหลดข้อมูลเรดาร์ได้ในขณะนี้");
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

function toggleEasyMode() {
  document.body.classList.toggle("easy-mode");

  const button = document.getElementById("easyButton");

  if (!button) {
    return;
  }

  button.textContent =
    document.body.classList.contains("easy-mode")
      ? "🔤 ปิดอ่านง่าย"
      : "🔤 อ่านง่าย";
}

function toggleDevPanel() {
  const panel = document.getElementById("devPanel");

  if (!panel) {
    return;
  }

  panel.classList.toggle("active");
}

function handleChat() {
  const input = document.getElementById("chatInput");
  const messages = document.getElementById("chatMessages");

  if (!input || !messages) {
    return;
  }

  const question = input.value.trim();

  if (!question) {
    return;
  }

  addChatMessage(question, "user");

  input.value = "";

  const answer = answerLocalQuestion(question);

  setTimeout(() => {
    addChatMessage(answer, "system");
  }, 150);
}

function addChatMessage(text, type) {
  const messages = document.getElementById("chatMessages");

  if (!messages) {
    return;
  }

  const message = document.createElement("div");
  message.className = `message ${type}`;
  message.textContent = text;

  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
}

function answerLocalQuestion(question) {
  if (!currentWeather) {
    return "กรุณาเลือกตำแหน่งหรือกดปุ่มตำแหน่งของฉันก่อน";
  }

  const weather = currentWeather;
  const current = weather.current || {};

  const rain =
    Math.max(
      Number(current.rain || 0),
      Number(current.precipitation || 0)
    );

  const status = rainStatusFromAmount(rain);

  const lower = question.toLowerCase();

  if (
    lower.includes("ฝน") &&
    (
      lower.includes("ตกเมื่อไหร่") ||
      lower.includes("เมื่อไหร่")
    )
  ) {
    return buildRainTimingAnswer(weather);
  }

  if (
    lower.includes("ออกจากบ้าน") ||
    lower.includes("ออกไป") ||
    lower.includes("ไปข้างนอก")
  ) {
    return getRecommendation(status.level);
  }

  if (
    lower.includes("ตอนนี้") ||
    lower.includes("อากาศ")
  ) {
    const temp =
      current.temperature_2m != null
        ? `${Math.round(current.temperature_2m)}°C`
        : "ไม่ทราบอุณหภูมิ";

    return `ตอนนี้ ${weather.name} อุณหภูมิประมาณ ${temp} และ${status.text}`;
  }

  return `ตอนนี้ ${weather.name} ${status.text} ${getRecommendation(status.level)}`;
}

function buildRainTimingAnswer(weather) {
  const precipitation =
    weather.minutely_15?.precipitation || [];

  const rain =
    weather.minutely_15?.rain || [];

  const times =
    weather.minutely_15?.time || [];

  for (let i = 0; i < 4; i++) {
    const firstIndex = i * 2;

    const amount =
      Number(precipitation[firstIndex] || 0) +
      Number(precipitation[firstIndex + 1] || 0);

    const rainAmount =
      Number(rain[firstIndex] || 0) +
      Number(rain[firstIndex + 1] || 0);

    const total = Math.max(amount, rainAmount);

    if (total > 0.1) {
      const time =
        times[firstIndex]
          ? formatTime(times[firstIndex])
          : "ช่วงถัดไป";

      return `จากข้อมูลที่ได้รับ มีสัญญาณฝนในช่วงประมาณ ${time} เป็นต้นไป`;
    }
  }

  return "จากข้อมูลฝนล่วงหน้า 2 ชั่วโมงที่ได้รับ ยังไม่พบช่วงที่มีฝนอย่างมีนัยสำคัญ";
}

async function testGemini() {
  const keyInput = document.getElementById("geminiApiKey");
  const promptInput = document.getElementById("geminiPrompt");
  const responseElement = document.getElementById("geminiResponse");
  const button = document.getElementById("geminiButton");

  if (!keyInput || !promptInput || !responseElement) {
    return;
  }

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

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `คุณกำลังช่วยตอบคำถามเกี่ยวกับสภาพอากาศ\n\n` +
                `ใช้เฉพาะข้อมูลสภาพอากาศที่ได้รับด้านล่างเท่านั้น ` +
                `ห้ามสร้างข้อมูลสภาพอากาศขึ้นมาเอง และหากข้อมูลไม่เพียงพอให้บอกว่าไม่ทราบ\n\n` +
                `ข้อมูลสภาพอากาศ:\n${weatherContext}\n\n` +
                `คำถาม:\n${userPrompt}\n\n` +
                `ตอบเป็นภาษาไทยแบบสั้น กระชับ และเข้าใจง่าย`
            }
          ]
        }
      ]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `Request failed: ${response.status}`
      );
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") ||
      "ไม่ได้รับข้อความตอบกลับ";

    responseElement.textContent = text;
  } catch (error) {
    console.error(error);
    responseElement.textContent =
      `เกิดข้อผิดพลาด: ${error.message}`;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "ทดสอบ";
    }
  }
}
