import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { initDb, seedTodayLogs } from "../src/db/database";
import { requestNotificationPermissions, rescheduleAll } from "../src/utils/notifications";
import HomeScreen from "../src/screens/HomeScreen";
import { colors } from "../src/utils/theme";

export default function Index() {
	const [ready, setReady] = React.useState(false);

	useEffect(() => {
		(async () => {
			await initDb();
			await seedTodayLogs();
			const granted = await requestNotificationPermissions();
			if (granted) await rescheduleAll();
			setReady(true);
		})();
	}, []);

	if (!ready) {
		return (
			<View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
				<ActivityIndicator color={colors.accent} />
			</View>
		);
	}

	return <HomeScreen />;
}
