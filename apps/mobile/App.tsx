import 'react-native-gesture-handler';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { AppNavigator } from './src/navigation/AppNavigator';
import { MeetingProvider } from './src/state/MeetingContext';
import { SettingsProvider } from './src/state/SettingsContext';

export default function App() {
  const theme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: '#020617',
        card: '#0f172a',
        text: '#f8fafc',
        primary: '#34d399',
        border: '#1e293b',
        notification: '#22c55e'
      }
    }),
    []
  );

  return (
    <SettingsProvider>
      <MeetingProvider>
        <NavigationContainer theme={theme}>
          <StatusBar style="light" />
          <AppNavigator />
        </NavigationContainer>
      </MeetingProvider>
    </SettingsProvider>
  );
}
