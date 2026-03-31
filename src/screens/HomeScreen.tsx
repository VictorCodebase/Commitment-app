import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getTodayLogs,
  markCommitmentDone,
  seedTodayLogs,
  allDailyDoneToday,
  morningCommitmentsSetToday,
  DailyLogWithTitle,
} from '../db/database';
import {
  cancelAlarm,
  cancelSnooze,
  scheduleSnooze,
  EVENING_ALARM_ID,
  MORNING_ALARM_ID,
} from '../utils/notifications';
import { colors, spacing, radius } from '../utils/theme';
import { format } from 'date-fns';

export default function HomeScreen() {
  const [logs, setLogs] = useState<DailyLogWithTitle[]>([]);
  const [allDone, setAllDone] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    await seedTodayLogs();
    const data = await getTodayLogs();
    setLogs(data);
    const done = await allDailyDoneToday();
    setAllDone(done);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
      return () => fadeAnim.setValue(0);
    }, [load])
  );

  const handleToggle = async (log: DailyLogWithTitle) => {
    const nowDone = log.is_completed === 0;
    await markCommitmentDone(log.id, nowDone);
    await load();

    // If all daily items done → dismiss evening alarm
    if (nowDone) {
      const done = await allDailyDoneToday();
      if (done) {
        await cancelAlarm(EVENING_ALARM_ID);
        await cancelSnooze('evening');
      }
    }
  };

  const handleSnoozeEvening = async () => {
    await scheduleSnooze('evening');
    Alert.alert('Snoozed', 'Evening alarm will ring again shortly.');
  };

  const handleDismissMorning = async () => {
    const hasGoals = await morningCommitmentsSetToday();
    if (!hasGoals) {
      Alert.alert(
        'No Goals Set',
        'Add at least one morning commitment to dismiss the morning alarm.'
      );
      return;
    }
    await cancelAlarm(MORNING_ALARM_ID);
    await cancelSnooze('morning');
    Alert.alert('Morning alarm dismissed', 'Good luck with your day!');
  };

  const morningLogs = logs.filter(l => l.type === 'morning');
  const dailyLogs = logs.filter(l => l.type === 'daily');
  const doneCount = dailyLogs.filter(l => l.is_completed).length;

  const today = format(new Date(), 'EEEE, MMM d');

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.date}>{today}</Text>
        <Text style={styles.title}>Today</Text>
        {dailyLogs.length > 0 && (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(doneCount / dailyLogs.length) * 100}%` },
                ]}
              />
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
      >
        {/* Morning commitments */}
        {morningLogs.length > 0 && (
          <>
            <SectionLabel label="Morning Goals" color={colors.morning} />
            {morningLogs.map(log => (
              <CommitmentRow
                key={log.id}
                log={log}
                onToggle={() => handleToggle(log)}
                accentColor={colors.morning}
              />
            ))}
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={handleDismissMorning}
            >
              <Text style={styles.dismissBtnText}>Dismiss morning alarm</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Daily commitments */}
        {dailyLogs.length > 0 && (
          <>
            <SectionLabel label="Daily Commitments" color={colors.daily} />
            {dailyLogs.map(log => (
              <CommitmentRow
                key={log.id}
                log={log}
                onToggle={() => handleToggle(log)}
                accentColor={colors.daily}
              />
            ))}
          </>
        )}

        {logs.length === 0 && <EmptyState />}

        {/* Evening alarm controls */}
        {dailyLogs.length > 0 && (
          <View style={styles.alarmPanel}>
            {allDone ? (
              <View style={styles.allDoneBadge}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.allDoneText}>
                  Evening alarm dismissed — well done!
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.snoozeBtn}
                onPress={handleSnoozeEvening}
              >
                <Ionicons name="alarm-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.snoozeBtnText}>Snooze evening alarm</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <View style={[styles.sectionDot, { backgroundColor: color }]} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function CommitmentRow({
  log,
  onToggle,
  accentColor,
}: {
  log: DailyLogWithTitle;
  onToggle: () => void;
  accentColor: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const done = log.is_completed === 1;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => onToggle());
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.row, done && styles.rowDone]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.checkbox,
            done && { backgroundColor: accentColor, borderColor: accentColor },
          ]}
        >
          {done && <Ionicons name="checkmark" size={14} color="#000" />}
        </View>
        <Text style={[styles.rowText, done && styles.rowTextDone]}>
          {log.title}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No commitments yet</Text>
      <Text style={styles.emptyBody}>
        Go to the Commitments tab to add things you want to stay on top of.
      </Text>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 99,
  },
  progressLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowDone: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  rowTextDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  alarmPanel: {
    marginTop: spacing.xl,
  },
  allDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success + '44',
  },
  allDoneText: {
    color: colors.success,
    fontSize: 14,
  },
  snoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  snoozeBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  dismissBtn: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  dismissBtnText: {
    color: colors.morning,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});