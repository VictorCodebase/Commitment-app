# Commitment App

A minimal accountability app that forces you to keep your commitments through alarms.

## Setup

```bash
# 1. Copy this folder into your workspace and install deps
cd commitment-app
npm install

# 2. Start Expo
npx expo start
```

> **Note:** You need a physical device (or Expo Go) for notifications/alarms to work.  
> On iOS simulators, notifications are limited. Android emulators work better.

---

## Features

- **Daily commitments** — recurring things you do every day (e.g. "Run 3km")
- **Morning commitments** — goals you set each morning (e.g. "Finish the report")
- **Evening alarm** — rings at your chosen time; dismiss it by ticking off all daily commitments
- **Morning alarm** — rings in the morning; dismiss it by having at least one morning commitment set
- **Snooze** — both alarms snooze for your configured duration if not dismissed
- **Pause commitments** — tap the dot on any commitment to pause it without deleting

---

## Structure

```
app/
  _layout.tsx             ← Tab navigation
  index.tsx               ← Today (home)
  commitments.tsx
  settings.tsx

src/
  components/
    AlarmModal.tsx         ← Full-screen alarm overlay with sound
    DayOfWeekPicker.tsx    ← Day selector component
  db/
    database.ts            ← SQLite schema + all queries
  screens/
    HomeScreen.tsx
    CommitmentsScreen.tsx
    SettingsScreen.tsx
  utils/
    notifications.ts       ← Alarm scheduling + expo-av sound
    theme.ts
```

---

## Database Schema

```sql
commitments   (id, title, type, is_active, created_at)
daily_logs    (id, commitment_id, date, is_completed, completed_at)
settings      (key, value)
```

The `daily_logs` table is designed for trend queries — you can later query:

- Completion rate over time
- Streaks per commitment
- Best/worst days of week

---

## Extending for Trends

The `getCompletionsByDateRange(from, to)` function in `database.ts` is already there.
To build a trends screen later, just add a new tab and query that function.

---

## Permissions Required

- **Notifications** — for alarms (prompted on first launch)
- **Android:** `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`
- **iOS:** Background fetch (configured in app.json)
