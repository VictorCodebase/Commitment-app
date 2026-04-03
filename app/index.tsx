import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { initDb, seedTodayLogs } from "../src/db/database";
import { requestNotificationPermissions, rescheduleAll } from "../src/utils/notifications";
import HomeScreen from "../src/screens/HomeScreen";
import { colors } from "../src/utils/theme";

export default function Index() {
	const [ready, setReady] = React.useState(false);

	useEffect(() => {
		(async () => {
			try {
				await initDb();
				await seedTodayLogs();
			} catch (e) {
				console.warn("[Init] DB setup failed:", e);
			}

			try {
				const granted = await requestNotificationPermissions();
				if (granted) await rescheduleAll();
			} catch (e) {
				console.warn("[Init] Notification setup failed:", e);
			}

			// Always unblock the UI, even if something above failed
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
