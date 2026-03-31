import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { getSetting } from "../db/database";

// How notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

export const EVENING_ALARM_ID = "evening-alarm";
export const MORNING_ALARM_ID = "morning-alarm";

export async function requestNotificationPermissions(): Promise<boolean> {
	if (!Device.isDevice) return false; // simulators can't do push
	const { status: existing } = await Notifications.getPermissionsAsync();
	if (existing === "granted") return true;
	const { status } = await Notifications.requestPermissionsAsync();
	return status === "granted";
}

function parseTime(hhmm: string): { hour: number; minute: number } {
	const [h, m] = hhmm.split(":").map(Number);
	return { hour: h, minute: m };
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export async function scheduleEveningAlarm() {
	const timeStr = (await getSetting("evening_alarm_time")) ?? "21:00";
	const enabled = (await getSetting("evening_alarm_on")) ?? "1";
	if (enabled !== "1") {
		await cancelAlarm(EVENING_ALARM_ID);
		return;
	}

	await cancelAlarm(EVENING_ALARM_ID);
	const { hour, minute } = parseTime(timeStr);

	await Notifications.scheduleNotificationAsync({
		identifier: EVENING_ALARM_ID,
		content: {
			title: "🔔 Commitment Check",
			body: "Time to review your day. Did you follow through?",
			sound: true,
			priority: Notifications.AndroidNotificationPriority.MAX,
			vibrate: [0, 500, 200, 500],
			data: { type: "evening" },
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DAILY,
			hour,
			minute,
		},
	});
}

export async function scheduleMorningAlarm() {
	const timeStr = (await getSetting("morning_alarm_time")) ?? "07:00";
	const enabled = (await getSetting("morning_alarm_on")) ?? "1";
	if (enabled !== "1") {
		await cancelAlarm(MORNING_ALARM_ID);
		return;
	}

	await cancelAlarm(MORNING_ALARM_ID);
	const { hour, minute } = parseTime(timeStr);

	await Notifications.scheduleNotificationAsync({
		identifier: MORNING_ALARM_ID,
		content: {
			title: "☀️ Good Morning",
			body: "What are your commitments for today?",
			sound: true,
			priority: Notifications.AndroidNotificationPriority.MAX,
			vibrate: [0, 300, 100, 300],
			data: { type: "morning" },
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DAILY,
			hour,
			minute,
		},
	});
}

export async function scheduleSnooze(type: "evening" | "morning") {
	const snoozeStr = (await getSetting("snooze_minutes")) ?? "10";
	const snoozeMins = parseInt(snoozeStr, 10);
	const snoozeId = type === "evening" ? EVENING_ALARM_ID + "-snooze" : MORNING_ALARM_ID + "-snooze";

	await cancelAlarm(snoozeId);

	await Notifications.scheduleNotificationAsync({
		identifier: snoozeId,
		content: {
			title: type === "evening" ? "🔔 Commitment Check (Snooze)" : "☀️ Morning Check (Snooze)",
			body: type === "evening" ? "Still waiting… tick off your commitments!" : "Don't forget to set today's goals!",
			sound: true,
			priority: Notifications.AndroidNotificationPriority.MAX,
			vibrate: [0, 500, 200, 500],
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
	const snoozeId = type === "evening" ? EVENING_ALARM_ID + "-snooze" : MORNING_ALARM_ID + "-snooze";
	await cancelAlarm(snoozeId);
}

export async function rescheduleAll() {
	await scheduleEveningAlarm();
	await scheduleMorningAlarm();
}
