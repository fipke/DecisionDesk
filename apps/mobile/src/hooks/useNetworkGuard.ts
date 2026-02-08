import { Alert } from 'react-native';
import * as Network from 'expo-network';
import { NetworkStateType } from 'expo-network';

import { useSettings } from '../state/SettingsContext';

export function useNetworkGuard() {
  const { allowCellular } = useSettings();

  const ensureAllowedConnection = async () => {
    const state = await Network.getNetworkStateAsync();
    if (!state.isConnected) {
      Alert.alert('Sem conexão', 'Conecte-se a uma rede para continuar.');
      throw new Error('offline');
    }
    if (state.type === NetworkStateType.CELLULAR && !allowCellular) {
      Alert.alert(
        'Uso de dados bloqueado',
        'Ative o uso de dados celulares nas configurações para enviar ou transcrever gravações.'
      );
      throw new Error('cellular blocked');
    }
    return state;
  };

  return { ensureAllowedConnection };
}
