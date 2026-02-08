import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MeetingDetailScreen } from '../screens/MeetingDetailScreen';
import { MeetingListScreen } from '../screens/MeetingListScreen';
import { RecordScreen } from '../screens/RecordScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type RootStackParamList = {
  Home: undefined;
  Record: undefined;
  MeetingDetail: { id: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerTintColor: '#e2e8f0',
        headerStyle: { backgroundColor: '#020617' },
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#020617' }
      }}
    >
      <Stack.Screen
        name="Home"
        component={MeetingListScreen}
        options={{ title: 'Reuniões' }}
      />
      <Stack.Screen
        name="Record"
        component={RecordScreen}
        options={{ title: 'Nova gravação' }}
      />
      <Stack.Screen
        name="MeetingDetail"
        component={MeetingDetailScreen}
        options={{ title: 'Detalhes da reunião' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Configurações' }}
      />
    </Stack.Navigator>
  );
}
