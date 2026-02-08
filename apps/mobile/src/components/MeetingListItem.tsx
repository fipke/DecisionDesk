import { Text, TouchableOpacity, View } from 'react-native';

import { Meeting } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { StatusBadge } from './StatusBadge';

interface MeetingListItemProps {
  meeting: Meeting;
  onPress: () => void;
}

export function MeetingListItem({ meeting, onPress }: MeetingListItemProps) {
  return (
    <TouchableOpacity
      className="mb-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4"
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-slate-200">
          {formatDate(meeting.createdAt)}
        </Text>
        <StatusBadge status={meeting.status} />
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-xs uppercase tracking-wide text-slate-400">Custo estimado</Text>
        <Text className="text-sm font-semibold text-slate-100">
          {formatCurrency(meeting.costBrl ?? meeting.costUsd ?? null, meeting.costBrl != null ? 'BRL' : 'USD')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
