import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DashboardScreen } from '../screens/DashboardScreen';
import { FolderScreen } from '../screens/FolderScreen';
import { MeetingDetailScreen } from '../screens/MeetingDetailScreen';
import { MeetingListScreen } from '../screens/MeetingListScreen';
import { PeopleScreen } from '../screens/PeopleScreen';
import { RecordScreen } from '../screens/RecordScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TemplatesScreen } from '../screens/TemplatesScreen';

export type RootStackParamList = {
  Dashboard: undefined;
  Home: undefined;
  Record: undefined;
  MeetingDetail: { id: string };
  Settings: undefined;
  Search: undefined;
  Folders: undefined;
  People: undefined;
  Templates: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerTintColor: '#e2e8f0',
  headerStyle: { backgroundColor: '#0b0e18' },
  headerTitleStyle: { fontWeight: '600' as const },
  contentStyle: { backgroundColor: '#0b0e18' },
};

export function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Dashboard" screenOptions={screenOptions}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="Home" component={MeetingListScreen} options={{ title: 'Gravações' }} />
      <Stack.Screen name="Record" component={RecordScreen} options={{ title: 'Nova gravação' }} />
      <Stack.Screen name="MeetingDetail" component={MeetingDetailScreen} options={{ title: 'Detalhes' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configurações' }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Buscar', presentation: 'modal' }} />
      <Stack.Screen name="Folders" component={FolderScreen} options={{ title: 'Pastas' }} />
      <Stack.Screen name="People" component={PeopleScreen} options={{ title: 'Pessoas' }} />
      <Stack.Screen name="Templates" component={TemplatesScreen} options={{ title: 'Templates' }} />
    </Stack.Navigator>
  );
}
