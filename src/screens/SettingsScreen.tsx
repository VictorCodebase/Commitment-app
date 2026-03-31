import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Platform, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getAllSettings, setSetting } from "../db/database";
import { rescheduleAll } from "../utils/notifications";
import { colors, spacing, radius } from "../utils/theme";

type Settings = Record<string, string>;

export default function SettingsScreen() {
	const [settings, setSettings] = useState<Settings>({});
	const [saved, setSaved] = useState(false);

	const load = useCallback(async () => {
		const s = await getAllSettings();
		setSettings(s);
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

	const handleTimePress = (key: string) => {
		// Simple time picker via alert with preset options (no external picker needed)
		const current = settings[key] ?? "07:00";
		const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
		const times = hours.flatMap((h) => [`${h}:00`, `${h}:30`]);

		Alert.alert("Select Time", `Current: ${current}`, [...generateTimeOptions(current, key, update), { text: "Cancel", style: "cancel" }]);
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
			<View style={styles.header}>
				<Text style={styles.title}>Settings</Text>
			</View>

			{/* Evening alarm */}
			<SettingsSection label="Evening Check-in">
				<SettingsRow label="Enabled">
					<Switch
						value={settings["evening_alarm_on"] === "1"}
						onValueChange={(v) => update("evening_alarm_on", v ? "1" : "0")}
						trackColor={{ false: colors.border, true: colors.daily + "88" }}
						thumbColor={settings["evening_alarm_on"] === "1" ? colors.daily : colors.textMuted}
					/>
				</SettingsRow>
				<SettingsRow label="Alarm time">
					<TouchableOpacity style={styles.timePill} onPress={() => handleTimePress("evening_alarm_time")}>
						<Ionicons name="time-outline" size={14} color={colors.daily} />
						<Text style={[styles.timePillText, { color: colors.daily }]}>{settings["evening_alarm_time"] ?? "21:00"}</Text>
					</TouchableOpacity>
				</SettingsRow>
			</SettingsSection>

			{/* Morning alarm */}
			<SettingsSection label="Morning Alarm">
				<SettingsRow label="Enabled">
					<Switch
						value={settings["morning_alarm_on"] === "1"}
						onValueChange={(v) => update("morning_alarm_on", v ? "1" : "0")}
						trackColor={{ false: colors.border, true: colors.morning + "88" }}
						thumbColor={settings["morning_alarm_on"] === "1" ? colors.morning : colors.textMuted}
					/>
				</SettingsRow>
				<SettingsRow label="Alarm time">
					<TouchableOpacity style={styles.timePill} onPress={() => handleTimePress("morning_alarm_time")}>
						<Ionicons name="time-outline" size={14} color={colors.morning} />
						<Text style={[styles.timePillText, { color: colors.morning }]}>
							{settings["morning_alarm_time"] ?? "07:00"}
						</Text>
					</TouchableOpacity>
				</SettingsRow>
			</SettingsSection>

			{/* Snooze */}
			<SettingsSection label="Snooze">
				<SettingsRow label="Snooze duration">
					<View style={styles.stepperRow}>
						{[5, 10, 15, 20, 30].map((mins) => (
							<TouchableOpacity
								key={mins}
								style={[
									styles.stepperBtn,
									settings["snooze_minutes"] === String(mins) && styles.stepperBtnActive,
								]}
								onPress={() => update("snooze_minutes", String(mins))}
							>
								<Text
									style={[
										styles.stepperBtnText,
										settings["snooze_minutes"] === String(mins) && styles.stepperBtnTextActive,
									]}
								>
									{mins}m
								</Text>
							</TouchableOpacity>
						))}
					</View>
				</SettingsRow>
			</SettingsSection>

			{/* Save */}
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
				Alarms are local notifications — no internet required. Make sure notification permissions are granted in your device settings.
			</Text>
		</ScrollView>
	);
}

// ─── Time picker helpers ─────────────────────────────────────────────────────

function generateTimeOptions(current: string, key: string, update: (k: string, v: string) => void) {
	// Show times around the current selection
	const [h] = current.split(":").map(Number);
	const options: string[] = [];
	for (let hour = 0; hour < 24; hour++) {
		options.push(`${String(hour).padStart(2, "0")}:00`);
		options.push(`${String(hour).padStart(2, "0")}:30`);
	}
	// Show a subset around current hour to avoid Alert overflow
	const startIdx = Math.max(0, options.indexOf(`${String(h).padStart(2, "0")}:00`) - 4);
	const slice = options.slice(startIdx, startIdx + 10);

	return slice.map((t) => ({
		text: t + (t === current ? " ✓" : ""),
		onPress: () => update(key, t),
	}));
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

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel}>{label}</Text>
			{children}
		</View>
	);
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.bg,
	},
	content: {
		paddingBottom: 100,
	},
	header: {
		paddingTop: Platform.OS === "ios" ? 60 : 40,
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	title: {
		fontSize: 36,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	section: {
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.xl,
		gap: spacing.sm,
	},
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
	rowLabel: {
		fontSize: 15,
		color: colors.textPrimary,
	},
	timePill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: spacing.md,
		paddingVertical: 6,
		borderRadius: radius.sm,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surfaceAlt,
	},
	timePillText: {
		fontSize: 14,
		fontWeight: "600",
		fontVariant: ["tabular-nums"],
	},
	stepperRow: {
		flexDirection: "row",
		gap: 6,
	},
	stepperBtn: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: radius.sm,
		borderWidth: 1,
		borderColor: colors.border,
	},
	stepperBtnActive: {
		backgroundColor: colors.accent,
		borderColor: colors.accent,
	},
	stepperBtnText: {
		fontSize: 13,
		color: colors.textSecondary,
	},
	stepperBtnTextActive: {
		color: "#000",
		fontWeight: "700",
	},
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
	saveBtnText: {
		color: "#000",
		fontWeight: "700",
		fontSize: 15,
	},
	note: {
		marginHorizontal: spacing.lg,
		marginTop: spacing.lg,
		fontSize: 12,
		color: colors.textMuted,
		lineHeight: 18,
		textAlign: "center",
	},
});
