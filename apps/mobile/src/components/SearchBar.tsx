import { MagnifyingGlassIcon, XMarkIcon } from 'react-native-heroicons/outline';
import { Pressable, TextInput, View } from 'react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export function SearchBar({ value, onChangeText, placeholder = 'Buscar…', onClear }: SearchBarProps) {
  return (
    <View className="flex-row items-center rounded-xl bg-slate-800 px-3 py-2">
      <MagnifyingGlassIcon size={16} color="#64748b" />
      <TextInput
        className="ml-2 flex-1 text-sm text-slate-200"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        returnKeyType="search"
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <Pressable onPress={() => { onChangeText(''); onClear?.(); }}>
          <XMarkIcon size={16} color="#64748b" />
        </Pressable>
      )}
    </View>
  );
}
