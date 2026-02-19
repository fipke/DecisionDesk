import 'react-native-gesture-handler';
import './global.css';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { AppNavigator } from './src/navigation/AppNavigator';
import { MeetingProvider } from './src/state/MeetingContext';
import { SettingsProvider } from './src/state/SettingsContext';
import { ThemeProvider, useTheme } from './src/state/ThemeContext';

function AppInner() {
  const { theme } = useTheme();

  const navTheme = useMemo(
    () =>
      theme === 'dark'
        ? {
            ...DarkTheme,
            colors: {
              ...DarkTheme.colors,
              background: '#020617',
              card: '#0f172a',
              text: '#f8fafc',
              primary: '#34d399',
              border: '#1e293b',
              notification: '#22c55e',
            },
          }
        : {
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: '#f8fafc',
              card: '#ffffff',
              text: '#1e293b',
              primary: '#6366f1',
              border: '#e2e8f0',
              notification: '#6366f1',
            },
          },
    [theme],
  );

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <MeetingProvider>
          <AppInner />
        </MeetingProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
