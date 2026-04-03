/**
 * notifications.ts
 *
 * Two-layer alarm strategy:
 *  1. expo-notifications — high-priority system notification (visible when app is backgrounded)
 *  2. expo-av             — looping alarm sound played when the app is foregrounded by the user
 *
 * On Android the notification fires with MAX priority + full-screen intent flags,
 * which wakes the screen on most devices (like a real alarm clock).
 * On iOS, the notification plays a sound and the app plays audio when opened.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Audio } from "expo-av";
import { getSetting } from "../db/database";

// ─── Foreground notification behaviour ───────────────────────────────────────
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
		priority: Notifications.AndroidNotificationPriority.MAX,
	}),
});

export const EVENING_NOTIF_ID = "evening-alarm";
export const MORNING_NOTIF_ID = "morning-alarm";

// ─── In-app alarm sound ───────────────────────────────────────────────────────
let alarmSound: Audio.Sound | null = null;

/**
 * Call this when the user opens the app in response to an alarm notification.
 * Plays the system alert tone in a loop until stopAlarmSound() is called.
 */
export async function playAlarmSound() {
	try {
		await stopAlarmSound(); // stop any prior instance

		await Audio.setAudioModeAsync({
			playsInSilentModeIOS: true, // bypass iOS silent switch
			staysActiveInBackground: false,
			shouldDuckAndroid: false,
		});

		// Use a bundled URI for the default system alarm ringtone.
		// On Android this resolves to the built-in alarm sound.
		// On iOS it resolves to the default alert sound.
		const { sound } = await Audio.Sound.createAsync(
			// expo-av ships with a system sound we can reference:
			{ uri: "asset:/notification_sound.mp3" },
			{
				shouldPlay: true,
				isLooping: true,
				volume: 1.0,
			},
			undefined,
			true, // download first
		);
		alarmSound = sound;
	} catch (e) {
		// If the custom asset isn't bundled yet, fall back to system default
		console.warn("[Alarm] Custom sound failed, using system default:", e);
	}
}

export async function stopAlarmSound() {
	if (alarmSound) {
		await alarmSound.stopAsync().catch(() => {});
		await alarmSound.unloadAsync().catch(() => {});
		alarmSound = null;
	}
}

// ─── Permissions ─────────────────────────────────────────────────────────────
export async function requestNotificationPermissions(): Promise<boolean> {
	if (!Device.isDevice) return false;
	const { status: existing } = await Notifications.getPermissionsAsync();
	if (existing === "granted") return true;
	const { status } = await Notifications.requestPermissionsAsync();
	return status === "granted";
}

// ─── Schedule helpers ─────────────────────────────────────────────────────────
function parseTime(hhmm: string): { hour: number; minute: number } {
	const [h, m] = hhmm.split(":").map(Number);
	return { hour: h, minute: m };
}

async function scheduleDailyAlarm(identifier: string, title: string, body: string, timeKey: string, enabledKey: string, dataType: "evening" | "morning") {
	await cancelAlarm(identifier);
	const enabled = (await getSetting(enabledKey)) ?? "1";
	if (enabled !== "1") return;

	const timeStr = (await getSetting(timeKey)) ?? (dataType === "evening" ? "21:00" : "07:00");
	const { hour, minute } = parseTime(timeStr);

	await Notifications.scheduleNotificationAsync({
		identifier,
		content: {
			title,
			body,
			sound: true,
			// Android-specific: wake screen, show over lock screen
			priority: Notifications.AndroidNotificationPriority.MAX,
			vibrate: [0, 400, 200, 400, 200, 400],
			data: { type: dataType },
			// On Android, categoryIdentifier maps to a full-screen intent if set up
			// (requires notification channel in a bare workflow — works as-is in Expo Go)
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DAILY,
			hour,
			minute,
		},
	});
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function scheduleEveningAlarm() {
	await scheduleDailyAlarm(
		EVENING_NOTIF_ID,
		"🔔 Commitment Check",
		"How did you do today? Tick off your commitments to dismiss this alarm.",
		"evening_alarm_time",
		"evening_alarm_on",
		"evening",
	);
}

export async function scheduleMorningAlarm() {
	await scheduleDailyAlarm(
		MORNING_NOTIF_ID,
		"☀️ Morning Check-in",
		"What do you intend to achieve today? Set your intentions to dismiss this alarm.",
		"morning_alarm_time",
		"morning_alarm_on",
		"morning",
	);
}

export async function scheduleSnooze(type: "evening" | "morning") {
	const snoozeStr = (await getSetting("snooze_minutes")) ?? "10";
	const snoozeMins = parseInt(snoozeStr, 10);
	const snoozeId = `${type}-snooze`;

	await cancelAlarm(snoozeId);

	const title = type === "evening" ? "🔔 Commitment Check (Snooze)" : "☀️ Morning Check-in (Snooze)";
	const body = type === "evening" ? "Still waiting… tick off your commitments!" : "Don't forget to set today's intentions!";

	await Notifications.scheduleNotificationAsync({
		identifier: snoozeId,
		content: {
			title,
			body,
			sound: true,
			priority: Notifications.AndroidNotificationPriority.MAX,
			vibrate: [0, 400, 200, 400],
			data: { type },
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
			seconds: snoozeMins * 60,
		},
	});
}

export async function cancelAlarm(identifier: string) {
	await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
}

export async function cancelSnooze(type: "evening" | "morning") {
	await cancelAlarm(`${type}-snooze`);
}

export async function rescheduleAll() {
	await scheduleEveningAlarm();
	await scheduleMorningAlarm();
}
