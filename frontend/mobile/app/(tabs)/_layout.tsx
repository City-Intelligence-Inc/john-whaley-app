import { Tabs } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../../lib/theme';

// Custom tab bar icon components (no SVG/lucide dependencies)

function EventsIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={[iconStyles.wrapper, focused && iconStyles.wrapperActive]}>
      <View style={iconStyles.listIcon}>
        <View style={[iconStyles.listLine, { backgroundColor: color }]} />
        <View style={[iconStyles.listLine, { backgroundColor: color, width: 14 }]} />
        <View style={[iconStyles.listLine, { backgroundColor: color, width: 11 }]} />
      </View>
    </View>
  );
}

function LinkedInIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={[iconStyles.wrapper, focused && iconStyles.wrapperActive]}>
      <View style={[iconStyles.linkedinBox, { borderColor: color }]}>
        <Text style={[iconStyles.linkedinText, { color }]}>in</Text>
      </View>
    </View>
  );
}

function SettingsIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={[iconStyles.wrapper, focused && iconStyles.wrapperActive]}>
      <Text style={[iconStyles.gearText, { color }]}>{'\u2699\uFE0E'}</Text>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrapperActive: {
    backgroundColor: 'rgba(201, 168, 76, 0.12)',
  },
  listIcon: {
    gap: 3,
    alignItems: 'flex-start',
  },
  listLine: {
    height: 2,
    width: 16,
    borderRadius: 1,
  },
  linkedinBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkedinText: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: -1,
  },
  gearText: {
    fontSize: 22,
    marginTop: -1,
  },
});

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  // Skip auth guard — allow browsing without sign-in

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          position: 'absolute',
          bottom: 30,
          left: 20,
          right: 20,
          height: 64,
          borderRadius: 28,
          backgroundColor: 'rgba(22, 26, 36, 0.92)',
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(201, 168, 76, 0.15)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 24,
          elevation: 12,
          paddingBottom: 0,
          paddingTop: 0,
        },
        tabBarItemStyle: {
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.4,
          marginTop: 2,
        },
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
      }}
    >
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <EventsIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="linkedin"
        options={{
          title: 'LinkedIn',
          tabBarIcon: ({ color, focused }) => (
            <LinkedInIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <SettingsIcon color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
