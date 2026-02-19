import { api } from './api';

export interface MeetingNotes {
  agendaMd?: string;
  liveNotesMd?: string;
  postNotesMd?: string;
}

export interface ActionItem {
  text: string;
  assignee?: string;
  completed: boolean;
}

export interface Decision {
  text: string;
}

export const notesService = {
  async getNotes(meetingId: string): Promise<MeetingNotes> {
    const { data } = await api.get(`/meetings/${meetingId}/notes`);
    return {
      agendaMd: data.agendaMd,
      liveNotesMd: data.liveNotesMd,
      postNotesMd: data.postNotesMd,
    };
  },

  async saveLiveNotes(meetingId: string, content: string): Promise<void> {
    await api.patch(`/meetings/${meetingId}/notes/live`, { content });
  },

  async saveAgenda(meetingId: string, content: string): Promise<void> {
    await api.patch(`/meetings/${meetingId}/notes/agenda`, { content });
  },

  async savePostNotes(meetingId: string, content: string): Promise<void> {
    await api.patch(`/meetings/${meetingId}/notes/post`, { content });
  },

  async getActionItems(meetingId: string): Promise<ActionItem[]> {
    const { data } = await api.get(`/meetings/${meetingId}/notes/action-items`);
    return data;
  },

  async getDecisions(meetingId: string): Promise<Decision[]> {
    const { data } = await api.get(`/meetings/${meetingId}/notes/decisions`);
    return data;
  },
};
