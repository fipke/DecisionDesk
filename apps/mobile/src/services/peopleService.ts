import { api } from './api';

export interface Person {
  id: string;
  displayName: string;
  fullName?: string;
  email?: string;
  notes?: string;
}

export interface MeetingPerson {
  personId: string;
  person: Person;
  role: 'participant' | 'mentioned';
}

export const peopleService = {
  async listPeople(query?: string): Promise<Person[]> {
    const { data } = await api.get('/people', {
      params: query ? { q: query } : undefined,
    });
    return data;
  },

  async getMeetingPeople(meetingId: string): Promise<MeetingPerson[]> {
    const { data } = await api.get(`/meetings/${meetingId}/people`);
    return data;
  },
};
