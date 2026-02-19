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

  async createPerson(payload: { displayName: string; fullName?: string; email?: string; notes?: string }): Promise<Person> {
    const { data } = await api.post('/people', payload);
    return data;
  },

  async updatePerson(id: string, payload: { displayName?: string; fullName?: string; email?: string; notes?: string }): Promise<Person> {
    const { data } = await api.put(`/people/${id}`, payload);
    return data;
  },

  async deletePerson(id: string): Promise<void> {
    await api.delete(`/people/${id}`);
  },

  async getMeetingPeople(meetingId: string): Promise<MeetingPerson[]> {
    const { data } = await api.get(`/meetings/${meetingId}/people`);
    return data;
  },
};
