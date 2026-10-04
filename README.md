# Rain-prophecy
A small weather forecast website.
# 🌦️ Rain-prophecy

Rain-prophecy is a mobile-first weather and rain monitoring web module for Thailand.

The primary purpose of this project is to answer a simple question:

> "Will it rain here soon, and should I be concerned?"

The project focuses on short-term rain information, especially the next 1–2 hours, using real weather data from external APIs.

This project is currently being developed as an independent Weather Module.

In the future, this module is intended to become one part of a larger Main Website.

---

# 🎯 Project Goals

Rain-prophecy is designed to make weather information:

- Simple to understand
- Fast to access
- Mobile-friendly
- Useful for short-term decisions
- Based on real API data
- Easy to use for people who do not want complicated weather information

The most important information is:

1. Current weather
2. Current rain status
3. Rain in the next 1–2 hours
4. Wind and other useful conditions
5. Radar information
6. A simple explanation of what the weather means

The interface should prioritize understandable information over technical weather terminology.

---

# 🧭 Core Principles

These principles should remain consistent throughout development.

## 1. Real Data Only

The website must use real data returned by weather APIs.

Do not invent:

- Weather conditions
- Rain amounts
- Temperatures
- Wind speeds
- Cloud percentages
- Radar images
- Model information
- API limits

If an API does not provide a value, the website should not pretend that the value is known.

Instead, the UI should clearly indicate that the information is unavailable or unknown.

---

## 2. No Fake Weather Visualization

The website must not create a fake nationwide rain map by taking the forecast from one location and spreading it across Thailand.

A map visualization should represent actual geographic data.

Radar information and forecast information must remain conceptually separate.

### Forecast

Forecast data answers:

> "What is expected to happen at this location?"

### Radar

Radar data answers:

> "Where is precipitation actually being detected or observed?"

---

## 3. Mobile First

The project is primarily designed for mobile devices.

Important information should remain easy to read on a small screen.

The interface should use:

- Large important numbers
- Large buttons
- Clear spacing
- Simple cards
- Short descriptions
- Minimal unnecessary controls

Desktop layouts can be improved later without compromising the mobile experience.

---

## 4. Simple Language

The user should not need to understand meteorology to use the website.

For example:

Instead of only showing:

`precipitation_probability: 70%`

The interface should explain the practical meaning when appropriate.

Example:

> 🌧️ มีโอกาสเกิดฝนในช่วงนี้  
> ควรเตรียมร่มหากต้องออกไปข้างนอก

Interpretations must always be based on actual returned data.

---

## 5. Do Not Overbuild Too Early

The current Weather Module should remain simple.

Do not create unnecessary:

- Backend systems
- Databases
- Authentication
- Complex folder structures
- Multiple services
- Unnecessary dependencies

unless they are actually required by the current stage of the project.

The architecture can grow when the requirements justify it.

---

# 📁 Current Project Structure

The current project intentionally uses a simple structure:

```text
Rain-prophecy/
├── README.md
├── index.html
├── style.css
└── script.js
```

This structure is currently preferred because it is easy to maintain and debug, especially during mobile development.

Do not split the project into many files just for the sake of organization.

---

# 🧩 Current File Responsibilities

## `index.html`

Responsible for:

- Page structure
- Main UI containers
- Map container
- Weather sections
- City overview
- Selected location
- Rain information
- Timeline
- Details
- AI assistant
- Developer testing interface

HTML should describe the structure of the application.

Business logic should remain in JavaScript.

---

## `style.css`

Responsible for:

- Layout
- Responsive design
- Mobile UI
- Desktop UI
- Colors
- Cards
- Buttons
- Typography
- Easy Reading Mode
- Visibility states

CSS should control presentation rather than application logic.

---

## `script.js`

Responsible for the main application logic.

The code should conceptually be organized into these logical layers:

```text
1. CONFIG
2. LOCATION
3. WEATHER DATA
4. WEATHER INTERPRETATION
5. MAP / RADAR
6. UI
7. AI / DEV
```

These are currently logical layers inside `script.js`.

They do not need to become separate files yet.

---

# 🏗️ Internal Architecture

## 1. CONFIG

Contains configuration such as:

- Open-Meteo endpoint
- RainViewer endpoint
- Gemini configuration
- Other external service configuration

Configuration should be kept separate from application logic whenever practical.

---

## 2. LOCATION

Responsible for:

- Default Thailand location
- City selection
- Map selection
- GPS location
- Selected coordinates
- Location markers

All location selection methods should eventually flow through one central process.

Conceptually:

```text
City Selection
      │
Map Click
      │
GPS
      │
      ▼
selectLocation(lat, lon, name)
      │
      ▼
Weather Data
```

The goal is to prevent each location method from implementing its own separate weather-loading logic.

---

## 3. WEATHER DATA

Responsible for retrieving actual weather information.

Primary weather source:

Open-Meteo.

The application currently uses information such as:

- Current weather
- Temperature
- Rain
- Cloud cover
- Wind
- Humidity
- 15-minute forecast data
- Hourly forecast data

The exact fields should follow what the API actually returns.

---

## 4. WEATHER INTERPRETATION

This layer converts numerical weather data into understandable information.

For example:

```text
API Data
   ↓
Rain Amount
   ↓
Rain Status
   ↓
Human-readable explanation
   ↓
Recommendation
```

Interpretation rules must be deterministic and based on real values.

The UI must never imply certainty when the underlying data does not support it.

---

# 🌧️ Rain Nowcasting

Rain-prophecy focuses heavily on short-term rain information.

The current system uses 15-minute forecast data.

The target user experience is approximately:

```text
Now
 ↓
+15 minutes
 ↓
+30 minutes
 ↓
+45 minutes
 ↓
+60 minutes
 ↓
+90 minutes
 ↓
+120 minutes
```

The interface should eventually make this information easy to understand without requiring the user to interpret raw API values.

Example:

```text
ตอนนี้       🌦️ ฝนเล็กน้อย
อีก 30 นาที  🌧️ ฝนเพิ่มขึ้น
อีก 60 นาที  🌧️ ยังมีฝน
อีก 90 นาที  ☁️ ฝนลดลง
อีก 120 นาที ☀️ ฝนหยุด
```

These descriptions must always be generated from actual forecast values.

---

# 🗺️ Map

The map uses Leaflet and OpenStreetMap.

The map is intended to provide:

- Thailand overview
- City selection
- GPS position
- Map-click location selection
- Selected location marker
- Radar overlay

The map should remain a supporting tool.

The primary purpose of the website is still weather and rain information.

---

# 🌧️ Radar

Radar information is separate from forecast information.

RainViewer is currently used as the radar data source.

The application should only display actual radar frames returned by the service.

If radar data is unavailable:

- Do not create a fake radar layer.
- Do not display an empty layer as if it were real.
- Clearly indicate that radar information is unavailable.

---

# 🇹🇭 Thailand Overview

The initial overview contains key locations in Thailand.

Current locations:

```text
กรุงเทพฯ
เชียงใหม่
เชียงราย
ขอนแก่น
นครราชสีมา
ชลบุรี
ภูเก็ต
หาดใหญ่
นครศรีธรรมราช
สุราษฎร์ธานี
```

Each location should provide a compact summary such as:

```text
City
Weather Icon
Temperature
Rain Status
```

Selecting a city should open the same central location/weather flow used by other location methods.

---

# 📍 Selected Location

After selecting a location through:

- City card
- Map click
- GPS

the interface should display information about the selected location.

Example:

```text
กรุงเทพฯ

🌦️ 32°

มีฝนเล็กน้อย
```

The selected location should also provide:

- Coordinates
- Current weather
- Rain status
- Short-term timeline
- Weather details
- Practical recommendation

---

# 💧 Rain Status

The rain section should answer:

> "ฝนเป็นอย่างไร?"

The result should be understandable immediately.

Example:

```text
🌧️ สถานะฝน

มีฝนเล็กน้อยในช่วงนี้

แนะนำ:
ควรเตรียมร่มหากต้องออกไปข้างนอก
```

The recommendation must be derived from actual weather data.

The system must not claim that rain will definitely happen unless the available data supports that statement.

---

# 📊 Weather Details

Advanced weather information may include:

- Temperature
- Rain
- Cloud cover
- Wind
- Humidity
- Other API-provided information

Details are secondary to the main rain status.

The interface should avoid overwhelming users with technical information.

---

# 👴 Easy Reading Mode

The website is intended to be usable by people who prefer simple and large information.

Easy Reading Mode should provide:

- Larger text
- Larger buttons
- More spacing
- Less technical information
- Clear weather icons
- Simple recommendations

The goal is:

> Look at the screen and understand the situation within a few seconds.

---

# 💬 Weather Assistant

The public weather assistant is intended to answer questions such as:

```text
ฝนจะตกเมื่อไหร่?
ตอนนี้ควรออกจากบ้านไหม?
อีกหนึ่งชั่วโมงฝนจะตกไหม?
วันนี้ควรพกร่มไหม?
```

The assistant must use real weather data.

It must not invent weather conditions.

The public UI should not falsely claim that a response came from Gemini if it was generated by local deterministic logic.

---

# 🧪 Developer Panel

A private developer/testing area may be used for:

- Gemini testing
- API testing
- Model testing
- Prompt testing
- Response inspection
- Debugging

Technical information should remain hidden from normal public users.

The public interface should not expose:

- API keys
- Provider configuration
- Backend architecture
- Internal service details
- Development controls

---

# 🔐 API Key Safety

API keys must never be committed to GitHub.

Do not place real keys inside:

- `index.html`
- `style.css`
- `script.js`
- `README.md`
- GitHub commits

If a key is accidentally exposed, revoke it and create a new key.

Future production AI functionality should preferably use a secure backend/API layer rather than exposing provider credentials directly to public users.

---

# 🚧 Current Development Status

The project is currently in the stabilization stage.

The basic system is already working to a certain degree.

Current capabilities include:

- Mobile weather interface
- Thailand city overview
- Leaflet map
- City selection
- Map location selection
- GPS location
- Open-Meteo weather data
- Short-term rain information
- RainViewer radar integration
- Easy Reading Mode foundation
- Weather question interface
- Developer testing interface

The current priority is not to add many new features.

The priority is to make the existing system reliable and structurally clear.

---

# 🛠️ Development Roadmap

Development should proceed in stages.

## Phase 1 — Stabilize the Existing Website

Confirm that the basic chain works:

```text
Vercel
  ↓
index.html
  ↓
style.css
  ↓
script.js
  ↓
Leaflet
  ↓
Open-Meteo
```

Check:

- Page loading
- CSS loading
- JavaScript loading
- Map rendering
- Weather requests
- Error handling
- Mobile layout
- Vercel deployment

Do not add major new features during this phase.

---

## Phase 2 — Unify Location Handling

Make sure:

```text
City
Map
GPS
```

all use the same central location flow.

Target:

```text
selectLocation(lat, lon, name)
```

This reduces duplicated logic and makes future development safer.

---

## Phase 3 — Strengthen Rain Nowcasting

Improve the short-term rain timeline.

Target:

```text
Now
+15
+30
+45
+60
+90
+120
```

Then convert the values into simple language.

This is one of the most important parts of the Weather Module.

---

## Phase 4 — Radar

Stabilize the radar system.

Keep the difference between:

```text
Forecast
```

and:

```text
Radar
```

clear.

Forecast = expected future conditions.

Radar = observed precipitation information.

---

## Phase 5 — Easy Reading Mode

Improve the experience for users who prefer:

- Large text
- Large buttons
- Simple language
- Minimal information

The main goal is usability, not visual complexity.

---

## Phase 6 — Weather Module Interface

Eventually the Weather Module should expose a clean internal result.

Conceptually:

```text
Weather Module
      ↓
getWeather(location)
      ↓
Weather Data
      ↓
Main Website
```

The future Main Website should not need to know the details of Open-Meteo or RainViewer.

The Weather Module should handle those details internally.

---

# 🔮 Future Main Website

Rain-prophecy is currently being developed as an independent module.

It is not the final Main Website.

The long-term architecture is expected to look conceptually like:

```text
                    Main Website
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
 Weather Module     Future Module     Future Module
        │
        ├── Location
        ├── Weather Data
        ├── Rain Forecast
        ├── Radar
        └── Weather Interpretation
```

The Main Website should eventually consume finished modules rather than duplicating their internal logic.

---

# 🗂️ Future Folder Structure

The project should NOT create these folders prematurely.

Possible future structure:

```text
Rain-prophecy/
├── README.md
├── index.html
├── style.css
├── script.js
│
├── data/
├── assets/
├── modules/
└── api/
```

These folders should only be introduced when the project actually requires them.

The current simple structure is intentional.

---

# 🚫 Things We Should NOT Do Yet

Unless requirements change, avoid:

- Rewriting the entire project
- Splitting `script.js` into many files too early
- Creating unnecessary backend infrastructure
- Creating a database
- Adding authentication
- Adding fake weather data
- Creating fake radar maps
- Adding unsupported weather information
- Adding unnecessary dependencies
- Exposing API keys
- Changing core weather logic without testing
- Building the future Main Website inside this module

The Weather Module should become stable before it becomes large.

---

# 🤖 AI Development Rules

This project may be developed with multiple AI coding tools.

AI agents should follow these rules.

## 1. Read Before Changing

Before modifying a file:

- Inspect the current code.
- Understand existing relationships.
- Check selectors and IDs.
- Check API calls.
- Check how the file connects to other files.

Do not assume that an old version of the architecture is still correct.

---

## 2. Preserve Existing Logic

Do not rewrite working functionality simply to make the code look different.

Prefer:

```text
Small controlled improvement
```

over:

```text
Complete rewrite
```

---

## 3. Scope Changes

When asked to fix:

```text
HTML
CSS
paths
selectors
responsive layout
```

do not silently change:

```text
weather logic
API behavior
forecast interpretation
business rules
```

unless explicitly requested.

---

## 4. Real Data Rule

AI agents must never create fake values just to make the UI look complete.

If data is unavailable:

```text
Unknown
Unavailable
ไม่สามารถรับข้อมูลได้
```

is better than invented data.

---

## 5. API Changes

Before changing an API integration:

- Check the current implementation.
- Verify the expected response structure.
- Preserve existing error handling.
- Avoid changing providers without a reason.

---

## 6. No Secret Keys

Never commit real API keys.

Never put production credentials directly into frontend source code.

---

## 7. Test After Changes

After modifying code, verify at minimum:

```text
Page loads
Map loads
Weather loads
City selection works
Map selection works
GPS works
Rain information works
Responsive layout works
```

If a change affects only one part of the application, do not unnecessarily alter unrelated systems.

---

# 📌 Current Development Strategy

The project should be developed incrementally.

Preferred workflow:

```text
Understand
   ↓
Plan
   ↓
Change
   ↓
Test
   ↓
Verify
   ↓
Continue
```

Do not rush to build every planned feature at once.

Each major stage should leave the project in a working state.

---

# 📝 Development Notes

This README is also a continuity document.

When development stops and resumes later, this file should be checked first.

Before starting new work:

1. Read this README.
2. Check the current repository structure.
3. Inspect the current code.
4. Identify the current development phase.
5. Continue from the existing implementation.
6. Do not assume that planned features already exist.

The README describes the intended direction.

The actual source code is the current truth.

If the README and source code disagree, inspect the code and update the README when the new direction is confirmed.

---

# 🚀 Long-Term Vision

Rain-prophecy should become a reliable Weather Module that can eventually be reused by a larger AI-oriented website.

The long-term goal is not simply to display weather data.

The goal is to turn real weather data into information that people can understand and act on quickly.

The core idea remains:

> Real data → clear interpretation → simple decision support.

Everything else should support that goal.
