import { Pressable, Text, View } from 'react-native';

interface Tab<T extends string> {
  key: T;
  label: string;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (tab: T) => void;
}

export function TabBar<T extends string>({ tabs, active, onChange }: TabBarProps<T>) {
  return (
    <View className="flex-row border-b border-slate-800">
      {tabs.map(({ key, label }) => (
        <Pressable
          key={key}
          onPress={() => onChange(key)}
          className="flex-1 items-center py-3"
        >
          <Text
            className={`text-sm font-medium ${
              active === key ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            {label}
          </Text>
          {active === key && (
            <View className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-emerald-400" />
          )}
        </Pressable>
      ))}
    </View>
  );
}
