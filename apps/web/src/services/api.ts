import axios from 'axios';
import type { Meeting, Person, PagedResponse } from '../types';

/** Base URL is configurable via VITE_API_URL env var; defaults to localhost:8087. */
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8087/api/v1';

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Meetings ─────────────────────────────────────────────────────────────────

/** Fetch paginated list of meetings. Returns raw content array for simplicity. */
export async function fetchMeetings(): Promise<Meeting[]> {
  const { data } = await client.get<PagedResponse<Meeting> | Meeting[]>('/meetings', {
    params: { size: 200 },
  });
  // Backend may return a Page object or a plain array depending on version.
  if (Array.isArray(data)) {
    return data;
  }
  return (data as PagedResponse<Meeting>).content;
}

/** Fetch a single meeting by ID. */
export async function fetchMeeting(id: string): Promise<Meeting> {
  const { data } = await client.get<Meeting>(`/meetings/${id}`);
  return data;
}

// ─── People ───────────────────────────────────────────────────────────────────

/** Fetch all people (participants directory). */
export async function fetchPeople(q?: string): Promise<Person[]> {
  const { data } = await client.get<PagedResponse<Person> | Person[]>('/people', {
    params: { q, size: 200 },
  });
  if (Array.isArray(data)) {
    return data;
  }
  return (data as PagedResponse<Person>).content;
}
