import { Pressable, Text, View } from 'react-native';
import { StatusBadge } from './StatusBadge';

interface Meeting {
  id: string;
  title?: string;
  status: string;
  createdAt: string;
  durationSec?: number;
  costBrl?: number;
  costUsd?: number;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtCost(brl?: number, usd?: number): string | null {
  if (brl != null) return brl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (usd != null) return `$${usd.toFixed(4)}`;
  return null;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hoje';
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

interface MeetingCardProps {
  meeting: Meeting;
  onPress: () => void;
}

/**
 * Meeting list card showing title (or date fallback), duration, status badge, and cost.
 */
export function MeetingCard({ meeting, onPress }: MeetingCardProps) {
  const title = meeting.title || fmtDate(meeting.createdAt);
  const duration = meeting.durationSec != null ? fmtDuration(meeting.durationSec) : null;
  const cost = fmtCost(meeting.costBrl, meeting.costUsd);

  return (
    <Pressable
      onPress={onPress}
      className="mb-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 active:opacity-70"
    >
      <View className="flex-row items-start justify-between">
        <Text
          className="mr-3 flex-1 text-sm font-semibold text-slate-100"
          numberOfLines={1}
        >
          {title}
        </Text>
        <StatusBadge status={meeting.status as any} />
      </View>

      {(duration || cost) ? (
        <View className="mt-2 flex-row items-center gap-3">
          {duration ? (
            <Text className="text-xs text-slate-500">{duration}</Text>
          ) : null}
          {duration && cost ? (
            <Text className="text-xs text-slate-700">·</Text>
          ) : null}
          {cost ? (
            <Text className="text-xs font-medium text-emerald-400">{cost}</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
