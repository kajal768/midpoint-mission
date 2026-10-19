# Midpoint Mission

An interactive React + Tailwind CSS learning app for Binary Search. It includes Home, learner Dashboard, Learn, Practice, Compare, Insights, and Results screens.

## Run on Windows (VS Code)

1. Extract the ZIP file.
2. Open the extracted `midpoint-mission` folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Run:

   ```powershell
   npm install
   npm run dev
   ```

5. Open the local URL Vite prints in the terminal (usually `http://localhost:5173`).
6. To stop the app, press `Ctrl + C` in the terminal.

The demo includes a small Express API. It records anonymous learning events in `data/activity.ndjson`, shows a learner's own progress on **Dashboard**, and shows all guest sessions on **Insights**. No account or personal information is collected. Guest IDs identify a browser profile, not a real person.

## Main files

- `src/App.jsx` — page flow, Binary Search state, practice logic, and comparison race
- `src/index.css` — Tailwind directives and custom visual styles
- `src/main.jsx` — React entry point
- `tailwind.config.js` — Tailwind content paths and theme
- `vite.config.js` — Vite + React setup
- `server.js` — local activity API and Insights summary
- `data/activity.ndjson` — activity history, created automatically when the server runs

## See what learners did

Open **Insights** in the top navigation. To test it, open the app in a second browser or private window, go to Learn or Practice, make a guess, then refresh Insights. Each browser profile receives its own anonymous Guest ID. The API is available at `http://localhost:5000/api/health`.

For a demo on another laptop, run the server on a network-accessible host and point Vite's `/api` proxy there; the included server binds to this computer only. This local demo has no admin authentication, so keep it on your own machine/network.

## Production build

```powershell
npm run build
```

The generated site is placed in `dist/`.
