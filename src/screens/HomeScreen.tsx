import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Platform, TextInput, KeyboardAvoidingView, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import {
	getTodayDailyLogs,
	getTodayMorningLogs,
	markLogDone,
	seedTodayLogs,
	allDailyDoneToday,
	hasMorningIntentionsToday,
	addMorningIntention,
	deleteMorningIntention,
	DailyLogWithTitle,
} from "../db/database";
import { cancelAlarm, cancelSnooze, scheduleSnooze, stopAlarmSound, EVENING_NOTIF_ID, MORNING_NOTIF_ID } from "../utils/notifications";
import AlarmModal from "../components/AlarmModal";
import { colors, spacing, radius } from "../utils/theme";
import { format } from "date-fns";

type AlarmType = "morning" | "evening" | null;

export default function HomeScreen() {
	const [dailyLogs, setDailyLogs] = useState<DailyLogWithTitle[]>([]);
	const [morningLogs, setMorningLogs] = useState<DailyLogWithTitle[]>([]);
	const [activeAlarm, setActiveAlarm] = useState<AlarmType>(null);
	const [canDismiss, setCanDismiss] = useState(false);
	const [newIntention, setNewIntention] = useState("");
	const [addingIntention, setAddingIntention] = useState(false);
	const fadeAnim = useRef(new Animated.Value(0)).current;

	const load = useCallback(async () => {
		try {
			await seedTodayLogs();
			const [dl, ml] = await Promise.all([getTodayDailyLogs(), getTodayMorningLogs()]);
			setDailyLogs(dl);
			setMorningLogs(ml);
		} catch (e) {
			console.warn("[HomeScreen] load failed:", e);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
			Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
			return () => fadeAnim.setValue(0);
		}, [load]),
	);

	// Listen for notifications tapped while app is open
	useEffect(() => {
		const sub = Notifications.addNotificationReceivedListener(async (notif) => {
			const type = notif.request.content.data?.type as "morning" | "evening" | undefined;
			if (type) triggerAlarm(type);
		});
		const tapSub = Notifications.addNotificationResponseReceivedListener(async (resp) => {
			const type = resp.notification.request.content.data?.type as "morning" | "evening" | undefined;
			if (type) triggerAlarm(type);
		});
		return () => {
			sub.remove();
			tapSub.remove();
		};
	}, []);

	const triggerAlarm = async (type: "morning" | "evening") => {
		let dismissable = false;
		if (type === "evening") dismissable = await allDailyDoneToday();
		if (type === "morning") dismissable = await hasMorningIntentionsToday();
		setCanDismiss(dismissable);
		setActiveAlarm(type);
	};

	const handleToggleDaily = async (log: DailyLogWithTitle) => {
		const nowDone = log.is_completed === 0;
		await markLogDone(log.id, nowDone);
		await load();

		if (nowDone) {
			const allDone = await allDailyDoneToday();
			setCanDismiss(allDone);
			if (allDone && activeAlarm === "evening") {
				// auto-enable dismiss
			}
		}
	};

	const handleToggleMorning = async (log: DailyLogWithTitle) => {
		const nowDone = log.is_completed === 0;
		await markLogDone(log.id, nowDone);
		await load();
	};

	const handleDeleteMorningLog = async (log: DailyLogWithTitle) => {
		await deleteMorningIntention(log.id);
		await load();
		const has = await hasMorningIntentionsToday();
		setCanDismiss(has);
	};

	const handleAddIntention = async () => {
		const title = newIntention.trim();
		if (!title) return;
		try {
			await addMorningIntention(title);
			setNewIntention("");
			setAddingIntention(false);
			await load();
			setCanDismiss(true);
		} catch (e) {
			console.error("[handleAddIntention] failed:", e);
			//Alert.alert("Error", `Could not save intention: ${(e as Error).message}`);
		}
	};

	const handleAlarmDismiss = async () => {
		if (!canDismiss) {
			Alert.alert(
				activeAlarm === "morning" ? "Set your intentions first" : "Finish your commitments first",
				activeAlarm === "morning"
					? "Add at least one intention for today to dismiss this alarm."
					: "Tick off all your daily commitments to dismiss the evening alarm.",
				[{ text: "OK" }],
			);
			return;
		}
		if (activeAlarm) {
			await cancelAlarm(activeAlarm === "morning" ? MORNING_NOTIF_ID : EVENING_NOTIF_ID);
			await cancelSnooze(activeAlarm);
			await stopAlarmSound();
		}
		setActiveAlarm(null);
	};

	const handleAlarmSnooze = async () => {
		if (activeAlarm) await scheduleSnooze(activeAlarm);
		await stopAlarmSound();
		setActiveAlarm(null);
	};

	const doneCount = dailyLogs.filter((l) => l.is_completed).length;
	const today = format(new Date(), "EEEE, MMM d");
	const morningDismissHint = "Add at least one intention for today to dismiss the morning alarm.";
	const eveningDismissHint = "Tick off all your daily commitments to dismiss the evening alarm.";

	return (
		<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
			<Animated.View style={[styles.container, { opacity: fadeAnim }]}>
				{/* Header */}
				<View style={styles.header}>
					<Text style={styles.date}>{today}</Text>
					<Text style={styles.title}>Today</Text>
					{dailyLogs.length > 0 && (
						<View style={styles.progressRow}>
							<View style={styles.progressTrack}>
								<View style={[styles.progressFill, { width: `${(doneCount / dailyLogs.length) * 100}%` }]} />
							</View>
							<Text style={styles.progressLabel}>
								{doneCount}/{dailyLogs.length}
							</Text>
						</View>
					)}
				</View>

				<ScrollView
					style={styles.scroll}
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
				>
					{/* ── Morning Intentions ── */}
					<View style={styles.sectionBlock}>
						<View style={styles.sectionHeaderRow}>
							<View style={styles.sectionLabelRow}>
								<View style={[styles.sectionDot, { backgroundColor: colors.morning }]} />
								<View>
									<Text style={styles.sectionLabel}>Today's Intentions</Text>
									<Text style={styles.sectionSub}>What will you achieve today?</Text>
								</View>
							</View>
							<TouchableOpacity style={styles.addSmallBtn} onPress={() => setAddingIntention((v) => !v)}>
								<Ionicons name={addingIntention ? "close" : "add"} size={18} color={colors.morning} />
							</TouchableOpacity>
						</View>

						{addingIntention && (
							<View style={styles.intentionInputRow}>
								<TextInput
									style={styles.intentionInput}
									placeholder="What do you intend to do today?"
									placeholderTextColor={colors.textMuted}
									value={newIntention}
									onChangeText={setNewIntention}
									autoFocus
									returnKeyType="done"
									onSubmitEditing={handleAddIntention}
								/>
								<TouchableOpacity
									style={[styles.intentionAddBtn, !newIntention.trim() && { opacity: 0.4 }]}
									onPress={handleAddIntention}
									disabled={!newIntention.trim()}
								>
									<Ionicons name="arrow-up" size={16} color="#000" />
								</TouchableOpacity>
							</View>
						)}

						{morningLogs.length === 0 && !addingIntention && (
							<Text style={styles.emptyHint}>Tap + to set your intentions for today</Text>
						)}

						{morningLogs.map((log) => (
							<IntentionRow
								key={log.id}
								log={log}
								onToggle={() => handleToggleMorning(log)}
								onDelete={() => handleDeleteMorningLog(log)}
							/>
						))}
					</View>

					{/* ── Daily Commitments ── */}
					{dailyLogs.length > 0 && (
						<View style={styles.sectionBlock}>
							<View style={styles.sectionLabelRow}>
								<View style={[styles.sectionDot, { backgroundColor: colors.daily }]} />
								<View>
									<Text style={styles.sectionLabel}>Daily Commitments</Text>
									<Text style={styles.sectionSub}>Your recurring habits for today</Text>
								</View>
							</View>
							{dailyLogs.map((log) => (
								<CommitmentRow key={log.id} log={log} onToggle={() => handleToggleDaily(log)} />
							))}
						</View>
					)}

					{dailyLogs.length === 0 && morningLogs.length === 0 && !addingIntention && <EmptyState />}
				</ScrollView>

				{/* Alarm modal */}
				<AlarmModal
					visible={activeAlarm !== null}
					type={activeAlarm ?? "evening"}
					canDismiss={canDismiss}
					dismissHint={activeAlarm === "morning" ? morningDismissHint : eveningDismissHint}
					onDismiss={handleAlarmDismiss}
					onSnooze={handleAlarmSnooze}
				/>
			</Animated.View>
		</KeyboardAvoidingView>
	);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function IntentionRow({ log, onToggle, onDelete }: { log: DailyLogWithTitle; onToggle: () => void; onDelete: () => void }) {
	const done = log.is_completed === 1;
	return (
		<View style={[styles.row, done && styles.rowDone]}>
			<TouchableOpacity
				style={[styles.checkbox, done && { backgroundColor: colors.morning, borderColor: colors.morning }]}
				onPress={onToggle}
			>
				{done && <Ionicons name="checkmark" size={13} color="#000" />}
			</TouchableOpacity>
			<Text style={[styles.rowText, done && styles.rowTextDone]}>{log.title}</Text>
			<TouchableOpacity style={styles.deleteSmall} onPress={onDelete}>
				<Ionicons name="close" size={14} color={colors.textMuted} />
			</TouchableOpacity>
		</View>
	);
}

function CommitmentRow({ log, onToggle }: { log: DailyLogWithTitle; onToggle: () => void }) {
	const scale = useRef(new Animated.Value(1)).current;
	const done = log.is_completed === 1;

	const handlePress = () => {
		Animated.sequence([
			Animated.timing(scale, { toValue: 0.96, duration: 70, useNativeDriver: true }),
			Animated.timing(scale, { toValue: 1, duration: 70, useNativeDriver: true }),
		]).start(onToggle);
	};

	return (
		<Animated.View style={{ transform: [{ scale }] }}>
			<TouchableOpacity style={[styles.row, done && styles.rowDone]} onPress={handlePress} activeOpacity={0.85}>
				<View style={[styles.checkbox, done && { backgroundColor: colors.daily, borderColor: colors.daily }]}>
					{done && <Ionicons name="checkmark" size={13} color="#000" />}
				</View>
				<Text style={[styles.rowText, done && styles.rowTextDone]}>{log.title}</Text>
			</TouchableOpacity>
		</Animated.View>
	);
}

function EmptyState() {
	return (
		<View style={styles.empty}>
			<Text style={styles.emptyIcon}>📋</Text>
			<Text style={styles.emptyTitle}>Nothing here yet</Text>
			<Text style={styles.emptyBody}>
				Go to the Commitments tab to add daily habits,{"\n"}
				or tap + above to set today's intentions.
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.bg },
	header: {
		paddingTop: Platform.OS === "ios" ? 60 : 40,
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	date: { fontSize: 11, color: colors.textSecondary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 },
	title: { fontSize: 36, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.md },
	progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	progressTrack: { flex: 1, height: 3, backgroundColor: colors.border, borderRadius: 99, overflow: "hidden" },
	progressFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 99 },
	progressLabel: { fontSize: 12, color: colors.textSecondary },
	scroll: { flex: 1 },
	scrollContent: { padding: spacing.lg, paddingBottom: 100, gap: spacing.xl },
	sectionBlock: { gap: spacing.sm },
	sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	sectionDot: { width: 8, height: 8, borderRadius: 99 },
	sectionLabel: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, textTransform: "uppercase", letterSpacing: 0.8 },
	sectionSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
	addSmallBtn: {
		width: 30,
		height: 30,
		borderRadius: 15,
		borderWidth: 1,
		borderColor: colors.border,
		alignItems: "center",
		justifyContent: "center",
	},
	intentionInputRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		marginTop: spacing.xs,
	},
	intentionInput: {
		flex: 1,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		paddingHorizontal: spacing.md,
		paddingVertical: 10,
		fontSize: 15,
		color: colors.textPrimary,
	},
	intentionAddBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: colors.morning,
		alignItems: "center",
		justifyContent: "center",
	},
	emptyHint: { fontSize: 13, color: colors.textMuted, paddingVertical: spacing.xs },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		paddingVertical: 13,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	rowDone: { opacity: 0.45 },
	checkbox: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 1.5,
		borderColor: colors.border,
		alignItems: "center",
		justifyContent: "center",
	},
	rowText: { flex: 1, fontSize: 15, color: colors.textPrimary },
	rowTextDone: { textDecorationLine: "line-through", color: colors.textSecondary },
	deleteSmall: { padding: 4 },
	empty: { alignItems: "center", paddingTop: 60, gap: spacing.sm },
	emptyIcon: { fontSize: 44 },
	emptyTitle: { fontSize: 20, fontWeight: "600", color: colors.textPrimary },
	emptyBody: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 22, maxWidth: 280 },
});
