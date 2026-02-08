import { useEffect } from 'react';
import * as Network from 'expo-network';
import { NetworkStateType } from 'expo-network';

import { useMeetings } from '../state/MeetingContext';
import { useSettings } from '../state/SettingsContext';

export function useSyncQueue() {
  const { syncPendingOperations } = useMeetings();
  const { allowCellular } = useSettings();

  useEffect(() => {
    let mounted = true;

    const trySync = async () => {
      const state = await Network.getNetworkStateAsync();
      if (!state.isConnected) {
        return;
      }
      if (state.type === NetworkStateType.CELLULAR && !allowCellular) {
        return;
      }
      await syncPendingOperations();
    };

    trySync();

    const subscription = Network.addNetworkStateListener(() => {
      if (mounted) {
        trySync();
      }
    });

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [allowCellular, syncPendingOperations]);
}
