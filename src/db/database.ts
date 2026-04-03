import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
	if (!db) {
		db = await SQLite.openDatabaseAsync("commitment.db");
	}
	return db;
}

// ─── Schema + Migrations ──────────────────────────────────────────────────────
export async function initDb() {
	const database = await getDb();

	await database.execAsync(`PRAGMA journal_mode = WAL;`);

	// Create tables without CHECK constraints so ALTER TABLE migrations work cleanly
	await database.execAsync(`
    CREATE TABLE IF NOT EXISTS commitments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT    NOT NULL,
      type          TEXT    NOT NULL DEFAULT 'daily',
      is_active     INTEGER NOT NULL DEFAULT 1,
      days_of_week  TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      commitment_id   INTEGER REFERENCES commitments(id) ON DELETE CASCADE,
      date            TEXT    NOT NULL,
      is_completed    INTEGER NOT NULL DEFAULT 0,
      completed_at    TEXT,
      ad_hoc_title    TEXT,
      log_type        TEXT    NOT NULL DEFAULT 'daily'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key    TEXT PRIMARY KEY,
      value  TEXT NOT NULL
    );
  `);

	// ── Migration 1: add days_of_week to commitments if missing ──
	try {
		await database.execAsync(`ALTER TABLE commitments ADD COLUMN days_of_week TEXT`);
	} catch (_) {
		/* already exists */
	}

	// ── Migration 2: add ad_hoc_title + log_type to daily_logs if missing ──
	try {
		await database.execAsync(`ALTER TABLE daily_logs ADD COLUMN ad_hoc_title TEXT`);
	} catch (_) {
		/* already exists */
	}
	try {
		await database.execAsync(`ALTER TABLE daily_logs ADD COLUMN log_type TEXT NOT NULL DEFAULT 'daily'`);
	} catch (_) {
		/* already exists */
	}

	// ── Migration 3: ensure commitment_id is nullable (v1 had it NOT NULL) ──
	// SQLite cannot ALTER COLUMN, so we do the standard rename→recreate→copy→drop.
	const tableInfo = await database.getAllAsync<{ name: string; notnull: number }>(`PRAGMA table_info(daily_logs)`);
	const cidCol = tableInfo.find((c) => c.name === "commitment_id");
	if (cidCol && cidCol.notnull === 1) {
		await database.execAsync(`
      PRAGMA foreign_keys = OFF;

      ALTER TABLE daily_logs RENAME TO daily_logs_old;

      CREATE TABLE daily_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        commitment_id   INTEGER REFERENCES commitments(id) ON DELETE CASCADE,
        date            TEXT    NOT NULL,
        is_completed    INTEGER NOT NULL DEFAULT 0,
        completed_at    TEXT,
        ad_hoc_title    TEXT,
        log_type        TEXT    NOT NULL DEFAULT 'daily'
      );

      INSERT INTO daily_logs
        (id, commitment_id, date, is_completed, completed_at, ad_hoc_title, log_type)
      SELECT
        id, commitment_id, date, is_completed, completed_at,
        ad_hoc_title,
        COALESCE(log_type, 'daily')
      FROM daily_logs_old;

      DROP TABLE daily_logs_old;

      PRAGMA foreign_keys = ON;
    `);
	}

	// Backfill any rows where log_type ended up NULL
	await database.execAsync(`UPDATE daily_logs SET log_type = 'daily' WHERE log_type IS NULL`);

	// Unique index (IF NOT EXISTS is idempotent)
	await database.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_commitment_date
      ON daily_logs(commitment_id, date)
      WHERE commitment_id IS NOT NULL;
  `);

	// Seed default settings
	await database.execAsync(`
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('evening_alarm_time',  '21:00'),
      ('morning_alarm_time',  '07:00'),
      ('snooze_minutes',      '10'),
      ('morning_alarm_on',    '1'),
      ('evening_alarm_on',    '1');
  `);
}

// ─── Types ───────────────────────────────────────────────────────────────────
export type CommitmentType = "daily" | "morning";

export interface Commitment {
	id: number;
	title: string;
	type: CommitmentType;
	is_active: number;
	days_of_week: string | null;
	created_at: string;
}

export interface DailyLog {
	id: number;
	commitment_id: number | null;
	date: string;
	is_completed: number;
	completed_at: string | null;
	ad_hoc_title: string | null;
	log_type: "daily" | "morning";
}

export interface DailyLogWithTitle extends DailyLog {
	title: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

function isoWeekday(date: Date): number {
	const d = date.getDay();
	return d === 0 ? 7 : d;
}

function appliesToDay(commitment: Commitment, date: Date): boolean {
	if (!commitment.days_of_week) return true;
	const dow = isoWeekday(date);
	return commitment.days_of_week.split(",").map(Number).includes(dow);
}

// ─── Commitment CRUD ─────────────────────────────────────────────────────────
export async function getCommitments(): Promise<Commitment[]> {
	const database = await getDb();
	return database.getAllAsync<Commitment>("SELECT * FROM commitments ORDER BY type, created_at ASC");
}

export async function getActiveCommitments(type?: CommitmentType): Promise<Commitment[]> {
	const database = await getDb();
	if (type) {
		return database.getAllAsync<Commitment>("SELECT * FROM commitments WHERE is_active = 1 AND type = ? ORDER BY created_at ASC", [type]);
	}
	return database.getAllAsync<Commitment>("SELECT * FROM commitments WHERE is_active = 1 ORDER BY created_at ASC");
}

export async function addCommitment(title: string, type: CommitmentType, daysOfWeek?: string | null): Promise<number> {
	const database = await getDb();
	const result = await database.runAsync("INSERT INTO commitments (title, type, days_of_week) VALUES (?, ?, ?)", [title, type, daysOfWeek ?? null]);
	return result.lastInsertRowId;
}

export async function updateCommitment(id: number, title: string, daysOfWeek: string | null) {
	const database = await getDb();
	await database.runAsync("UPDATE commitments SET title = ?, days_of_week = ? WHERE id = ?", [title, daysOfWeek, id]);
}

export async function toggleCommitmentActive(id: number, is_active: boolean) {
	const database = await getDb();
	await database.runAsync("UPDATE commitments SET is_active = ? WHERE id = ?", [is_active ? 1 : 0, id]);
}

export async function deleteCommitment(id: number) {
	const database = await getDb();
	await database.runAsync("DELETE FROM commitments WHERE id = ?", [id]);
}

// ─── Log seeding ─────────────────────────────────────────────────────────────
export async function seedTodayLogs() {
	const database = await getDb();
	const today = todayStr();
	const now = new Date();
	const active = await getActiveCommitments("daily");

	for (const c of active) {
		if (!appliesToDay(c, now)) continue;
		await database.runAsync(`INSERT OR IGNORE INTO daily_logs (commitment_id, date, log_type) VALUES (?, ?, 'daily')`, [c.id, today]);
	}
}

// ─── Today's logs ────────────────────────────────────────────────────────────
export async function getTodayDailyLogs(): Promise<DailyLogWithTitle[]> {
	const database = await getDb();
	const rows = await database.getAllAsync<DailyLog & { c_title: string }>(
		`SELECT dl.*, c.title as c_title
     FROM daily_logs dl
     JOIN commitments c ON c.id = dl.commitment_id
     WHERE dl.date = ? AND dl.log_type = 'daily' AND c.is_active = 1
     ORDER BY c.created_at ASC`,
		[todayStr()],
	);
	return rows.map((r) => ({ ...r, title: r.c_title }));
}

export async function getTodayMorningLogs(): Promise<DailyLogWithTitle[]> {
	const database = await getDb();
	const rows = await database.getAllAsync<DailyLog>(`SELECT * FROM daily_logs WHERE date = ? AND log_type = 'morning' ORDER BY id ASC`, [todayStr()]);
	return rows.map((r) => ({ ...r, title: r.ad_hoc_title ?? "" }));
}

// ─── Morning intention CRUD ───────────────────────────────────────────────────
export async function addMorningIntention(title: string): Promise<number> {
	const database = await getDb();
	const result = await database.runAsync(`INSERT INTO daily_logs (commitment_id, date, log_type, ad_hoc_title) VALUES (NULL, ?, 'morning', ?)`, [
		todayStr(),
		title.trim(),
	]);
	return result.lastInsertRowId;
}

export async function deleteMorningIntention(logId: number) {
	const database = await getDb();
	await database.runAsync("DELETE FROM daily_logs WHERE id = ? AND log_type = ?", [logId, "morning"]);
}

export async function markLogDone(logId: number, done: boolean) {
	const database = await getDb();
	await database.runAsync(`UPDATE daily_logs SET is_completed = ?, completed_at = ? WHERE id = ?`, [
		done ? 1 : 0,
		done ? new Date().toISOString() : null,
		logId,
	]);
}

// ─── Alarm dismiss conditions ─────────────────────────────────────────────────
export async function allDailyDoneToday(): Promise<boolean> {
	const database = await getDb();
	const row = await database.getFirstAsync<{ total: number; done: number }>(
		`SELECT COUNT(*) as total, SUM(dl.is_completed) as done
     FROM daily_logs dl
     JOIN commitments c ON c.id = dl.commitment_id
     WHERE dl.date = ? AND dl.log_type = 'daily' AND c.is_active = 1`,
		[todayStr()],
	);
	if (!row || row.total === 0) return true;
	return (row.done ?? 0) >= row.total;
}

export async function hasMorningIntentionsToday(): Promise<boolean> {
	const database = await getDb();
	const row = await database.getFirstAsync<{ total: number }>(`SELECT COUNT(*) as total FROM daily_logs WHERE date = ? AND log_type = 'morning'`, [
		todayStr(),
	]);
	return (row?.total ?? 0) > 0;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
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

// ─── Trends (future) ──────────────────────────────────────────────────────────
export async function getCompletionsByDateRange(from: string, to: string) {
	const database = await getDb();
	return database.getAllAsync(
		`SELECT dl.date, COUNT(*) as total, SUM(dl.is_completed) as done
     FROM daily_logs dl WHERE dl.date BETWEEN ? AND ?
     GROUP BY dl.date ORDER BY dl.date ASC`,
		[from, to],
	);
}
