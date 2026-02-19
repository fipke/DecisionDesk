import { Text, View } from 'react-native';
import { clsx } from 'clsx';

import { MeetingStatus } from '../types';
import { translateStatus } from '../utils/format';

export function StatusBadge({ status }: { status: MeetingStatus }) {
  const base = 'rounded-full px-3 py-1';
  const styles = clsx(base, {
    'bg-slate-700': status === 'PENDING_SYNC' || status === 'NEW',
    'bg-amber-500': status === 'PROCESSING',
    'bg-indigo-500': status === 'DONE',
    'bg-rose-600': status === 'ERROR'
  });

  return (
    <View className={styles}>
      <Text className="text-xs font-semibold uppercase tracking-wide text-slate-50">
        {translateStatus(status)}
      </Text>
    </View>
  );
}
