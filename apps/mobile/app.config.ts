import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'DecisionDesk Mobile',
  slug: 'decisiondesk-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  sdkVersion: '50.0.0',
  platforms: ['ios'],
  scheme: 'decisiondesk',
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1'
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.decisiondesk.mobile',
    infoPlist: {
      NSMicrophoneUsageDescription: 'Precisamos acessar o microfone para gravar suas reuniões.',
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true
      }
    }
  },
  updates: {
    url: 'https://u.expo.dev/00000000-0000-0000-0000-000000000000'
  },
  runtimeVersion: {
    policy: 'appVersion'
  },
  experiments: {
    tsconfigPaths: true
  }
});
