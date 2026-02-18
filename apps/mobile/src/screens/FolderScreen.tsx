import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { folderService, type Folder } from '../services/folderService';
import type { RootStackParamList } from '../navigation/AppNavigator';

export type FolderScreenProps = NativeStackScreenProps<RootStackParamList, 'Folders'>;

export function FolderScreen({ navigation }: FolderScreenProps) {
  const [folders, setFolders] = useState<Folder[]>([]);

  useEffect(() => {
    folderService.listFolders().then(setFolders).catch(() => {});
  }, []);

  return (
    <View className="flex-1 bg-slate-950 px-4 pt-4">
      <Text className="mb-4 text-xl font-bold text-slate-100">Pastas</Text>
      <FlatList
        data={folders}
        keyExtractor={(f) => f.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.goBack()}
            className="mb-2 flex-row items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
          >
            <Text className="text-lg">📁</Text>
            <Text className="text-sm text-slate-200">{item.name}</Text>
            <Text className="ml-auto text-xs text-slate-500">{item.path}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
