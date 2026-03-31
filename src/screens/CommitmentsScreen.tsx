import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform, Animated, KeyboardAvoidingView } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Commitment, CommitmentType, getCommitments, addCommitment, toggleCommitmentActive, deleteCommitment } from "../db/database";
import { colors, spacing, radius } from "../utils/theme";

export default function CommitmentsScreen() {
	const [commitments, setCommitments] = useState<Commitment[]>([]);
	const [newTitle, setNewTitle] = useState("");
	const [newType, setNewType] = useState<CommitmentType>("daily");
	const [adding, setAdding] = useState(false);

	const load = useCallback(async () => {
		const data = await getCommitments();
		setCommitments(data);
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load]),
	);

	const handleAdd = async () => {
		const title = newTitle.trim();
		if (!title) return;
		await addCommitment(title, newType);
		setNewTitle("");
		setAdding(false);
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
					<View style={styles.typeRow}>
						<TypeToggle
							label="Daily"
							subtitle="Check off each night"
							icon="moon-outline"
							active={newType === "daily"}
							color={colors.daily}
							onPress={() => setNewType("daily")}
						/>
						<TypeToggle
							label="Morning"
							subtitle="Set in the morning"
							icon="sunny-outline"
							active={newType === "morning"}
							color={colors.morning}
							onPress={() => setNewType("morning")}
						/>
					</View>
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
				<SectionBlock
					label="Daily Commitments"
					subtitle="Ring every evening"
					color={colors.daily}
					items={daily}
					onToggleActive={handleToggleActive}
					onDelete={handleDelete}
					emptyText="No daily commitments yet"
				/>
				<SectionBlock
					label="Morning Goals"
					subtitle="Ring every morning"
					color={colors.morning}
					items={morning}
					onToggleActive={handleToggleActive}
					onDelete={handleDelete}
					emptyText="No morning goals yet"
				/>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypeToggle({
	label,
	subtitle,
	icon,
	active,
	color,
	onPress,
}: {
	label: string;
	subtitle: string;
	icon: any;
	active: boolean;
	color: string;
	onPress: () => void;
}) {
	return (
		<TouchableOpacity style={[styles.typeBtn, active && { borderColor: color, backgroundColor: color + "18" }]} onPress={onPress}>
			<Ionicons name={icon} size={18} color={active ? color : colors.textSecondary} />
			<Text style={[styles.typeBtnLabel, active && { color }]}>{label}</Text>
			<Text style={styles.typeBtnSub}>{subtitle}</Text>
		</TouchableOpacity>
	);
}

function SectionBlock({
	label,
	subtitle,
	color,
	items,
	onToggleActive,
	onDelete,
	emptyText,
}: {
	label: string;
	subtitle: string;
	color: string;
	items: Commitment[];
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
					<Text style={styles.sectionSubtitle}>{subtitle}</Text>
				</View>
			</View>
			{items.length === 0 && <Text style={styles.emptyText}>{emptyText}</Text>}
			{items.map((c) => (
				<CommitmentItem key={c.id} commitment={c} color={color} onToggleActive={() => onToggleActive(c)} onDelete={() => onDelete(c)} />
			))}
		</View>
	);
}

function CommitmentItem({
	commitment: c,
	color,
	onToggleActive,
	onDelete,
}: {
	commitment: Commitment;
	color: string;
	onToggleActive: () => void;
	onDelete: () => void;
}) {
	const active = c.is_active === 1;
	return (
		<View style={[styles.item, !active && styles.itemInactive]}>
			<TouchableOpacity style={styles.itemToggle} onPress={onToggleActive}>
				<View style={[styles.activeIndicator, { backgroundColor: active ? color : colors.border }]} />
			</TouchableOpacity>
			<Text style={[styles.itemTitle, !active && styles.itemTitleInactive]}>{c.title}</Text>
			<TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
				<Ionicons name="trash-outline" size={16} color={colors.textMuted} />
			</TouchableOpacity>
		</View>
	);
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.bg,
	},
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
	title: {
		fontSize: 36,
		fontWeight: "700",
		color: colors.textPrimary,
	},
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
		paddingVertical: spacing.md,
		fontSize: 16,
		color: colors.textPrimary,
	},
	typeRow: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	typeBtn: {
		flex: 1,
		padding: spacing.md,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		alignItems: "flex-start",
		gap: 4,
	},
	typeBtnLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	typeBtnSub: {
		fontSize: 11,
		color: colors.textMuted,
	},
	saveBtn: {
		backgroundColor: colors.accent,
		borderRadius: radius.md,
		padding: spacing.md,
		alignItems: "center",
	},
	saveBtnDisabled: {
		opacity: 0.4,
	},
	saveBtnText: {
		color: "#000",
		fontWeight: "700",
		fontSize: 15,
	},
	scroll: { flex: 1 },
	scrollContent: {
		padding: spacing.lg,
		paddingBottom: 100,
		gap: spacing.xl,
	},
	section: {
		gap: spacing.sm,
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		marginBottom: spacing.xs,
	},
	sectionDot: {
		width: 8,
		height: 8,
		borderRadius: 99,
	},
	sectionLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textPrimary,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	sectionSubtitle: {
		fontSize: 11,
		color: colors.textMuted,
	},
	emptyText: {
		color: colors.textMuted,
		fontSize: 13,
		paddingVertical: spacing.sm,
	},
	item: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		paddingVertical: spacing.md,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	itemInactive: {
		opacity: 0.45,
	},
	itemToggle: {
		padding: 4,
	},
	activeIndicator: {
		width: 10,
		height: 10,
		borderRadius: 99,
	},
	itemTitle: {
		flex: 1,
		fontSize: 15,
		color: colors.textPrimary,
	},
	itemTitleInactive: {
		textDecorationLine: "line-through",
		color: colors.textSecondary,
	},
	deleteBtn: {
		padding: 4,
	},
});
