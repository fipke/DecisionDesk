import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { RootStackParamList } from '../navigation/AppNavigator';
import { useSettings } from '../state/SettingsContext';

export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen() {
  const { allowCellular, setAllowCellular } = useSettings();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async (value: boolean) => {
    setIsUpdating(true);
    await setAllowCellular(value);
    setIsUpdating(false);
  };

  return (
    <View className="flex-1 bg-slate-950 px-6 py-8">
      <View className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-5">
        <View className="flex-row items-center justify-between">
          <View className="mr-4 flex-1">
            <Text className="text-base font-semibold text-slate-100">Permitir dados celulares</Text>
            <Text className="mt-2 text-sm text-slate-400">
              Quando desativado, as gravações só serão enviadas e transcritas no Wi‑Fi.
            </Text>
          </View>
          <Switch
            value={allowCellular}
            onValueChange={handleToggle}
            disabled={isUpdating}
            thumbColor={allowCellular ? '#34d399' : '#1e293b'}
            trackColor={{ false: '#1e293b', true: '#14532d' }}
          />
        </View>
      </View>
    </View>
  );
}
