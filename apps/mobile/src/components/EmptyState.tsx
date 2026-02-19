import { Text, View } from 'react-native';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = '📋', title, subtitle }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text className="text-5xl">{icon}</Text>
      <Text className="mt-4 text-center text-base font-semibold text-slate-200">{title}</Text>
      {subtitle && (
        <Text className="mt-2 text-center text-sm text-slate-400">{subtitle}</Text>
      )}
    </View>
  );
}
