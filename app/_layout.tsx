import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/utils/theme";

export default function Layout() {
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarStyle: {
					backgroundColor: colors.surface,
					borderTopColor: colors.border,
					borderTopWidth: 1,
					height: 60,
					paddingBottom: 8,
				},
				tabBarActiveTintColor: colors.accent,
				tabBarInactiveTintColor: colors.textMuted,
				tabBarLabelStyle: {
					fontSize: 11,
					fontWeight: "600",
					letterSpacing: 0.5,
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Today",
					tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="commitments"
				options={{
					title: "Commitments",
					tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="settings"
				options={{
					title: "Settings",
					tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
				}}
			/>
		</Tabs>
	);
}
