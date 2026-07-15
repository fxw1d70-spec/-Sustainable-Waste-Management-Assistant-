# ♻️ WasteGuide AI — Sustainable Waste Management Assistant

A web-based smart-city civic application that helps urban residents **identify
waste items, get AI-generated disposal instructions, understand recycling
procedures, and locate nearby waste collection centers.**

Users enter a waste item on a single-page dashboard and instantly receive a
complete AI-powered guide: waste category, disposal steps, hazard warnings,
recycling instructions, and eco-friendly suggestions.

## Tech stack

| Layer     | Technology                                             |
| --------- | ------------------------------------------------------ |
| Frontend  | React.js (Vite) · Tailwind CSS · Chart.js · Leaflet.js |
| Backend   | Flask (Python)                                         |
| AI        | Groq API — `llama-3.3-70b-versatile`                   |
| Database  | Firebase Firestore                                     |
| Maps      | Leaflet.js + OpenStreetMap (no paid API key)           |

> **Runs with zero keys.** Without a Groq key the backend uses a built-in
> rule-based classifier; without Firebase it stores scan history in a local
> JSON file. Add real keys in `backend/.env` whenever you're ready.

---

## Project structure

```
wilfred/
├── backend/
│   ├── app.py                     # Flask API (classify, history, centers, analytics)
│   ├── ai_service.py              # Groq integration + rule-based fallback
│   ├── store_service.py           # Firestore + local-JSON fallback
│   ├── data/
│   │   └── collection_centers.json  # Seeded map data
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx                 # Routing + navbar
    │   ├── api.js                  # Axios client
    │   └── pages/
    │       ├── Scanner.jsx         # Waste scanner + AI guide + history
    │       ├── MapPage.jsx         # Leaflet map of collection centers
    │       └── Dashboard.jsx       # Chart.js analytics
    ├── package.json
    └── vite.config.js
```

---

## Getting started

### 1. Backend (Flask · port 5000)

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env          # optional: add GROQ_API_KEY / FIREBASE_CREDENTIALS
python app.py
```

The API serves on **http://localhost:5000**. Startup logs show which AI and
store backends are active.

### 2. Frontend (React · port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api/*` to the Flask backend.

---

## Enabling the real integrations

**Groq AI** — get a free key at <https://console.groq.com/keys>, then in
`backend/.env`:

```
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

**Firebase Firestore** — create a project, download a service-account JSON, and
point to it:

```
FIREBASE_CREDENTIALS=C:/path/to/serviceAccount.json
```

Restart the backend after editing `.env`.

---

## API reference

| Method | Endpoint         | Description                              |
| ------ | ---------------- | ---------------------------------------- |
| GET    | `/api/health`    | Active AI + store backend                |
| POST   | `/api/classify`  | `{ item, user_id }` → full disposal guide |
| GET    | `/api/history`   | `?user_id=` → scan history               |
| DELETE | `/api/history`   | `{ user_id }` → clear history            |
| GET    | `/api/centers`   | `?type=` → collection centers            |
| GET    | `/api/analytics` | `?user_id=` → dashboard stats            |

---

## Scenarios covered

1. **Battery** → Hazardous Waste, heavy-metal hazard warning, certified drop-off, rechargeable suggestion.
2. **Plastic bottle** → Plastic Waste, recyclable, rinse/cap steps, reusable-bottle tip — saved to history.
3. **Map page** → color-coded markers for recycling / e-waste / organic / hazardous with address, hours, accepted types, contact.
4. **Dashboard** → doughnut (recyclable vs not), 7-day line chart, category bar chart, and summary stats.
