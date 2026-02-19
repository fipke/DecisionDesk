import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';

interface InMeetingNotesPadProps {
  visible: boolean;
  initialValue?: string;
  onSave: (text: string) => void;
  onClose: () => void;
}

export function InMeetingNotesPad({ visible, initialValue = '', onSave, onClose }: InMeetingNotesPadProps) {
  const [text, setText] = useState(initialValue);

  // Sync text when modal opens with a new initialValue
  useEffect(() => {
    if (visible) setText(initialValue);
  }, [visible, initialValue]);

  const handleSave = () => {
    onSave(text);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/50" onPress={onClose} />
      <View className="rounded-t-3xl border-t border-dd-border bg-dd-surface px-5 pt-4 pb-10">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-slate-100">Anotações da gravação</Text>
          <Pressable onPress={handleSave}>
            <Text className="text-sm font-medium text-indigo-400">Salvar</Text>
          </Pressable>
        </View>
        <TextInput
          className="min-h-[160px] text-sm leading-relaxed text-slate-300"
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          placeholder="Anote decisões, ações, observações…"
          placeholderTextColor="#475569"
          textAlignVertical="top"
        />
      </View>
    </Modal>
  );
}
