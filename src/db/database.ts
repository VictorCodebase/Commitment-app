import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
	if (!db) {
		db = await SQLite.openDatabaseAsync("commitment.db");
	}
	return db;
}

// ─── Schema ────────────────────────────────────────────────────────────────
export async function initDb() {
	const database = await getDb();

	await database.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Commitments: the things you want to do
    CREATE TABLE IF NOT EXISTS commitments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      type        TEXT    NOT NULL CHECK(type IN ('daily','morning')),
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Daily logs: one row per commitment per calendar day
    CREATE TABLE IF NOT EXISTS daily_logs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      commitment_id  INTEGER NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
      date           TEXT    NOT NULL,   -- YYYY-MM-DD
      is_completed   INTEGER NOT NULL DEFAULT 0,
      completed_at   TEXT,              -- ISO datetime
      UNIQUE(commitment_id, date)
    );

    -- Settings: simple key/value store
    CREATE TABLE IF NOT EXISTS settings (
      key    TEXT PRIMARY KEY,
      value  TEXT NOT NULL
    );
  `);

	// Seed defaults if missing
	await database.execAsync(`
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('evening_alarm_time',  '21:00'),
      ('morning_alarm_time',  '07:00'),
      ('snooze_minutes',      '10'),
      ('morning_alarm_on',    '1'),
      ('evening_alarm_on',    '1');
  `);
}

// ─── Commitment CRUD ────────────────────────────────────────────────────────
export type CommitmentType = "daily" | "morning";

export interface Commitment {
	id: number;
	title: string;
	type: CommitmentType;
	is_active: number;
	created_at: string;
}

export async function getCommitments(): Promise<Commitment[]> {
	const database = await getDb();
	return database.getAllAsync<Commitment>("SELECT * FROM commitments ORDER BY created_at ASC");
}

export async function getActiveCommitments(type?: CommitmentType): Promise<Commitment[]> {
	const database = await getDb();
	if (type) {
		return database.getAllAsync<Commitment>("SELECT * FROM commitments WHERE is_active = 1 AND type = ? ORDER BY created_at ASC", [type]);
	}
	return database.getAllAsync<Commitment>("SELECT * FROM commitments WHERE is_active = 1 ORDER BY created_at ASC");
}

export async function addCommitment(title: string, type: CommitmentType): Promise<number> {
	const database = await getDb();
	const result = await database.runAsync("INSERT INTO commitments (title, type) VALUES (?, ?)", [title, type]);
	return result.lastInsertRowId;
}

export async function toggleCommitmentActive(id: number, is_active: boolean) {
	const database = await getDb();
	await database.runAsync("UPDATE commitments SET is_active = ? WHERE id = ?", [is_active ? 1 : 0, id]);
}

export async function deleteCommitment(id: number) {
	const database = await getDb();
	await database.runAsync("DELETE FROM commitments WHERE id = ?", [id]);
}

// ─── Daily Logs ─────────────────────────────────────────────────────────────
export interface DailyLog {
	id: number;
	commitment_id: number;
	date: string;
	is_completed: number;
	completed_at: string | null;
}

export interface DailyLogWithTitle extends DailyLog {
	title: string;
	type: CommitmentType;
}

export function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Ensure every active commitment has a log row for today */
export async function seedTodayLogs() {
	const database = await getDb();
	const today = todayStr();
	const active = await getActiveCommitments();
	for (const c of active) {
		await database.runAsync("INSERT OR IGNORE INTO daily_logs (commitment_id, date) VALUES (?, ?)", [c.id, today]);
	}
}

export async function getTodayLogs(): Promise<DailyLogWithTitle[]> {
	const database = await getDb();
	return database.getAllAsync<DailyLogWithTitle>(
		`
    SELECT dl.*, c.title, c.type
    FROM daily_logs dl
    JOIN commitments c ON c.id = dl.commitment_id
    WHERE dl.date = ? AND c.is_active = 1
    ORDER BY c.type, c.created_at
  `,
		[todayStr()],
	);
}

export async function markCommitmentDone(logId: number, done: boolean) {
	const database = await getDb();
	await database.runAsync(
		`UPDATE daily_logs
     SET is_completed = ?, completed_at = ?
     WHERE id = ?`,
		[done ? 1 : 0, done ? new Date().toISOString() : null, logId],
	);
}

/** Are ALL active evening (daily) commitments done today? */
export async function allDailyDoneToday(): Promise<boolean> {
	const database = await getDb();
	const row = await database.getFirstAsync<{ total: number; done: number }>(
		`
    SELECT
      COUNT(*) as total,
      SUM(dl.is_completed) as done
    FROM daily_logs dl
    JOIN commitments c ON c.id = dl.commitment_id
    WHERE dl.date = ? AND c.is_active = 1 AND c.type = 'daily'
  `,
		[todayStr()],
	);
	if (!row || row.total === 0) return true;
	return row.done >= row.total;
}

/** Are ALL morning commitments entered for today? (at least 1 morning log) */
export async function morningCommitmentsSetToday(): Promise<boolean> {
	const database = await getDb();
	const row = await database.getFirstAsync<{ total: number }>(
		`
    SELECT COUNT(*) as total
    FROM daily_logs dl
    JOIN commitments c ON c.id = dl.commitment_id
    WHERE dl.date = ? AND c.is_active = 1 AND c.type = 'morning'
  `,
		[todayStr()],
	);
	return (row?.total ?? 0) > 0;
}

// ─── Settings ───────────────────────────────────────────────────────────────
export async function getSetting(key: string): Promise<string | null> {
	const database = await getDb();
	const row = await database.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
	return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
	const database = await getDb();
	await database.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
}

export async function getAllSettings(): Promise<Record<string, string>> {
	const database = await getDb();
	const rows = await database.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings");
	return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ─── Trends helpers (for future use) ────────────────────────────────────────
export async function getCompletionsByDateRange(from: string, to: string): Promise<{ date: string; total: number; done: number }[]> {
	const database = await getDb();
	return database.getAllAsync(
		`
    SELECT
      dl.date,
      COUNT(*) as total,
      SUM(dl.is_completed) as done
    FROM daily_logs dl
    JOIN commitments c ON c.id = dl.commitment_id
    WHERE dl.date BETWEEN ? AND ? AND c.is_active = 1
    GROUP BY dl.date
    ORDER BY dl.date ASC
  `,
		[from, to],
	);
}
