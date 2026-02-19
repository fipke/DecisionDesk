import { Pressable, Text, View } from 'react-native';

interface ActionItem {
  text: string;
  assignee?: string;
  completed: boolean;
}

interface ActionItemRowProps {
  item: ActionItem;
  onToggle?: () => void;
}

/**
 * A single action item row with checkbox, text, and optional @assignee.
 */
export function ActionItemRow({ item, onToggle }: ActionItemRowProps) {
  return (
    <Pressable onPress={onToggle} className="mb-2 flex-row items-start gap-3">
      <View
        className={`mt-0.5 h-4 w-4 items-center justify-center rounded border ${
          item.completed ? 'border-indigo-500 bg-indigo-500' : 'border-slate-600 bg-transparent'
        }`}
      >
        {item.completed ? (
          <Text className="text-[10px] leading-none text-white">✓</Text>
        ) : null}
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm leading-snug ${
            item.completed ? 'text-slate-500 line-through' : 'text-slate-300'
          }`}
        >
          {item.text}
        </Text>
        {item.assignee ? (
          <Text className="mt-0.5 text-xs text-indigo-400">@{item.assignee}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
