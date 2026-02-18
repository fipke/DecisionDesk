import { api } from './api';

export interface Folder {
  id: string;
  name: string;
  path: string;
  parentId?: string;
  children?: Folder[];
}

export const folderService = {
  async listFolders(): Promise<Folder[]> {
    const { data } = await api.get('/folders');
    return data;
  },

  async createFolder(name: string, parentId?: string): Promise<Folder> {
    const { data } = await api.post('/folders', { name, parentId });
    return data;
  },
};
