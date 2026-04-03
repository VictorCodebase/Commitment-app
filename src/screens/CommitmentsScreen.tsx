import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Commitment, CommitmentType, getCommitments, addCommitment, toggleCommitmentActive, deleteCommitment } from "../db/database";
import DayOfWeekPicker, { daysToString, stringToDays, daysLabel } from "../components/DayOfWeekPicker";
import { colors, spacing, radius } from "../utils/theme";

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function CommitmentsScreen() {
	const [commitments, setCommitments] = useState<Commitment[]>([]);
	const [adding, setAdding] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [newType, setNewType] = useState<CommitmentType>("daily");
	const [newDays, setNewDays] = useState<number[]>(ALL_DAYS);

	const load = useCallback(async () => {
		setCommitments(await getCommitments());
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load]),
	);

	const resetForm = () => {
		setNewTitle("");
		setNewType("daily");
		setNewDays(ALL_DAYS);
		setAdding(false);
	};

	const handleAdd = async () => {
		const title = newTitle.trim();
		if (!title) return;
		const dow = newType === "daily" ? daysToString(newDays) : null;
		await addCommitment(title, newType, dow);
		resetForm();
		await load();
	};

	const handleToggleActive = async (c: Commitment) => {
		await toggleCommitmentActive(c.id, c.is_active === 0);
		await load();
	};

	const handleDelete = (c: Commitment) => {
		Alert.alert("Delete Commitment", `Remove "${c.title}"? All its history will be deleted.`, [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					await deleteCommitment(c.id);
					await load();
				},
			},
		]);
	};

	const daily = commitments.filter((c) => c.type === "daily");
	const morning = commitments.filter((c) => c.type === "morning");

	return (
		<KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
			{/* Header */}
			<View style={styles.header}>
				<Text style={styles.title}>Commitments</Text>
				<TouchableOpacity style={styles.addBtn} onPress={() => setAdding((v) => !v)}>
					<Ionicons name={adding ? "close" : "add"} size={22} color={colors.accent} />
				</TouchableOpacity>
			</View>

			{/* Add form */}
			{adding && (
				<View style={styles.addForm}>
					<TextInput
						style={styles.input}
						placeholder="What do you want to commit to?"
						placeholderTextColor={colors.textMuted}
						value={newTitle}
						onChangeText={setNewTitle}
						autoFocus
						returnKeyType="done"
						onSubmitEditing={handleAdd}
					/>

					{/* Type selector */}
					<View style={styles.typeRow}>
						<TypeCard
							active={newType === "daily"}
							color={colors.daily}
							icon="repeat-outline"
							label="Daily Habit"
							desc="Shown every evening for check-in"
							onPress={() => setNewType("daily")}
						/>
						<TypeCard
							active={newType === "morning"}
							color={colors.morning}
							icon="sunny-outline"
							label="Morning Template"
							desc="Available each morning to add as daily intention"
							onPress={() => setNewType("morning")}
						/>
					</View>

					{/* Day picker — only for daily habits */}
					{newType === "daily" && (
						<View style={styles.dayPickerBlock}>
							<Text style={styles.dayPickerLabel}>Applies on</Text>
							<DayOfWeekPicker value={newDays} onChange={setNewDays} color={colors.daily} />
						</View>
					)}

					{newType === "morning" && (
						<View style={styles.morningNote}>
							<Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
							<Text style={styles.morningNoteText}>
								Morning templates appear as quick-add suggestions when you set your daily intentions each
								morning.
							</Text>
						</View>
					)}

					<TouchableOpacity
						style={[styles.saveBtn, !newTitle.trim() && styles.saveBtnDisabled]}
						onPress={handleAdd}
						disabled={!newTitle.trim()}
					>
						<Text style={styles.saveBtnText}>Add Commitment</Text>
					</TouchableOpacity>
				</View>
			)}

			<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<Section
					label="Daily Habits"
					subtitle="Checked off every evening"
					color={colors.daily}
					items={daily}
					showDays
					onToggleActive={handleToggleActive}
					onDelete={handleDelete}
					emptyText="No daily habits yet"
				/>
				<Section
					label="Morning Templates"
					subtitle="Quick-add as daily intentions each morning"
					color={colors.morning}
					items={morning}
					showDays={false}
					onToggleActive={handleToggleActive}
					onDelete={handleDelete}
					emptyText="No morning templates yet"
				/>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypeCard({
	active,
	color,
	icon,
	label,
	desc,
	onPress,
}: {
	active: boolean;
	color: string;
	icon: any;
	label: string;
	desc: string;
	onPress: () => void;
}) {
	return (
		<TouchableOpacity style={[styles.typeCard, active && { borderColor: color, backgroundColor: color + "15" }]} onPress={onPress}>
			<Ionicons name={icon} size={20} color={active ? color : colors.textSecondary} />
			<Text style={[styles.typeCardLabel, active && { color }]}>{label}</Text>
			<Text style={styles.typeCardDesc}>{desc}</Text>
		</TouchableOpacity>
	);
}

function Section({
	label,
	subtitle,
	color,
	items,
	showDays,
	onToggleActive,
	onDelete,
	emptyText,
}: {
	label: string;
	subtitle: string;
	color: string;
	items: Commitment[];
	showDays: boolean;
	onToggleActive: (c: Commitment) => void;
	onDelete: (c: Commitment) => void;
	emptyText: string;
}) {
	return (
		<View style={styles.section}>
			<View style={styles.sectionHeader}>
				<View style={[styles.sectionDot, { backgroundColor: color }]} />
				<View>
					<Text style={styles.sectionLabel}>{label}</Text>
					<Text style={styles.sectionSub}>{subtitle}</Text>
				</View>
			</View>
			{items.length === 0 && <Text style={styles.emptyText}>{emptyText}</Text>}
			{items.map((c) => (
				<CommitmentItem
					key={c.id}
					commitment={c}
					color={color}
					showDays={showDays}
					onToggleActive={() => onToggleActive(c)}
					onDelete={() => onDelete(c)}
				/>
			))}
		</View>
	);
}

function CommitmentItem({
	commitment: c,
	color,
	showDays,
	onToggleActive,
	onDelete,
}: {
	commitment: Commitment;
	color: string;
	showDays: boolean;
	onToggleActive: () => void;
	onDelete: () => void;
}) {
	const active = c.is_active === 1;
	const dayStr = showDays ? daysLabel(c.days_of_week) : null;

	return (
		<View style={[styles.item, !active && styles.itemInactive]}>
			<TouchableOpacity style={styles.itemToggle} onPress={onToggleActive}>
				<View style={[styles.activeDot, { backgroundColor: active ? color : colors.border }]} />
			</TouchableOpacity>
			<View style={styles.itemBody}>
				<Text style={[styles.itemTitle, !active && styles.itemTitleInactive]}>{c.title}</Text>
				{dayStr && <Text style={styles.itemDays}>{dayStr}</Text>}
			</View>
			<TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
				<Ionicons name="trash-outline" size={15} color={colors.textMuted} />
			</TouchableOpacity>
		</View>
	);
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.bg },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingTop: Platform.OS === "ios" ? 60 : 40,
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	title: { fontSize: 36, fontWeight: "700", color: colors.textPrimary },
	addBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: colors.border,
		alignItems: "center",
		justifyContent: "center",
	},
	addForm: {
		padding: spacing.lg,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
		gap: spacing.md,
	},
	input: {
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		paddingHorizontal: spacing.md,
		paddingVertical: 12,
		fontSize: 16,
		color: colors.textPrimary,
	},
	typeRow: { flexDirection: "row", gap: spacing.sm },
	typeCard: {
		flex: 1,
		padding: spacing.md,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		gap: 4,
	},
	typeCardLabel: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginTop: 4 },
	typeCardDesc: { fontSize: 11, color: colors.textMuted, lineHeight: 15 },
	dayPickerBlock: {
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		padding: spacing.md,
		gap: spacing.sm,
	},
	dayPickerLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1 },
	morningNote: {
		flexDirection: "row",
		gap: spacing.sm,
		backgroundColor: colors.surface,
		borderRadius: radius.sm,
		padding: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	morningNoteText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 18 },
	saveBtn: {
		backgroundColor: colors.accent,
		borderRadius: radius.md,
		padding: spacing.md,
		alignItems: "center",
	},
	saveBtnDisabled: { opacity: 0.35 },
	saveBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
	scroll: { flex: 1 },
	scrollContent: { padding: spacing.lg, paddingBottom: 100, gap: spacing.xl },
	section: { gap: spacing.sm },
	sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
	sectionDot: { width: 8, height: 8, borderRadius: 99 },
	sectionLabel: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, textTransform: "uppercase", letterSpacing: 1 },
	sectionSub: { fontSize: 11, color: colors.textMuted },
	emptyText: { color: colors.textMuted, fontSize: 13, paddingVertical: spacing.sm },
	item: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		padding: spacing.md,
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	itemInactive: { opacity: 0.4 },
	itemToggle: { padding: 4 },
	activeDot: { width: 10, height: 10, borderRadius: 99 },
	itemBody: { flex: 1, gap: 2 },
	itemTitle: { fontSize: 15, color: colors.textPrimary },
	itemTitleInactive: { textDecorationLine: "line-through", color: colors.textSecondary },
	itemDays: { fontSize: 11, color: colors.textMuted },
	deleteBtn: { padding: 4 },
});
