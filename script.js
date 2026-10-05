const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const RAINVIEWER_URL = "https://api.rainviewer.com/public/weather-maps.json";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
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
let searchAbortController = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
  initMap();
  renderCities();
  bindEvents();
  loadCityOverview();
  selectLocation(13.7563, 100.5018, "กรุงเทพฯ");
}

function initMap() {
  map = L.map("map", {
    zoomControl: false,
    minZoom: 5,
    maxZoom: 19
  }).setView([15.87, 100.99], 6);

  L.control.zoom({
    position: "topright"
  }).addTo(map);

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
  const gpsButtons = [
    document.getElementById("gpsBtn"),
    document.getElementById("gpsBtnBottom")
  ];

  gpsButtons.forEach(button => {
    if (button) {
      button.addEventListener("click", getCurrentLocation);
    }
  });

  const radarBtn = document.getElementById("radarBtn");
  if (radarBtn) {
    radarBtn.addEventListener("click", toggleRadar);
  }

  const simpleBtn = document.getElementById("simpleModeBtn");
  if (simpleBtn) {
    simpleBtn.addEventListener("click", toggleSimpleMode);
  }

  const devBtn = document.getElementById("devBtn");
  if (devBtn) {
    devBtn.addEventListener("click", toggleDevPanel);
  }

  const chatBtn = document.getElementById("chatBtn");
  if (chatBtn) {
    chatBtn.addEventListener("click", handleChat);
  }

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
  if (geminiBtn) {
    geminiBtn.addEventListener("click", testGemini);
  }

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

  const searchForm = document.getElementById("locationSearchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", event => {
      event.preventDefault();
      searchLocation();
    });
  }

  const searchInput = document.getElementById("locationSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (!searchInput.value.trim()) {
        clearSearchResults();
      }
    });
  }
}

function renderCities() {
  const container = document.getElementById("cityGrid");
  if (!container) return;

  container.innerHTML = "";

  const selectedCities = getOverviewCities();

  selectedCities.forEach(city => {
    const card = document.createElement("button");

    card.type = "button";
    card.className = "city-card";
    card.dataset.city = city.name;

    card.innerHTML = `
      <strong>${escapeHtml(city.name)}</strong>
      <div class="city-weather">
        <span class="city-icon">⏳</span>
        <span class="city-temp">--°</span>
      </div>
      <div class="city-meta">กำลังตรวจสอบ...</div>
    `;

    card.addEventListener("click", () => {
      selectLocation(city.lat, city.lon, city.name);
    });

    container.appendChild(card);
  });
}

function getOverviewCities() {
  const bangkok = cities.find(city => city.name === "กรุงเทพฯ");
  const others = cities.filter(city => city.name !== "กรุงเทพฯ");

  const shuffled = [...others].sort(() => Math.random() - 0.5);

  return [
    bangkok,
    ...shuffled.slice(0, 3)
  ];
}

async function loadCityOverview() {
  const cards = document.querySelectorAll(".city-card");

  for (const card of cards) {
    const cityName = card.dataset.city;
    const city = cities.find(item => item.name === cityName);

    if (!city) continue;

    try {
      const weather = await fetchWeather(city.lat, city.lon);
      updateCityCard(city.name, weather);
    } catch (error) {
      updateCityCardError(city.name);
    }
  }
}

function updateCityCard(cityName, weather) {
  const card = document.querySelector(
    `.city-card[data-city="${CSS.escape(cityName)}"]`
  );

  if (!card) return;

  const current = weather.current || {};
  const rainAmount = Number(current.rain || 0);
  const precipitation = Number(current.precipitation || 0);

  const icon = weatherIcon(
    current.weather_code,
    rainAmount,
    precipitation
  );

  const description = weatherDescription(
    current.weather_code,
    rainAmount,
    precipitation
  );

  const cityTemp = card.querySelector(".city-temp");
  const cityIcon = card.querySelector(".city-icon");
  const cityMeta = card.querySelector(".city-meta");

  if (cityTemp) {
    cityTemp.textContent =
      current.temperature_2m != null
        ? `${Math.round(current.temperature_2m)}°`
        : "--°";
  }

  if (cityIcon) {
    cityIcon.textContent = icon;
  }

  if (cityMeta) {
    cityMeta.textContent = description;
  }
}

function updateCityCardError(cityName) {
  const card = document.querySelector(
    `.city-card[data-city="${CSS.escape(cityName)}"]`
  );

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

  const latitude = Number(lat);
  const longitude = Number(lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return;
  }

  map.flyTo(
    [latitude, longitude],
    Math.max(map.getZoom(), 9),
    { duration: 0.8 }
  );

  setSelectedMarker(latitude, longitude);
  setLocationHeader(name, latitude, longitude);
  setPanelLoading();

  try {
    const weather = await fetchWeather(latitude, longitude);

    currentWeather = {
      ...weather,
      latitude,
      longitude,
      name,
      source: "weather-api"
    };

    renderWeather(
      weather,
      name,
      latitude,
      longitude
    );
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

  if (nameEl) {
    nameEl.textContent = name || "พื้นที่ที่เลือก";
  }

  if (coordsEl) {
    coordsEl.textContent =
      `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
  }
}

function setPanelLoading() {
  const rainStatus = document.getElementById("rainStatus");
  const recommendation = document.getElementById("recommendation");
  const forecastSummary = document.getElementById("forecastSummary");
  const timeline = document.getElementById("timeline");

  if (rainStatus) {
    rainStatus.textContent = "กำลังตรวจสอบข้อมูลสภาพอากาศ...";
  }

  if (recommendation) {
    recommendation.textContent = "กำลังอ่านข้อมูลสภาพอากาศ...";
  }

  if (forecastSummary) {
    forecastSummary.textContent = "กำลังโหลดข้อมูลพยากรณ์...";
  }

  if (timeline) {
    timeline.innerHTML = "";
  }
}

async function getCurrentLocation() {
  if (!navigator.geolocation) {
    showGpsError("อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง");
    return;
  }

  const btn = document.getElementById("gpsBtn");
  const btnBottom = document.getElementById("gpsBtnBottom");

  const buttons = [
    btn,
    btnBottom
  ].filter(Boolean);

  buttons.forEach(button => {
    button.disabled = true;
    button.textContent = "📍 กำลังค้นหาตำแหน่ง...";
  });

  navigator.geolocation.getCurrentPosition(
    async position => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      setUserMarker(lat, lon);

      await selectLocation(
        lat,
        lon,
        "ตำแหน่งของฉัน"
      );

      buttons.forEach(button => {
        button.disabled = false;
        button.textContent = "📍 ใช้ตำแหน่งของฉัน";
      });
    },
    error => {
      showGpsError(error);

      buttons.forEach(button => {
        button.disabled = false;
        button.textContent = "📍 ใช้ตำแหน่งของฉัน";
      });
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

function showGpsError(error) {
  const box = document.getElementById("gpsError");

  if (!box) return;

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

  box.textContent = message;
  box.style.display = "block";
}

async function searchLocation() {
  const input = document.getElementById("locationSearchInput");
  const results = document.getElementById("locationSearchResults");

  if (!input || !results) return;

  const query = input.value.trim();

  if (!query) {
    clearSearchResults();
    return;
  }

  if (searchAbortController) {
    searchAbortController.abort();
  }

  searchAbortController = new AbortController();

  results.innerHTML = `
    <div class="search-result">
      กำลังค้นหาพื้นที่...
    </div>
  `;

  try {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "6",
      countrycodes: "th"
    });

    const response = await fetch(
      `${NOMINATIM_URL}?${params.toString()}`,
      {
        headers: {
          Accept: "application/json"
        },
        signal: searchAbortController.signal
      }
    );

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }

    const data = await response.json();

    renderSearchResults(data);
  } catch (error) {
    if (error.name === "AbortError") return;

    console.error(error);

    results.innerHTML = `
      <div class="search-result">
        ไม่สามารถค้นหาพื้นที่ได้ในขณะนี้
      </div>
    `;
  }
}

function renderSearchResults(items) {
  const container = document.getElementById("locationSearchResults");

  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = `
      <div class="search-result">
        ไม่พบพื้นที่ที่ค้นหา
      </div>
    `;
    return;
  }

  items.forEach(item => {
    const lat = Number(item.lat);
    const lon = Number(item.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }

    const button = document.createElement("button");

    button.type = "button";
    button.className = "search-result";

    const name =
      item.display_name ||
      item.name ||
      "พื้นที่ที่ค้นพบ";

    const detail = buildSearchDetail(item);

    button.innerHTML = `
      <span class="search-result-name">
        ${escapeHtml(name)}
      </span>
      <span class="search-result-detail">
        ${escapeHtml(detail)}
      </span>
    `;

    button.addEventListener("click", () => {
      selectLocation(lat, lon, name);
      clearSearchResults();
    });

    container.appendChild(button);
  });
}

function buildSearchDetail(item) {
  const address = item.address || {};

  const parts = [
    address.road,
    address.suburb,
    address.city_district,
    address.town,
    address.city,
    address.province,
    address.state
  ].filter(Boolean);

  return parts.length
    ? parts.slice(0, 4).join(" • ")
    : `${Number(item.lat).toFixed(5)}, ${Number(item.lon).toFixed(5)}`;
}

function clearSearchResults() {
  const results = document.getElementById("locationSearchResults");

  if (results) {
    results.innerHTML = "";
  }
}

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,

    current: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "wind_direction_10m",
      "relative_humidity_2m"
    ].join(","),

    minutely_15: [
      "precipitation",
      "rain",
      "temperature_2m",
      "weather_code"
    ].join(","),

    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "precipitation",
      "rain",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "relative_humidity_2m"
    ].join(","),

    forecast_minutely_15: "12",
    forecast_hours: "3",
    timezone: "auto"
  });

  const response = await fetch(
    `${OPEN_METEO_URL}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      `Weather API error: ${response.status}`
    );
  }

  return response.json();
}

function renderWeather(weather, name, lat, lon) {
  const current = weather.current || {};

  const rainAmount = Math.max(
    Number(current.rain || 0),
    Number(current.precipitation || 0)
  );

  const icon = weatherIcon(
    current.weather_code,
    current.rain,
    current.precipitation
  );

  const description = weatherDescription(
    current.weather_code,
    current.rain,
    current.precipitation
  );

  const temperatureEl = document.getElementById("temperature");
  const weatherDescEl = document.getElementById("weatherDescription");
  const weatherIconEl = document.getElementById("weatherIcon");
  const rainStatusEl = document.getElementById("rainStatus");
  const recommendationEl = document.getElementById("recommendation");
  const forecastUpdatedEl = document.getElementById("forecastUpdated");

  if (temperatureEl) {
    temperatureEl.textContent =
      current.temperature_2m != null
        ? `${Math.round(current.temperature_2m)}°C`
        : "--°C";
  }

  if (weatherDescEl) {
    weatherDescEl.textContent = description;
  }

  if (weatherIconEl) {
    weatherIconEl.textContent = icon;
  }

  if (rainStatusEl) {
    rainStatusEl.textContent =
      rainStatusFromAmount(rainAmount).detail;
  }

  if (recommendationEl) {
    recommendationEl.textContent =
      getRecommendationFromWeather(weather);
  }

  if (forecastUpdatedEl) {
    forecastUpdatedEl.textContent =
      `อัปเดต ${getCurrentTimeLabel()}`;
  }

  renderDetails(weather);
  renderTimeline(weather);
  renderForecastSummary(weather);

  setLocationHeader(name, lat, lon);
}

function renderDetails(weather) {
  const current = weather.current || {};

  const detailTemp = document.getElementById("detailTemp");
  const detailRain = document.getElementById("detailRain");
  const detailProbability = document.getElementById("detailProbability");
  const detailCloud = document.getElementById("detailCloud");
  const detailWind = document.getElementById("detailWind");
  const detailUpdated = document.getElementById("detailUpdated");

  if (detailTemp) {
    detailTemp.textContent =
      current.temperature_2m != null
        ? `${Number(current.temperature_2m).toFixed(1)}°C`
        : "--";
  }

  if (detailRain) {
    detailRain.textContent =
      current.rain != null
        ? `${Number(current.rain).toFixed(1)} mm`
        : "--";
  }

  const probability = getCurrentProbability(weather);

  if (detailProbability) {
    detailProbability.textContent =
      probability != null
        ? `${Math.round(probability)}%`
        : "ไม่ทราบ";
  }

  if (detailCloud) {
    detailCloud.textContent =
      current.cloud_cover != null
        ? `${Math.round(current.cloud_cover)}%`
        : "ไม่ทราบ";
  }

  if (detailWind) {
    detailWind.textContent =
      current.wind_speed_10m != null
        ? `${Number(current.wind_speed_10m).toFixed(1)} km/h`
        : "ไม่ทราบ";
  }

  if (detailUpdated) {
    detailUpdated.textContent = getCurrentTimeLabel();
  }
}

function getCurrentProbability(weather) {
  const hourly = weather.hourly || {};

  if (
    !Array.isArray(hourly.precipitation_probability) ||
    !hourly.time?.length
  ) {
    return null;
  }

  const index = findNearestTimeIndex(
    hourly.time,
    weather.current?.time
  );

  if (index < 0) return null;

  const value = hourly.precipitation_probability[index];

  return value != null ? Number(value) : null;
}

function renderForecastSummary(weather) {
  const element = document.getElementById("forecastSummary");

  if (!element) return;

  const points = getShortTermForecast(weather);

  if (!points.length) {
    element.textContent =
      "ยังไม่มีข้อมูลพยากรณ์ระยะสั้นที่เพียงพอ";
    return;
  }

  const rainy = points.filter(point => point.rain > 0.1);

  if (rainy.length === 0) {
    element.textContent =
      "ในช่วง 1–2 ชั่วโมงข้างหน้า ยังไม่พบปริมาณฝนที่มีนัยสำคัญจากข้อมูลที่ได้รับ";
    return;
  }

  const strongest = rainy.reduce(
    (best, point) =>
      point.rain > best.rain ? point : best,
    rainy[0]
  );

  element.textContent =
    `ในช่วง 1–2 ชั่วโมงข้างหน้า มีสัญญาณฝนในบางช่วง โดยช่วงที่มีปริมาณฝนสูงสุดจากข้อมูลที่ได้รับคือประมาณ ${formatTime(strongest.time)} (${formatRainAmount(strongest.rain)})`;
}

function renderTimeline(weather) {
  const container = document.getElementById("timeline");

  if (!container) return;

  const points = getShortTermForecast(weather);

  container.innerHTML = "";

  if (!points.length) {
    container.innerHTML = `
      <div class="time-card">
        <div class="time-detail">
          ไม่มีข้อมูลพยากรณ์
        </div>
      </div>
    `;
    return;
  }

  points.forEach(point => {
    const slot = document.createElement("div");

    slot.className = "time-card";

    slot.innerHTML = `
      <div class="time-label">
        ${escapeHtml(point.label)}
      </div>

      <div class="time-icon">
        ${point.icon}
      </div>

      <div class="time-rain">
        ${escapeHtml(formatRainAmount(point.rain))}
      </div>

      <div class="time-detail">
        ${escapeHtml(point.description)}
      </div>

      ${
        point.temperature != null
          ? `<div class="time-detail">${Math.round(point.temperature)}°C</div>`
          : ""
      }
    `;

    container.appendChild(slot);
  });
}
function getShortTermForecast(weather) {
  const minutely = weather.minutely_15 || {};

  const times = Array.isArray(minutely.time)
    ? minutely.time
    : [];

  const rainValues = Array.isArray(minutely.rain)
    ? minutely.rain
    : [];

  const precipitationValues =
    Array.isArray(minutely.precipitation)
      ? minutely.precipitation
      : [];

  const temperatureValues =
    Array.isArray(minutely.temperature_2m)
      ? minutely.temperature_2m
      : [];

  const weatherCodes =
    Array.isArray(minutely.weather_code)
      ? minutely.weather_code
      : [];

  if (!times.length) return [];

  const currentTime =
    weather.current?.time
      ? new Date(weather.current.time).getTime()
      : Date.now();

  const futurePoints = [];

  for (let i = 0; i < times.length; i++) {
    const timestamp = new Date(times[i]).getTime();

    if (!Number.isFinite(timestamp)) continue;

    if (timestamp < currentTime) continue;

    futurePoints.push({
      time: times[i],
      timestamp,
      rain: Math.max(
        Number(rainValues[i] || 0),
        Number(precipitationValues[i] || 0)
      ),
      temperature:
        temperatureValues[i] != null
          ? Number(temperatureValues[i])
          : null,
      weatherCode:
        weatherCodes[i] != null
          ? Number(weatherCodes[i])
          : null
    });

    if (futurePoints.length >= 8) {
      break;
    }
  }

  if (!futurePoints.length) return [];

  const displayPoints = [];

  for (let i = 0; i < futurePoints.length; i += 2) {
    const group = futurePoints.slice(i, i + 2);

    if (!group.length) continue;

    const rain = Math.max(
      ...group.map(point => point.rain)
    );

    const temperature = group
      .map(point => point.temperature)
      .find(value => value != null);

    const weatherCode = group
      .map(point => point.weatherCode)
      .find(value => value != null);

    displayPoints.push({
      time: group[0].time,
      label: formatForecastLabel(
        group[0].timestamp,
        i === 0
      ),
      rain,
      temperature,
      weatherCode,
      icon: weatherIcon(
        weatherCode,
        rain,
        rain
      ),
      description: weatherDescription(
        weatherCode,
        rain,
        rain
      )
    });
  }

  return displayPoints.slice(0, 5);
}

function formatForecastLabel(timestamp, isFirst) {
  if (isFirst) {
    return "ตอนนี้";
  }

  const date = new Date(timestamp);

  return date.toLocaleTimeString(
    "th-TH",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

function rainStatusFromAmount(amount) {
  const value = Number(amount || 0);

  if (value >= 1.5) {
    return {
      level: "heavy",
      icon: "🌧️",
      title: "มีฝนค่อนข้างมาก",
      text: "มีฝนในปริมาณค่อนข้างมาก",
      detail: `มีปริมาณฝนประมาณ ${value.toFixed(1)} mm`
    };
  }

  if (value > 0.1) {
    return {
      level: "light",
      icon: "🌦️",
      title: "มีฝนเล็กน้อย",
      text: "มีฝนเล็กน้อย",
      detail: `มีปริมาณฝนประมาณ ${value.toFixed(1)} mm`
    };
  }

  return {
    level: "none",
    icon: "☀️",
    title: "ยังไม่พบฝน",
    text: "ยังไม่พบฝนอย่างมีนัยสำคัญ",
    detail: "ยังไม่พบปริมาณฝนที่มีนัยสำคัญ"
  };
}

function getRecommendationFromWeather(weather) {
  const points = getShortTermForecast(weather);

  if (!points.length) {
    return "ยังไม่มีข้อมูลเพียงพอสำหรับการประเมิน";
  }

  const rainyPoints = points.filter(
    point => point.rain > 0.1
  );

  if (!rainyPoints.length) {
    return "จากข้อมูลช่วง 1–2 ชั่วโมงข้างหน้า ยังไม่พบฝนอย่างมีนัยสำคัญ";
  }

  const heavy = rainyPoints.some(
    point => point.rain >= 1.5
  );

  if (heavy) {
    return "ช่วง 1–2 ชั่วโมงข้างหน้ามีช่วงที่ฝนอาจตกมาก ควรเตรียมอุปกรณ์กันฝนหากต้องออกไปข้างนอก";
  }

  return "ช่วง 1–2 ชั่วโมงข้างหน้ามีโอกาสพบฝนบางช่วง หากต้องออกไปข้างนอกควรเตรียมร่มไว้";
}

function getRecommendation(level) {
  if (level === "heavy") {
    return "ควรเตรียมอุปกรณ์กันฝน";
  }

  if (level === "light") {
    return "ควรเตรียมร่มไว้";
  }

  return "ยังไม่พบสัญญาณฝนที่น่าสังเกต";
}


function weatherDescription(code, rain, precipitation) {
  const rainAmount = Math.max(
    Number(rain || 0),
    Number(precipitation || 0)
  );

  if (rainAmount > 0.1) {
    const status = rainStatusFromAmount(rainAmount);
    return status.title;
  }

  const weatherCode = Number(code);

  const descriptions = {
    0: "ท้องฟ้าแจ่มใส",
    1: "มีเมฆเล็กน้อย",
    2: "มีเมฆบางส่วน",
    3: "มีเมฆมาก",
    45: "มีหมอก",
    48: "มีหมอกและน้ำค้างแข็ง",
    51: "มีฝนปรอยเล็กน้อย",
    53: "มีฝนปรอย",
    55: "มีฝนปรอยค่อนข้างมาก",
    56: "มีฝนเยือกแข็งเล็กน้อย",
    57: "มีฝนเยือกแข็ง",
    61: "มีฝนเล็กน้อย",
    63: "มีฝนปานกลาง",
    65: "มีฝนตกหนัก",
    66: "มีฝนเยือกแข็งเล็กน้อย",
    67: "มีฝนเยือกแข็ง",
    71: "มีหิมะเล็กน้อย",
    73: "มีหิมะปานกลาง",
    75: "มีหิมะตกหนัก",
    77: "มีเม็ดน้ำแข็ง",
    80: "มีฝนซู่เล็กน้อย",
    81: "มีฝนซู่",
    82: "มีฝนซู่หนัก",
    95: "มีพายุฝนฟ้าคะนอง",
    96: "มีพายุฝนฟ้าคะนองและลูกเห็บ",
    99: "มีพายุฝนฟ้าคะนองและลูกเห็บ"
  };

  return descriptions[weatherCode] || "สภาพอากาศไม่ทราบ";
}

function weatherIcon(code, rain, precipitation) {
  const rainAmount = Math.max(
    Number(rain || 0),
    Number(precipitation || 0)
  );

  if (rainAmount > 0.1) {
    const weatherCode = Number(code);

    if ([95, 96, 99].includes(weatherCode)) {
      return "⛈️";
    }

    return "🌧️";
  }

  const weatherCode = Number(code);

  if (weatherCode === 0) return "☀️";
  if ([1, 2].includes(weatherCode)) return "🌤️";
  if (weatherCode === 3) return "☁️";
  if ([45, 48].includes(weatherCode)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return "🌦️";
  if ([61, 63, 65, 66, 67].includes(weatherCode)) return "🌧️";
  if ([71, 73, 75, 77].includes(weatherCode)) return "🌨️";
  if ([80, 81, 82].includes(weatherCode)) return "🌦️";
  if ([95, 96, 99].includes(weatherCode)) return "⛈️";

  return "🌤️";
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

  return date.toLocaleTimeString(
    "th-TH",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

function getCurrentTimeLabel() {
  return new Date().toLocaleTimeString(
    "th-TH",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

function findNearestTimeIndex(times, targetTime) {
  if (!Array.isArray(times) || !times.length) {
    return -1;
  }

  const target = targetTime
    ? new Date(targetTime).getTime()
    : Date.now();

  let nearestIndex = 0;
  let nearestDifference = Infinity;

  times.forEach((time, index) => {
    const timestamp = new Date(time).getTime();

    if (!Number.isFinite(timestamp)) return;

    const difference = Math.abs(
      timestamp - target
    );

    if (difference < nearestDifference) {
      nearestDifference = difference;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

async function toggleRadar() {
  if (radarVisible) {
    if (radarLayer) {
      map.removeLayer(radarLayer);
    }

    radarLayer = null;
    radarVisible = false;

    const button = document.getElementById("radarBtn");

    if (button) {
      button.textContent = "🌧️ เรดาร์";
    }

    return;
  }

  const button = document.getElementById("radarBtn");

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

    alert(
      "ไม่สามารถโหลดข้อมูลเรดาร์ได้ในขณะนี้"
    );
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
    }

function toggleSimpleMode() {
  document.body.classList.toggle("simple-mode");

  const button =
    document.getElementById("simpleModeBtn");

  if (!button) return;

  button.textContent =
    document.body.classList.contains("simple-mode")
      ? "ปิดอ่านง่าย"
      : "🔤 อ่านง่าย";
}

function toggleDevPanel() {
  const panel = document.getElementById("devPanel");

  if (!panel) return;

  panel.classList.toggle("open");
}

function handleChat() {
  const input =
    document.getElementById("chatInput");

  const output =
    document.getElementById("chatAnswer");

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

  if (!isWeatherQuestion(question)) {
    return "ผมช่วยตอบเรื่องสภาพอากาศให้ได้ครับ ส่วนเรื่องอื่นผมขอไม่ตอบนะครับ";
  }

  const weather = currentWeather;
  const current = weather.current || {};

  const rain = Math.max(
    Number(current.rain || 0),
    Number(current.precipitation || 0)
  );

  const status = rainStatusFromAmount(rain);
  const lower = question.toLowerCase();

  if (
    lower.includes("ฝน") &&
    (
      lower.includes("ตกเมื่อไหร่") ||
      lower.includes("เมื่อไหร่") ||
      lower.includes("ช่วงไหน")
    )
  ) {
    return buildRainTimingAnswer(weather);
  }

  if (
    lower.includes("ออกจากบ้าน") ||
    lower.includes("ออกไป") ||
    lower.includes("ไปข้างนอก") ||
    lower.includes("ออกนอกบ้าน")
  ) {
    return getRecommendationFromWeather(weather);
  }

  if (
    lower.includes("หนึ่งชั่วโมง") ||
    lower.includes("1 ชั่วโมง")
  ) {
    return buildOneHourAnswer(weather);
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

  return getWeatherOverviewAnswer(weather);
}

function isWeatherQuestion(question) {
  const keywords = [
    "อากาศ",
    "ฝน",
    "เมฆ",
    "ลม",
    "แดด",
    "อุณหภูมิ",
    "ร้อน",
    "หนาว",
    "พายุ",
    "ร่ม",
    "ออกจากบ้าน",
    "ออกไป",
    "ข้างนอก",
    "หนึ่งชั่วโมง",
    "1 ชั่วโมง",
    "พรุ่งนี้",
    "วันนี้"
  ];

  return keywords.some(
    keyword => question.includes(keyword)
  );
}

function getWeatherOverviewAnswer(weather) {
  const current = weather.current || {};

  const temp =
    current.temperature_2m != null
      ? `${Math.round(current.temperature_2m)}°C`
      : "ไม่ทราบอุณหภูมิ";

  const description = weatherDescription(
    current.weather_code,
    current.rain,
    current.precipitation
  );

  return `ตอนนี้ ${weather.name} อุณหภูมิประมาณ ${temp} สภาพอากาศคือ${description}`;
}

function buildOneHourAnswer(weather) {
  const points = getShortTermForecast(weather);

  if (!points.length) {
    return "ยังไม่มีข้อมูลเพียงพอสำหรับพยากรณ์ในอีก 1 ชั่วโมง";
  }

  const target =
    points.find(point => {
      const difference =
        new Date(point.time).getTime() -
        Date.now();

      return difference >= 30 * 60 * 1000;
    }) || points[points.length - 1];

  const rainText =
    target.rain > 0.1
      ? `มีฝนประมาณ ${target.rain.toFixed(1)} mm`
      : "ยังไม่พบฝนอย่างมีนัยสำคัญ";

  const tempText =
    target.temperature != null
      ? `อุณหภูมิประมาณ ${Math.round(target.temperature)}°C`
      : "ยังไม่มีข้อมูลอุณหภูมิ";

  return `อีกประมาณ 1 ชั่วโมง ข้อมูลคาดการณ์ระบุว่า${target.description} ${tempText} และ${rainText}`;
    }

function buildRainTimingAnswer(weather) {
  const points = getShortTermForecast(weather);

  const rainy = points.filter(
    point => point.rain > 0.1
  );

  if (!rainy.length) {
    return "จากข้อมูลฝนล่วงหน้า 1–2 ชั่วโมงที่ได้รับ ยังไม่พบช่วงที่มีฝนอย่างมีนัยสำคัญ";
  }

  const first = rainy[0];

  return `จากข้อมูลที่ได้รับ มีสัญญาณฝนประมาณ ${formatTime(first.time)} เป็นต้นไป`;
}

async function testGemini() {
  const keyInput =
    document.getElementById("geminiKey");

  const promptInput =
    document.getElementById("devPrompt");

  const responseElement =
    document.getElementById("devResponse");

  const button =
    document.getElementById("geminiTestBtn");

  if (!keyInput || !promptInput || !responseElement) {
    return;
  }

  const apiKey = keyInput.value.trim();
  const userPrompt = promptInput.value.trim();

  if (!apiKey) {
    responseElement.textContent =
      "กรุณาใส่ API Key สำหรับการทดสอบ";
    return;
  }

  if (!userPrompt) {
    responseElement.textContent =
      "กรุณาใส่คำถามหรือ Prompt";
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "กำลังทดสอบ...";
  }

  responseElement.textContent =
    "กำลังส่งคำขอ...";

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
                `คุณกำลังช่วยตอบคำถามเกี่ยวกับสภาพอากาศ

ใช้เฉพาะข้อมูลสภาพอากาศที่ได้รับด้านล่างเท่านั้น
ห้ามสร้างข้อมูลสภาพอากาศขึ้นมาเอง
หากข้อมูลไม่เพียงพอให้บอกว่าไม่เพียงพอ

ข้อมูลสภาพอากาศ:
${weatherContext}

คำถาม:
${userPrompt}

ตอบเป็นภาษาไทยแบบสั้น กระชับ และเข้าใจง่าย`
            }
          ]
        }
      ]
    };

    const response = await fetch(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

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
      button.textContent = "🤖 ทดสอบ Gemini";
    }
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
