import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'DecisionDesk Mobile',
  slug: 'decisiondesk-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  sdkVersion: '51.0.0',
  platforms: ['ios'],
  runtimeVersion: {
    policy: 'appVersion'
  },
  scheme: 'decisiondesk',
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8087/api/v1'
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
    enabled: false
  },
  experiments: {
    tsconfigPaths: true
  }
});
