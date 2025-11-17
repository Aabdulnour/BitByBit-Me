# BitByBit – Grade 9 Math Tutor

BitByBit is an intelligent tutoring system focused on Grade 9 math. It ships a polished student experience (home dashboard, units, history, profile) alongside a teacher-facing overview that surfaces mastery, hint usage, and units that need attention. The goal of this sprint was to harden the MVP so the frontend can be deployed to Vercel without additional code changes.

## Running locally

### Backend (Flask API)
1. Create and activate a virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Export the Flask entry point (and optional dev settings), then run the server:
   ```bash
   export FLASK_APP=src.backend.main:create_app
   export FLASK_ENV=development  # optional, enables auto-reload
   flask run --reload
   ```
   The API listens on `http://127.0.0.1:5000` and is CORS-enabled for the Vite dev server.

### Frontend (Vite + React)
1. Install dependencies:
   ```bash
   cd src/frontend
   npm install
   ```
2. Start the dev server (defaults to `http://127.0.0.1:5173`):
   ```bash
   npm run dev
   ```
   The frontend proxies API calls to the Flask app above.

## Demo accounts
- **Student:** `student@example.com` / `password123`
- **Teacher:** `teacher@example.com` / `password123`

Sign in at `/login` for both roles. After logging in, student dashboards live at `/` and teacher analytics at `/teacher`.

## Main features
- **Student Home dashboard** – avatar greeting, recent activity strip, suggested next step logic, and quick navigation into units, history, and profile.
- **Units explorer & detail pages** – diagnostics, section previews, mastery bars, and actionable buttons with consistent loading/error/empty states.
- **History page** – sortable/filterable attempt table with chart, hint-usage helper text, and rich error handling.
- **Profile & avatar preview** – Ready Player Me placeholder, developer avatar URL override, and a stubbed “Open avatar editor” call-to-action.
- **Teacher overview** – summary cards, students table with hint usage/mastory tooltips, unit tiles that flag high hint usage or zero attempts, and a “Units that need attention” highlight plus student detail drawer chips.
