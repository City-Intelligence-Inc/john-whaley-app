import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function EventsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.gold,
        headerTitleStyle: {
          fontWeight: '700',
          color: colors.text,
          fontSize: 18,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Events',
        }}
      />
      <Stack.Screen
        name="[sessionId]"
        options={{
          title: 'Applicants',
        }}
      />
    </Stack>
  );
}
