/**
 * AlarmModal
 * Shown as a full-screen overlay when the alarm fires while the app is open.
 * The user must either dismiss (if conditions met) or snooze.
 */
import React, { useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Vibration, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { playAlarmSound, stopAlarmSound } from "../utils/notifications";
import { colors, spacing, radius } from "../utils/theme";

interface Props {
	visible: boolean;
	type: "morning" | "evening";
	canDismiss: boolean;
	dismissHint: string;
	onDismiss: () => void;
	onSnooze: () => void;
}

export default function AlarmModal({ visible, type, canDismiss, dismissHint, onDismiss, onSnooze }: Props) {
	useEffect(() => {
		if (visible) {
			playAlarmSound();
			// Vibrate pattern while alarm is showing
			if (Platform.OS === "android") {
				Vibration.vibrate([0, 500, 300, 500], true);
			}
		} else {
			stopAlarmSound();
			Vibration.cancel();
		}
		return () => {
			stopAlarmSound();
			Vibration.cancel();
		};
	}, [visible]);

	const icon = type === "morning" ? "sunny" : "moon";
	const title = type === "morning" ? "Morning Check-in" : "Evening Check-in";
	const subtitle = type === "morning" ? "What do you intend to achieve today?" : "Did you keep your commitments today?";
	const color = type === "morning" ? colors.morning : colors.daily;

	return (
		<Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
			<View style={styles.overlay}>
				<View style={styles.card}>
					<View style={[styles.iconCircle, { backgroundColor: color + "22", borderColor: color + "55" }]}>
						<Ionicons name={icon} size={40} color={color} />
					</View>

					<Text style={styles.title}>{title}</Text>
					<Text style={styles.subtitle}>{subtitle}</Text>

					{!canDismiss && (
						<View style={styles.hintBox}>
							<Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
							<Text style={styles.hintText}>{dismissHint}</Text>
						</View>
					)}

					<TouchableOpacity
						style={[styles.dismissBtn, { backgroundColor: canDismiss ? colors.accent : colors.surfaceAlt }]}
						onPress={onDismiss}
					>
						<Ionicons name="checkmark-circle" size={18} color={canDismiss ? "#000" : colors.textMuted} />
						<Text style={[styles.dismissBtnText, !canDismiss && { color: colors.textMuted }]}>
							{canDismiss ? "Dismiss Alarm" : "Not yet…"}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity style={styles.snoozeBtn} onPress={onSnooze}>
						<Ionicons name="alarm-outline" size={16} color={colors.textSecondary} />
						<Text style={styles.snoozeBtnText}>Snooze</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.85)",
		alignItems: "center",
		justifyContent: "center",
		padding: spacing.lg,
	},
	card: {
		width: "100%",
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		borderWidth: 1,
		borderColor: colors.border,
		padding: spacing.xl,
		alignItems: "center",
		gap: spacing.md,
	},
	iconCircle: {
		width: 80,
		height: 80,
		borderRadius: 40,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: spacing.sm,
	},
	title: {
		fontSize: 26,
		fontWeight: "700",
		color: colors.textPrimary,
		textAlign: "center",
	},
	subtitle: {
		fontSize: 15,
		color: colors.textSecondary,
		textAlign: "center",
		lineHeight: 22,
	},
	hintBox: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: spacing.sm,
		backgroundColor: colors.surfaceAlt,
		borderRadius: radius.sm,
		padding: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
		marginTop: spacing.xs,
	},
	hintText: {
		flex: 1,
		fontSize: 13,
		color: colors.textSecondary,
		lineHeight: 19,
	},
	dismissBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
		width: "100%",
		padding: spacing.md,
		borderRadius: radius.md,
		marginTop: spacing.sm,
	},
	dismissBtnText: {
		fontSize: 16,
		fontWeight: "700",
		color: "#000",
	},
	snoozeBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		padding: spacing.sm,
	},
	snoozeBtnText: {
		fontSize: 14,
		color: colors.textSecondary,
	},
});
