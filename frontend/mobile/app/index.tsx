import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

export default function IndexRedirect() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)/events" />;
  }

  return <Redirect href="/sign-in" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
