import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

interface SettingsState {
  allowCellular: boolean;
  setAllowCellular: (value: boolean) => Promise<void>;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

const STORAGE_KEY = 'settings:allowCellular';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [allowCellular, setAllowCellularState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored !== null) {
        setAllowCellularState(stored === 'true');
      }
    });
  }, []);

  const setAllowCellular = async (value: boolean) => {
    setAllowCellularState(value);
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  };

  const value = useMemo(
    () => ({
      allowCellular,
      setAllowCellular
    }),
    [allowCellular]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('SettingsContext não encontrado');
  }
  return context;
}
