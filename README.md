# Bodybuilding tracker

A personal, mobile-first React + TypeScript workout tracker with an Express API and JSON persistence. Black and white, large controls, no accounts or database.

## Run locally

Use Node.js 22 or newer. From the repository root:

```sh
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to Express on port 3001. Both bind to your local network. On an iPhone on the same Wi-Fi, open `http://YOUR_MAC_LAN_IP:5173`. Keep the Mac/server running. Use the same address consistently on your iPhone because recovery data belongs to that browser origin.

## Production

```sh
npm run build
npm start
```

Open http://localhost:3001, or `http://YOUR_SERVER_LAN_IP:3001` on another device. Express serves both the built frontend and API. `PORT` changes the server port; `DATA_FILE` selects another absolute history path. For access away from your home network, run this behind a private network or an HTTPS reverse proxy. There is no authentication; anyone who can reach the API can append data.

## Data and configuration

- `server/data/workouts.json`: permanent workout history, initialized with your five imported sessions. Back this file up regularly.
- `client/src/data/exercises.json`: names, sets (five by default), target reps, tutorial searches, and load type. `position` supports machine positions with an up/down direction. Weight controls use 2 kg steps and also allow direct numeric entry. Plank records average seconds in `averageReps` and shows SEC in the UI.
- `client/src/data/workouts.json`: scheduled strength sessions and optional Legs, Abs, Cycling, and Cardio.
- `client/src/data/schedule.json`: Monday through Sunday workout IDs. The app selects today's workout using the device's local weekday. Rebuild after editing configuration in production.

The supplied imported history remains intact, including older exercise IDs, set counts, machine positions, and null durations. Preacher Curl and Triceps Pushdown use explicit historical aliases for their GX1 variants. Other renamed exercises remain distinct. Null duration means it was not recorded; it is shown as a dash and is never guessed.

## During a workout

START WORKOUT opens a warm-up step with an elapsed timer. START FIRST EXERCISE (or Enter / Space) begins the exercise and set timers from zero. Warm-up time is included in total strength workout duration, while each exercise duration starts when that exercise begins. The warm-up step is recoverable after refresh. Only one exercise appears at a time. Latest historical load is suggested without increases. Change load/reps with the large controls or type values directly. START REST records the current set and starts rest; START SET ends rest and starts the next set. The fifth START REST calculates average reps and starts the final rest with UP NEXT visible. UP NEXT first appears during the final set, not the rest before it. Prepare the next load, then press START NEXT EXERCISE, Enter, or Space to begin its first set. Every exercise ends with rest, including the final exercise. FINISH WORKOUT (or Enter / Space) ends the final rest and saves the workout. Each exercise duration includes its final rest.

Enter and Space both perform the main START REST / START SET action, including while weight or reps inputs are focused. Numpad Enter works too. Space prevents page scrolling during the workout. Shortcuts ignore selects, text areas, and editable text. Only one timer is visible: SET during a set, REST while resting. Exercise and workout durations are still measured for history. The visible timer turns red after 69 seconds without taking any action. All timers calculate actual elapsed time from timestamps, including time while Safari is in the background.

Cardio is a simple elapsed-time session: select an activity, then finish it. Completed activities are recorded separately from strength workouts.

## Sync and recovery

The server JSON is the source of truth shared by iPhone and Mac. An active workout is temporary browser localStorage data and can be resumed after refresh. Completed workouts awaiting sync are also saved temporarily on that device. A warning appears on failure; the app retries every 15 seconds, on focus, and when the connection returns. Do not clear browser storage while a workout is unfinished or waiting to sync.

Before saving, the client fetches current server history and merges pending records by their compact unique ID. ETag / If-Match conflict checks reject stale updates and retry against the latest version. The server also rejects removal of any previous record. Writes are serialized and use a temporary file followed by atomic rename. Run a single server process for this data file.

New strength records contain only date, workout ID, a unique ID, total duration, and one result per exercise (load, average reps, exercise duration). Individual set reps and timer ticks never reach permanent history. Imported extra metadata is preserved. The imported `dailyTotals` is retained as supplied legacy data; no generated dashboard or daily totals feature uses it.

## API and verification

- `GET /api/health`: verifies the data file is readable.
- `GET /api/workouts`: returns history with an ETag.
- `PUT /api/workouts`: saves complete history; requires the latest ETag in `If-Match`. Existing records must remain unchanged.

```sh
npm test
npm run build
```

The tests cover history preservation, concurrent stale saves, atomic persistence, validation, and imported unknown durations.

## Docker and svemar04 deployment

Deploy from this directory with Node/npm, Java (for the Gradle wrapper), rsync, and SSH access configured:

```sh
./gradlew upload-to-svemar04
```

This runs the production build and tests, syncs sources to `svemar@svemar04.local:~/MyApps/gym-react-app/source`, builds the image on the server, and starts `gym-react-app` with automatic restart. Open http://svemar04.local:5004. `deployDocker-svemar04` is an alias for the same task.

History lives at `~/MyApps/gym-react-app/data/workouts.json` on the server. The initial deployment seeds the imported history only if that file does not exist. Redeployments preserve it and create a timestamped backup before replacing the container. A failed image build leaves the running container intact; deployment waits for the API health check before reporting success.

To run Docker locally:

```sh
docker build -t gym-react-app .
docker run -d --name gym-react-app -p 3001:3001 -v gym-history:/app/data gym-react-app
```

## Body weight

The home page always shows the latest body weight and its recorded date, with a graph of previous readings. Edit the visible KG input and press Enter or leave the field to save a changed weight automatically with the current local JavaScript date; select graph points to inspect older values. Multiple readings on one date are kept, and the newest entry for that date appears as current.

`server/data/body-weight.json` stores body weight separately from workouts. `server/seed/body-weight.json` contains the 12 imported weekly readings from 22 June to 7 September 2026 (latest: 80.70 kg). The server initializes the file only when missing. On svemar04 it lives at `~/MyApps/gym-react-app/data/body-weight.json`, in the existing persistent Docker mount. Redeployments preserve readings and back up both JSON histories. `BODY_WEIGHT_FILE` can override its location.

New readings wait in device storage if offline and retry every 15 seconds, on focus, and on reconnect. The latest fetched history is cached for display. Server writes are atomic and serialized; retried reading IDs do not create duplicates.

- `GET /api/body-weight`: read body-weight history.
- `POST /api/body-weight`: append `{ "id": "unique-id", "date": "2026-09-13", "kg": 80.70 }`.

During an active workout (warm-up, sets, and rests), the app requests a screen wake lock and reacquires it when returning to the page. It releases the lock when leaving the workout. On a phone this requires serving the app over HTTPS; HTTP LAN addresses such as `http://svemar04.local` cannot use this browser API. The operating system can also refuse it in low-power mode.
