import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform, ScrollView } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getAllSettings, setSetting } from "../db/database";
import { rescheduleAll } from "../utils/notifications";
import { colors, spacing, radius } from "../utils/theme";

type Settings = Record<string, string>;

function timeStringToDate(hhmm: string): Date {
	const [h, m] = hhmm.split(":").map(Number);
	const d = new Date();
	d.setHours(h, m, 0, 0);
	return d;
}

function dateToTimeString(d: Date): string {
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatTime(hhmm: string): string {
	const [h, m] = hhmm.split(":").map(Number);
	const ampm = h >= 12 ? "PM" : "AM";
	const hour12 = h % 12 || 12;
	return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function SettingsScreen() {
	const [settings, setSettings] = useState<Settings>({});
	const [saved, setSaved] = useState(false);

	// Which picker is open
	const [openPicker, setOpenPicker] = useState<"evening" | "morning" | null>(null);

	const load = useCallback(async () => {
		setSettings(await getAllSettings());
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load]),
	);

	const update = (key: string, value: string) => {
		setSettings((prev) => ({ ...prev, [key]: value }));
	};

	const handleSave = async () => {
		for (const [key, value] of Object.entries(settings)) {
			await setSetting(key, value);
		}
		await rescheduleAll();
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	};

	const handleTimeChange = (event: DateTimePickerEvent, date: Date | undefined, key: string) => {
		// On Android, the picker dismisses itself on selection
		if (Platform.OS === "android") setOpenPicker(null);
		if (event.type === "set" && date) {
			update(key, dateToTimeString(date));
		}
		if (event.type === "dismissed") setOpenPicker(null);
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
			<View style={styles.header}>
				<Text style={styles.title}>Settings</Text>
			</View>

			{/* ── Evening alarm ── */}
			<SettingsSection label="Evening Check-in">
				<SettingsRow label="Enabled">
					<Switch
						value={settings["evening_alarm_on"] === "1"}
						onValueChange={(v) => update("evening_alarm_on", v ? "1" : "0")}
						trackColor={{ false: colors.border, true: colors.daily + "99" }}
						thumbColor={settings["evening_alarm_on"] === "1" ? colors.daily : colors.textMuted}
					/>
				</SettingsRow>
				<SettingsRow label="Alarm time" isLast>
					<TouchableOpacity style={styles.timePill} onPress={() => setOpenPicker(openPicker === "evening" ? null : "evening")}>
						<Ionicons name="time-outline" size={14} color={colors.daily} />
						<Text style={[styles.timePillText, { color: colors.daily }]}>
							{formatTime(settings["evening_alarm_time"] ?? "21:00")}
						</Text>
					</TouchableOpacity>
				</SettingsRow>

				{openPicker === "evening" && (
					<View style={styles.pickerWrapper}>
						<DateTimePicker
							mode="time"
							display={Platform.OS === "ios" ? "spinner" : "default"}
							value={timeStringToDate(settings["evening_alarm_time"] ?? "21:00")}
							onChange={(e, d) => handleTimeChange(e, d, "evening_alarm_time")}
							themeVariant="dark"
							textColor={colors.textPrimary}
							accentColor={colors.daily}
						/>
						{Platform.OS === "ios" && (
							<TouchableOpacity style={styles.pickerDone} onPress={() => setOpenPicker(null)}>
								<Text style={styles.pickerDoneText}>Done</Text>
							</TouchableOpacity>
						)}
					</View>
				)}
			</SettingsSection>

			{/* ── Morning alarm ── */}
			<SettingsSection label="Morning Check-in">
				<SettingsRow label="Enabled">
					<Switch
						value={settings["morning_alarm_on"] === "1"}
						onValueChange={(v) => update("morning_alarm_on", v ? "1" : "0")}
						trackColor={{ false: colors.border, true: colors.morning + "99" }}
						thumbColor={settings["morning_alarm_on"] === "1" ? colors.morning : colors.textMuted}
					/>
				</SettingsRow>
				<SettingsRow label="Alarm time" isLast>
					<TouchableOpacity style={styles.timePill} onPress={() => setOpenPicker(openPicker === "morning" ? null : "morning")}>
						<Ionicons name="time-outline" size={14} color={colors.morning} />
						<Text style={[styles.timePillText, { color: colors.morning }]}>
							{formatTime(settings["morning_alarm_time"] ?? "07:00")}
						</Text>
					</TouchableOpacity>
				</SettingsRow>

				{openPicker === "morning" && (
					<View style={styles.pickerWrapper}>
						<DateTimePicker
							mode="time"
							display={Platform.OS === "ios" ? "spinner" : "default"}
							value={timeStringToDate(settings["morning_alarm_time"] ?? "07:00")}
							onChange={(e, d) => handleTimeChange(e, d, "morning_alarm_time")}
							themeVariant="dark"
							textColor={colors.textPrimary}
							accentColor={colors.morning}
						/>
						{Platform.OS === "ios" && (
							<TouchableOpacity style={styles.pickerDone} onPress={() => setOpenPicker(null)}>
								<Text style={styles.pickerDoneText}>Done</Text>
							</TouchableOpacity>
						)}
					</View>
				)}
			</SettingsSection>

			{/* ── Snooze ── */}
			<SettingsSection label="Snooze Duration">
				<View style={styles.snoozeGrid}>
					{[5, 10, 15, 20, 30].map((mins) => {
						const active = settings["snooze_minutes"] === String(mins);
						return (
							<TouchableOpacity
								key={mins}
								style={[styles.snoozeBtn, active && styles.snoozeBtnActive]}
								onPress={() => update("snooze_minutes", String(mins))}
							>
								<Text style={[styles.snoozeBtnText, active && styles.snoozeBtnTextActive]}>{mins} min</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</SettingsSection>

			{/* ── Save ── */}
			<TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
				{saved ? (
					<>
						<Ionicons name="checkmark" size={18} color="#000" />
						<Text style={styles.saveBtnText}>Saved!</Text>
					</>
				) : (
					<Text style={styles.saveBtnText}>Save & Apply Alarms</Text>
				)}
			</TouchableOpacity>

			<Text style={styles.note}>
				Alarms fire as high-priority notifications. Make sure notification permissions are granted in device settings for them to wake
				your screen.
			</Text>
		</ScrollView>
	);
}

// ─── Layout helpers ──────────────────────────────────────────────────────────
function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<View style={styles.section}>
			<Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
			<View style={styles.sectionBody}>{children}</View>
		</View>
	);
}

function SettingsRow({ label, isLast, children }: { label: string; isLast?: boolean; children: React.ReactNode }) {
	return (
		<View style={[styles.row, isLast && styles.rowLast]}>
			<Text style={styles.rowLabel}>{label}</Text>
			{children}
		</View>
	);
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.bg },
	content: { paddingBottom: 100 },
	header: {
		paddingTop: Platform.OS === "ios" ? 60 : 40,
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	title: { fontSize: 36, fontWeight: "700", color: colors.textPrimary },
	section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.sm },
	sectionLabel: {
		fontSize: 11,
		fontWeight: "600",
		color: colors.textSecondary,
		letterSpacing: 1.5,
		marginBottom: spacing.xs,
	},
	sectionBody: {
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		overflow: "hidden",
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: spacing.md,
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	rowLast: { borderBottomWidth: 0 },
	rowLabel: { fontSize: 15, color: colors.textPrimary },
	timePill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: spacing.md,
		paddingVertical: 7,
		borderRadius: radius.sm,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surfaceAlt,
	},
	timePillText: { fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
	pickerWrapper: {
		borderTopWidth: 1,
		borderTopColor: colors.border,
		backgroundColor: colors.surfaceAlt,
	},
	pickerDone: {
		alignSelf: "flex-end",
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
	},
	pickerDoneText: { color: colors.accent, fontWeight: "700", fontSize: 15 },
	snoozeGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
		padding: spacing.md,
	},
	snoozeBtn: {
		paddingHorizontal: spacing.md,
		paddingVertical: 9,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	snoozeBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
	snoozeBtnText: { fontSize: 14, color: colors.textSecondary },
	snoozeBtnTextActive: { color: "#000", fontWeight: "700" },
	saveBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
		marginHorizontal: spacing.lg,
		marginTop: spacing.xl,
		backgroundColor: colors.accent,
		borderRadius: radius.md,
		padding: spacing.md,
	},
	saveBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
	note: {
		marginHorizontal: spacing.lg,
		marginTop: spacing.md,
		fontSize: 12,
		color: colors.textMuted,
		lineHeight: 18,
		textAlign: "center",
	},
});
