import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Cog6ToothIcon } from 'react-native-heroicons/outline';

import { MeetingCard } from '../components/MeetingCard';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useMeetings } from '../state/MeetingContext';
import { fetchStats, fetchCalendar } from '../services/api';
import type { DashboardStats, CalendarDay } from '../services/api';
import type { Meeting } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getCurrentWeekRange(): { from: string; to: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(monday), to: fmt(sunday) };
}

function buildWeekDays(from: string, calendarData: CalendarDay[]) {
  const monday = new Date(from + 'T00:00:00');
  const countMap = new Map<string, number>();
  for (const entry of calendarData) {
    countMap.set(entry.day, entry.count);
  }

  const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  const days: { label: string; date: string; count: number; isToday: boolean }[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({
      label: DAY_LABELS[i],
      date: dateStr,
      count: countMap.get(dateStr) ?? 0,
      isToday: dateStr === todayStr,
    });
  }
  return days;
}

function toCardMeeting(m: Meeting) {
  return {
    id: m.id,
    status: m.status,
    createdAt: m.createdAt,
    title: m.title ?? undefined,
    costBrl: m.costBrl ?? undefined,
    costUsd: m.costUsd ?? undefined,
    durationSec: m.durationSec ?? (m.minutes != null && m.minutes > 0 ? m.minutes * 60 : undefined),
    meetingTypeName: (m as any).meetingTypeName ?? undefined,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export type DashboardScreenProps = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { meetings } = useMeetings();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { from, to } = useMemo(() => getCurrentWeekRange(), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          className="h-10 w-10 items-center justify-center"
        >
          <Cog6ToothIcon size={22} color="#94a3b8" />
        </Pressable>
      ),
    });
  }, [navigation]);

  const loadData = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        fetchStats(),
        fetchCalendar(from, to),
      ]);
      setStats(s);
      setCalendar(c);
    } catch {
      // Offline — keep existing data or show placeholders
    }
    setLoading(false);
  }, [from, to]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      const run = async () => {
        await loadData();
        if (cancelled) return;
      };
      run();
      return () => { cancelled = true; };
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const recentMeetings = useMemo(() => {
    return [...meetings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [meetings]);

  const weekDays = useMemo(() => buildWeekDays(from, calendar), [from, calendar]);

  return (
    <ScrollView
      className="flex-1 bg-dd-base"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
      }
    >
      <View className="px-4 py-5">
        {/* Stats cards — 2x2 grid */}
        {loading ? (
          <View className="items-center justify-center py-8">
            <ActivityIndicator color="#818cf8" />
            <Text className="mt-2 text-sm text-slate-500">Carregando estatisticas...</Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[47%] flex-1 rounded-xl border border-dd-border bg-dd-surface p-4">
              <Text className="text-xs font-medium uppercase tracking-wider text-slate-500">Reunioes</Text>
              <Text className="mt-1 text-2xl font-semibold text-slate-100">
                {stats?.totalMeetings ?? '--'}
              </Text>
            </View>
            <View className="min-w-[47%] flex-1 rounded-xl border border-dd-border bg-dd-surface p-4">
              <Text className="text-xs font-medium uppercase tracking-wider text-slate-500">Gravadas</Text>
              <Text className="mt-1 text-2xl font-semibold text-slate-100">
                {stats ? formatMinutes(stats.totalMinutesRecorded) : '--'}
              </Text>
            </View>
            <View className="min-w-[47%] flex-1 rounded-xl border border-dd-border bg-dd-surface p-4">
              <Text className="text-xs font-medium uppercase tracking-wider text-slate-500">Processando</Text>
              <Text className={`mt-1 text-2xl font-semibold ${(stats?.pendingProcessing ?? 0) > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                {stats?.pendingProcessing ?? '--'}
              </Text>
            </View>
            <View className="min-w-[47%] flex-1 rounded-xl border border-dd-border bg-dd-surface p-4">
              <Text className="text-xs font-medium uppercase tracking-wider text-slate-500">Esta Semana</Text>
              <Text className="mt-1 text-2xl font-semibold text-slate-100">
                {stats?.thisWeekCount ?? '--'}
              </Text>
            </View>
          </View>
        )}

        {/* Weekly calendar */}
        <View className="mt-5 rounded-xl border border-dd-border bg-dd-surface p-4">
          <Text className="mb-3 text-sm font-semibold text-slate-100">Esta Semana</Text>
          <View className="flex-row justify-between">
            {weekDays.map((day) => (
              <View key={day.date} className="items-center">
                <Text className="mb-1 text-xs text-slate-500">
                  {day.count > 0 ? String(day.count) : ' '}
                </Text>
                <View
                  className={[
                    'h-10 w-10 items-center justify-center rounded-full',
                    day.count > 0
                      ? 'bg-indigo-500'
                      : day.isToday
                        ? 'border-2 border-indigo-500'
                        : 'bg-dd-elevated',
                  ].join(' ')}
                >
                  {day.count > 0 && (
                    <Text className="text-sm font-medium text-white">{day.count}</Text>
                  )}
                </View>
                <Text
                  className={`mt-1 text-xs font-medium ${day.isToday ? 'text-indigo-400' : 'text-slate-500'}`}
                >
                  {day.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent meetings */}
        <View className="mt-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-slate-100">Reunioes Recentes</Text>
            <Pressable onPress={() => navigation.navigate('Home')}>
              <Text className="text-xs text-indigo-400">Ver todas</Text>
            </Pressable>
          </View>

          {recentMeetings.length === 0 ? (
            <Text className="py-6 text-center text-sm text-slate-500">Nenhuma reuniao encontrada</Text>
          ) : (
            recentMeetings.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={toCardMeeting(m)}
                onPress={() => navigation.navigate('MeetingDetail', { id: m.id })}
              />
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
