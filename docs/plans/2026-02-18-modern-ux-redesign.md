# Modern UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign DecisionDesk across all three clients (Mobile priority → Desktop → Web) with a Granola-style Transcript/Notes/Summary split view, live waveform recording, in-meeting note pad, and full-text search.

**Architecture:** Mobile is the design reference — 8 screens with shared NativeWind components. Desktop expands from 2→5 screens using the same design tokens and new IPC handlers for meeting/notes data. Web (PR10) is built from scratch as a React/Vite sidebar+panel app calling the existing backend. No backend changes needed — all APIs are already implemented.

**Tech Stack:** React Native 0.81 + Expo + NativeWind (mobile); Electron 33 + React 19 + Tailwind (desktop); React 19 + Vite + Tailwind + Radix UI (web); Jest + @testing-library/react-native (mobile tests); Jest + @testing-library/react (web tests).

**Design doc:** `docs/plans/2026-02-18-modern-ux-redesign-design.md`

---

## Phase 1 — packages/types

### Task 1: Expand shared TypeScript types

**Files:**
- Modify: `packages/types/src/index.ts`

**Step 1: Read the current file**

```bash
cat packages/types/src/index.ts
# Expected: only "ID" and "ISODate" type aliases
```

**Step 2: Replace with full interface library**

Replace entire `packages/types/src/index.ts`:

```typescript
// ─── Primitives ────────────────────────────────────────────────
export type ID = string;
export type ISODate = string;

// ─── Meetings ──────────────────────────────────────────────────
export type MeetingStatus = 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';

export interface Meeting {
  id: ID;
  title?: string;
  status: MeetingStatus;
  createdAt: ISODate;
  updatedAt?: ISODate;
  durationSec?: number;
  costBrl?: number;
  costUsd?: number;
  folderId?: string;
  meetingTypeId?: string;
  tags?: Record<string, string>;
  transcriptText?: string;
  remoteId?: string;
}

// ─── Transcript ────────────────────────────────────────────────
export interface TranscriptLine {
  speaker?: string;
  startSec?: number;
  endSec?: number;
  text: string;
}

export interface Transcript {
  meetingId: ID;
  lines: TranscriptLine[];
  rawText: string;
  provider: string;
  language: string;
  createdAt: ISODate;
}

// ─── Notes ─────────────────────────────────────────────────────
export interface MeetingNotes {
  agendaMd?: string;
  liveNotesMd?: string;
  postNotesMd?: string;
  updatedAt?: ISODate;
}

export interface ActionItem {
  text: string;
  assignee?: string;
  completed: boolean;
}

export interface Decision {
  text: string;
}

// ─── People ────────────────────────────────────────────────────
export interface Person {
  id: ID;
  displayName: string;
  fullName?: string;
  email?: string;
  notes?: string;
}

export type PersonRole = 'participant' | 'mentioned';

export interface MeetingPerson {
  personId: ID;
  person: Person;
  role: PersonRole;
}

// ─── Organisation ──────────────────────────────────────────────
export interface Folder {
  id: ID;
  name: string;
  path: string;
  parentId?: string;
  children?: Folder[];
}

export interface MeetingType {
  id: ID;
  name: string;
  description?: string;
}

// ─── Summaries ─────────────────────────────────────────────────
export interface Summary {
  id: ID;
  meetingId: ID;
  textMd: string;
  model: string;
  templateId?: string;
  tokensUsed?: number;
  updatedAt: ISODate;
}

export interface SummaryTemplate {
  id: ID;
  name: string;
  isDefault: boolean;
  outputFormat?: string;
}

// ─── Desktop Queue ─────────────────────────────────────────────
export type QueueJobStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface QueueJob {
  id: ID;
  meetingId: ID;
  status: QueueJobStatus;
  model: string;
  language: string;
  diarization: boolean;
  retryCount?: number;
  errorMessage?: string;
  lockedAt?: ISODate;
  completedAt?: ISODate;
  createdAt: ISODate;
}

// ─── Connectivity ──────────────────────────────────────────────
export interface ConnectivityStatus {
  online: boolean;
  backendReachable: boolean;
}

// ─── Highlight (for search) ────────────────────────────────────
export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}
```

**Step 3: Typecheck**

```bash
cd packages/types && npx tsc --noEmit
# Expected: no errors
```

**Step 4: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): expand shared type library with full domain interfaces"
```

---

## Phase 2 — packages/utils

### Task 2: Expand shared utilities with TDD

**Files:**
- Modify: `packages/utils/src/index.ts`
- Create: `packages/utils/src/__tests__/utils.test.ts`

**Step 1: Write failing tests**

Create `packages/utils/src/__tests__/utils.test.ts`:

```typescript
import {
  formatDuration,
  formatDurationSec,
  formatRelativeDate,
  groupByDate,
  highlightMatches,
  parseSpeakerLine,
  toBRL,
} from '../index';

describe('formatDuration', () => {
  it('formats milliseconds to MM:SS', () => {
    expect(formatDuration(270000)).toBe('04:30');
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(3661000)).toBe('61:01');
  });
});

describe('formatDurationSec', () => {
  it('formats seconds to MM:SS', () => {
    expect(formatDurationSec(270)).toBe('04:30');
    expect(formatDurationSec(0)).toBe('00:00');
  });
});

describe('formatRelativeDate', () => {
  it('returns Hoje for today', () => {
    const today = new Date().toISOString();
    expect(formatRelativeDate(today)).toBe('Hoje');
  });
  it('returns Ontem for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect(formatRelativeDate(yesterday)).toBe('Ontem');
  });
  it('returns formatted date for older dates', () => {
    expect(formatRelativeDate('2026-01-15T10:00:00Z')).toMatch(/\d{1,2} \w+/);
  });
});

describe('groupByDate', () => {
  it('groups items by relative date key', () => {
    const today = new Date().toISOString();
    const items = [
      { id: '1', createdAt: today },
      { id: '2', createdAt: today },
    ];
    const grouped = groupByDate(items, (i) => i.createdAt);
    expect(grouped['Hoje']).toHaveLength(2);
  });
});

describe('highlightMatches', () => {
  it('splits text into highlighted and plain segments', () => {
    const result = highlightMatches('Hello world', 'world');
    expect(result).toEqual([
      { text: 'Hello ', highlighted: false },
      { text: 'world', highlighted: true },
    ]);
  });
  it('returns single plain segment when no match', () => {
    const result = highlightMatches('Hello world', 'xyz');
    expect(result).toEqual([{ text: 'Hello world', highlighted: false }]);
  });
  it('returns single plain segment for empty query', () => {
    const result = highlightMatches('Hello', '');
    expect(result).toEqual([{ text: 'Hello', highlighted: false }]);
  });
});

describe('parseSpeakerLine', () => {
  it('parses "00:01 John: Hello" format', () => {
    const result = parseSpeakerLine('00:01 John: Hello there');
    expect(result).toEqual({ speaker: 'John', startSec: 1, text: 'Hello there' });
  });
  it('returns null for plain text without speaker', () => {
    expect(parseSpeakerLine('just some text')).toBeNull();
  });
});

describe('toBRL', () => {
  it('formats number as BRL currency', () => {
    const result = toBRL(1.23);
    expect(result).toContain('1');
    expect(result).toContain('23');
  });
});
```

**Step 2: Run tests — expect failures**

```bash
cd packages/utils && npm test
# Expected: FAIL — most functions not exported yet
```

**Step 3: Implement utilities**

Replace `packages/utils/src/index.ts`:

```typescript
import type { HighlightSegment, TranscriptLine } from '@decisiondesk/types';

// ─── Duration ──────────────────────────────────────────────────
export function formatDuration(ms: number): string {
  return formatDurationSec(Math.floor(ms / 1000));
}

export function formatDurationSec(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Date ──────────────────────────────────────────────────────
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000);

  if (date.toDateString() === todayStr) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

export function groupByDate<T>(
  items: T[],
  getDate: (item: T) => string,
): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = formatRelativeDate(getDate(item));
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

// ─── Search highlight ──────────────────────────────────────────
export function highlightMatches(
  text: string,
  query: string,
): HighlightSegment[] {
  if (!query.trim()) return [{ text, highlighted: false }];

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      highlighted: regex.test(part),
    }));
}

// ─── Transcript parsing ────────────────────────────────────────
// Matches "MM:SS Speaker: text" or "HH:MM:SS Speaker: text"
const SPEAKER_LINE_RE = /^(?:(\d+):)?(\d{2}):(\d{2})\s+([^:]+):\s+(.+)$/;

export function parseSpeakerLine(raw: string): TranscriptLine | null {
  const m = raw.match(SPEAKER_LINE_RE);
  if (!m) return null;

  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const minutes = parseInt(m[2], 10);
  const seconds = parseInt(m[3], 10);
  const startSec = hours * 3600 + minutes * 60 + seconds;

  return { speaker: m[4].trim(), startSec, text: m[5].trim() };
}

export function extractSpeakers(lines: TranscriptLine[]): string[] {
  return [...new Set(lines.map((l) => l.speaker).filter(Boolean) as string[])];
}

// ─── Currency ─────────────────────────────────────────────────
export function toBRL(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatCurrency(
  amount: number | null,
  currency: 'BRL' | 'USD',
): string {
  if (amount === null) return '—';
  if (currency === 'BRL') return toBRL(amount);
  return `$${amount.toFixed(4)}`;
}
```

**Step 4: Run tests — expect pass**

```bash
cd packages/utils && npm test
# Expected: all tests PASS
```

**Step 5: Commit**

```bash
git add packages/utils/src/index.ts packages/utils/src/__tests__/utils.test.ts
git commit -m "feat(utils): add formatDuration, groupByDate, highlightMatches, parseSpeakerLine"
```

---

## Phase 3 — Mobile Components

### Task 3: WaveformView + InMeetingNotesPad

**Files:**
- Create: `apps/mobile/src/components/WaveformView.tsx`
- Create: `apps/mobile/src/components/InMeetingNotesPad.tsx`

**Step 1: Create WaveformView**

Create `apps/mobile/src/components/WaveformView.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

interface WaveformViewProps {
  isRecording: boolean;
  barCount?: number;
  height?: number;
}

export function WaveformView({ isRecording, barCount = 30, height = 56 }: WaveformViewProps) {
  const animations = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.15))
  ).current;

  useEffect(() => {
    if (!isRecording) {
      animations.forEach((anim) => {
        Animated.timing(anim, { toValue: 0.15, duration: 300, useNativeDriver: true }).start();
      });
      return;
    }

    const anims = animations.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.2 + Math.random() * 0.8,
            duration: 200 + Math.random() * 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
            delay: i * 30,
          }),
          Animated.timing(anim, {
            toValue: 0.1 + Math.random() * 0.3,
            duration: 200 + Math.random() * 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );

    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [isRecording, animations]);

  return (
    <View className="flex-row items-end justify-center gap-[2px]" style={{ height }}>
      {animations.map((anim, i) => (
        <Animated.View
          key={i}
          className="w-[3px] rounded-full bg-emerald-400"
          style={{ height: height, transform: [{ scaleY: anim }] }}
        />
      ))}
    </View>
  );
}
```

**Step 2: Create InMeetingNotesPad**

Create `apps/mobile/src/components/InMeetingNotesPad.tsx`:

```typescript
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useRef, useState } from 'react';

interface InMeetingNotesPadProps {
  visible: boolean;
  initialValue?: string;
  onSave: (text: string) => void;
  onClose: () => void;
}

export function InMeetingNotesPad({ visible, initialValue = '', onSave, onClose }: InMeetingNotesPadProps) {
  const [text, setText] = useState(initialValue);
  const inputRef = useRef<TextInput>(null);

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
      <View className="rounded-t-3xl border-t border-slate-700 bg-slate-900 px-5 pt-4 pb-10">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-slate-100">Anotações da reunião</Text>
          <Pressable onPress={handleSave}>
            <Text className="text-sm font-medium text-emerald-400">Salvar</Text>
          </Pressable>
        </View>
        <TextInput
          ref={inputRef}
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
```

**Step 3: Commit**

```bash
git add apps/mobile/src/components/WaveformView.tsx apps/mobile/src/components/InMeetingNotesPad.tsx
git commit -m "feat(mobile): add WaveformView and InMeetingNotesPad components"
```

---

### Task 4: TabBar, TranscriptView, SearchBar, EmptyState

**Files:**
- Create: `apps/mobile/src/components/TabBar.tsx`
- Create: `apps/mobile/src/components/TranscriptView.tsx`
- Create: `apps/mobile/src/components/SearchBar.tsx`
- Create: `apps/mobile/src/components/EmptyState.tsx`

**Step 1: Create TabBar**

```typescript
// apps/mobile/src/components/TabBar.tsx
import { Pressable, Text, View } from 'react-native';

interface TabBarProps<T extends string> {
  tabs: { key: T; label: string }[];
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
```

**Step 2: Create TranscriptView**

```typescript
// apps/mobile/src/components/TranscriptView.tsx
import { ScrollView, Text, View } from 'react-native';
import type { TranscriptLine, HighlightSegment } from '@decisiondesk/types';
import { highlightMatches, formatDurationSec } from '@decisiondesk/utils';

interface TranscriptViewProps {
  lines: TranscriptLine[];
  searchQuery?: string;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments: HighlightSegment[] = query ? highlightMatches(text, query) : [{ text, highlighted: false }];
  return (
    <Text className="text-sm leading-relaxed text-slate-300">
      {segments.map((seg, i) =>
        seg.highlighted ? (
          <Text key={i} className="rounded bg-emerald-950 text-emerald-300">{seg.text}</Text>
        ) : (
          <Text key={i}>{seg.text}</Text>
        )
      )}
    </Text>
  );
}

export function TranscriptView({ lines, searchQuery = '' }: TranscriptViewProps) {
  if (lines.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6 py-12">
        <Text className="text-center text-sm text-slate-500">
          A transcrição será exibida aqui após o processamento.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4 py-3">
      {lines.map((line, idx) => (
        <View key={idx} className="mb-4">
          <View className="flex-row items-center gap-2">
            {line.startSec !== undefined && (
              <Text className="font-mono text-xs text-slate-500">
                {formatDurationSec(line.startSec)}
              </Text>
            )}
            {line.speaker && (
              <Text className="text-xs font-semibold text-emerald-400">{line.speaker}</Text>
            )}
          </View>
          <HighlightedText text={line.text} query={searchQuery} />
        </View>
      ))}
    </ScrollView>
  );
}
```

**Step 3: Create SearchBar**

```typescript
// apps/mobile/src/components/SearchBar.tsx
import { Pressable, TextInput, View } from 'react-native';
import { MagnifyingGlassIcon, XMarkIcon } from 'react-native-heroicons/outline';

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
```

**Step 4: Create EmptyState**

```typescript
// apps/mobile/src/components/EmptyState.tsx
import { Text, View } from 'react-native';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = '📋', title, subtitle }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text className="text-5xl">{icon}</Text>
      <Text className="mt-4 text-center text-base font-semibold text-slate-200">{title}</Text>
      {subtitle && (
        <Text className="mt-2 text-center text-sm text-slate-400">{subtitle}</Text>
      )}
    </View>
  );
}
```

**Step 5: Commit**

```bash
git add apps/mobile/src/components/TabBar.tsx apps/mobile/src/components/TranscriptView.tsx apps/mobile/src/components/SearchBar.tsx apps/mobile/src/components/EmptyState.tsx
git commit -m "feat(mobile): add TabBar, TranscriptView, SearchBar, EmptyState components"
```

---

### Task 5: AINotesView, SummaryView, MeetingCard, ActionItemRow

**Files:**
- Create: `apps/mobile/src/components/AINotesView.tsx`
- Create: `apps/mobile/src/components/SummaryView.tsx`
- Create: `apps/mobile/src/components/MeetingCard.tsx`
- Create: `apps/mobile/src/components/ActionItemRow.tsx`

**Step 1: Create AINotesView**

```typescript
// apps/mobile/src/components/AINotesView.tsx
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { ActionItem, Decision } from '@decisiondesk/types';
import { ActionItemRow } from './ActionItemRow';

interface AINotesViewProps {
  liveNotes: string;
  actionItems: ActionItem[];
  decisions: Decision[];
  onNotesChange: (text: string) => void;
  onGenerateAI: () => void;
  isGenerating?: boolean;
}

export function AINotesView({
  liveNotes,
  actionItems,
  decisions,
  onNotesChange,
  onGenerateAI,
  isGenerating = false,
}: AINotesViewProps) {
  return (
    <ScrollView className="flex-1 px-4 py-3">
      <TextInput
        className="min-h-[120px] rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm leading-relaxed text-slate-300"
        value={liveNotes}
        onChangeText={onNotesChange}
        multiline
        placeholder="Adicione anotações livres da reunião…"
        placeholderTextColor="#475569"
        textAlignVertical="top"
      />

      {actionItems.length > 0 && (
        <View className="mt-5">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            📋 Action Items
          </Text>
          {actionItems.map((item, i) => (
            <ActionItemRow key={i} item={item} />
          ))}
        </View>
      )}

      {decisions.length > 0 && (
        <View className="mt-5">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            ✅ Decisões
          </Text>
          {decisions.map((d, i) => (
            <Text key={i} className="mb-1 text-sm text-slate-300">• {d.text}</Text>
          ))}
        </View>
      )}

      <Pressable
        onPress={onGenerateAI}
        disabled={isGenerating}
        className="mt-6 items-center rounded-xl border border-emerald-800 bg-emerald-950 py-3"
      >
        <Text className="text-sm font-medium text-emerald-400">
          {isGenerating ? 'Gerando…' : 'Gerar notas com IA'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
```

**Step 2: Create ActionItemRow**

```typescript
// apps/mobile/src/components/ActionItemRow.tsx
import { Pressable, Text, View } from 'react-native';
import type { ActionItem } from '@decisiondesk/types';

interface ActionItemRowProps {
  item: ActionItem;
  onToggle?: () => void;
}

export function ActionItemRow({ item, onToggle }: ActionItemRowProps) {
  return (
    <Pressable onPress={onToggle} className="mb-2 flex-row items-start gap-3">
      <View className={`mt-0.5 h-4 w-4 rounded border ${item.completed ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'}`}>
        {item.completed && <Text className="text-center text-xs leading-4 text-white">✓</Text>}
      </View>
      <View className="flex-1">
        <Text className={`text-sm ${item.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
          {item.text}
        </Text>
        {item.assignee && (
          <Text className="mt-0.5 text-xs text-emerald-400">@{item.assignee}</Text>
        )}
      </View>
    </Pressable>
  );
}
```

**Step 3: Create SummaryView**

```typescript
// apps/mobile/src/components/SummaryView.tsx
import { Pressable, ScrollView, Text, View } from 'react-native';

interface SummaryViewProps {
  summaryMd?: string;
  onGenerate: (templateId?: string) => void;
  isGenerating?: boolean;
  templates?: { id: string; name: string }[];
  selectedTemplateId?: string;
  onSelectTemplate?: (id: string) => void;
}

export function SummaryView({
  summaryMd,
  onGenerate,
  isGenerating = false,
  templates = [],
  selectedTemplateId,
  onSelectTemplate,
}: SummaryViewProps) {
  if (summaryMd) {
    return (
      <ScrollView className="flex-1 px-4 py-3">
        <Text className="text-sm leading-relaxed text-slate-300">{summaryMd}</Text>
        <Pressable
          onPress={() => onGenerate(selectedTemplateId)}
          disabled={isGenerating}
          className="mt-6 items-center rounded-xl border border-slate-700 py-3"
        >
          <Text className="text-sm text-slate-400">
            {isGenerating ? 'Gerando…' : 'Regenerar resumo'}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      {templates.length > 0 && (
        <View className="mb-6 flex-row flex-wrap justify-center gap-2">
          {templates.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onSelectTemplate?.(t.id)}
              className={`rounded-full px-4 py-1.5 ${selectedTemplateId === t.id ? 'bg-emerald-600' : 'bg-slate-800'}`}
            >
              <Text className={`text-sm ${selectedTemplateId === t.id ? 'text-white' : 'text-slate-300'}`}>
                {t.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable
        onPress={() => onGenerate(selectedTemplateId)}
        disabled={isGenerating}
        className="rounded-xl bg-emerald-600 px-8 py-3"
      >
        <Text className="text-sm font-semibold text-white">
          {isGenerating ? 'Gerando…' : 'Gerar Resumo'}
        </Text>
      </Pressable>
    </View>
  );
}
```

**Step 4: Create MeetingCard**

```typescript
// apps/mobile/src/components/MeetingCard.tsx
import { Pressable, Text, View } from 'react-native';
import type { Meeting } from '@decisiondesk/types';
import { formatRelativeDate, formatDurationSec, formatCurrency } from '@decisiondesk/utils';
import { StatusBadge } from './StatusBadge';

interface MeetingCardProps {
  meeting: Meeting;
  onPress: () => void;
}

export function MeetingCard({ meeting, onPress }: MeetingCardProps) {
  const title = meeting.title || formatRelativeDate(meeting.createdAt);
  const duration = meeting.durationSec ? formatDurationSec(meeting.durationSec) : null;
  const cost = meeting.costBrl != null
    ? formatCurrency(meeting.costBrl, 'BRL')
    : meeting.costUsd != null
      ? formatCurrency(meeting.costUsd, 'USD')
      : null;

  return (
    <Pressable
      onPress={onPress}
      className="mb-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 active:opacity-70"
    >
      <View className="flex-row items-start justify-between">
        <Text className="flex-1 text-sm font-semibold text-slate-100" numberOfLines={1}>
          {title}
        </Text>
        <StatusBadge status={meeting.status} />
      </View>
      <View className="mt-2 flex-row items-center gap-3">
        {duration && (
          <Text className="text-xs text-slate-500">{duration}</Text>
        )}
        {duration && cost && <Text className="text-xs text-slate-700">·</Text>}
        {cost && (
          <Text className="text-xs font-medium text-emerald-400">{cost}</Text>
        )}
      </View>
    </Pressable>
  );
}
```

**Step 5: Commit**

```bash
git add apps/mobile/src/components/AINotesView.tsx apps/mobile/src/components/SummaryView.tsx apps/mobile/src/components/MeetingCard.tsx apps/mobile/src/components/ActionItemRow.tsx
git commit -m "feat(mobile): add AINotesView, SummaryView, MeetingCard, ActionItemRow components"
```

---

## Phase 4 — Mobile Screen Redesigns

### Task 6: Redesign MeetingListScreen

**Files:**
- Modify: `apps/mobile/src/screens/MeetingListScreen.tsx`

**Step 1: Read and understand the current file**

Read `apps/mobile/src/screens/MeetingListScreen.tsx` — note it uses `FlatList`, no search, no grouping, button at top.

**Step 2: Replace with redesigned version**

```typescript
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from 'react-native';
import { Cog6ToothIcon, FolderIcon, PlusIcon } from 'react-native-heroicons/outline';
import * as Network from 'expo-network';
import { NetworkStateType } from 'expo-network';

import { EmptyState } from '../components/EmptyState';
import { MeetingCard } from '../components/MeetingCard';
import { SearchBar } from '../components/SearchBar';
import { useSyncQueue } from '../hooks/useSyncQueue';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useMeetings } from '../state/MeetingContext';
import { useSettings } from '../state/SettingsContext';
import { groupByDate } from '@decisiondesk/utils';
import type { Meeting } from '@decisiondesk/types';

export type MeetingListScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function MeetingListScreen({ navigation }: MeetingListScreenProps) {
  const { meetings, loading, syncPendingOperations } = useMeetings();
  const { allowCellular } = useSettings();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useSyncQueue();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={() => navigation.navigate('Folders')} className="mr-2">
          <FolderIcon size={22} color="#94a3b8" />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('Settings')}>
          <Cog6ToothIcon size={22} color="#94a3b8" />
        </Pressable>
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      Network.getNetworkStateAsync().then((state) => {
        if (!state.isConnected) return;
        if (state.type === NetworkStateType.CELLULAR && !allowCellular) return;
        syncPendingOperations();
      });
    }, [allowCellular, syncPendingOperations])
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter(
      (m: Meeting) =>
        m.title?.toLowerCase().includes(q) ||
        m.transcriptText?.toLowerCase().includes(q)
    );
  }, [meetings, search]);

  const sections = useMemo(() => {
    const grouped = groupByDate(filtered, (m: Meeting) => m.createdAt);
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [filtered]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncPendingOperations();
    } finally {
      setRefreshing(false);
    }
  }, [syncPendingOperations]);

  return (
    <View className="flex-1 bg-slate-950">
      <View className="px-4 pt-3 pb-2">
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar reuniões…"
        />
      </View>

      {meetings.length === 0 && !loading ? (
        <EmptyState
          icon="🎙"
          title="Nenhuma reunião ainda"
          subtitle={'Toque em ⊕ para capturar a próxima conversa.'}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#34d399" />
          }
          renderSectionHeader={({ section: { title } }) => (
            <Text className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {title}
            </Text>
          )}
          renderItem={({ item }) => (
            <MeetingCard
              meeting={item}
              onPress={() => navigation.navigate('MeetingDetail', { id: item.id })}
            />
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => navigation.navigate('Record')}
        className="absolute bottom-8 right-5 h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-lg active:bg-emerald-600"
      >
        <PlusIcon size={26} color="#0f172a" />
      </Pressable>
    </View>
  );
}
```

**Step 3: Verify typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
# Expected: no errors
```

**Step 4: Commit**

```bash
git add apps/mobile/src/screens/MeetingListScreen.tsx
git commit -m "feat(mobile): redesign MeetingListScreen with search, SectionList grouping, FAB"
```

---

### Task 7: Redesign RecordScreen

**Files:**
- Modify: `apps/mobile/src/screens/RecordScreen.tsx`

**Step 1: Replace with redesigned version**

```typescript
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Network from 'expo-network';
import { NetworkStateType } from 'expo-network';

import { InMeetingNotesPad } from '../components/InMeetingNotesPad';
import { WaveformView } from '../components/WaveformView';
import { useNetworkGuard } from '../hooks/useNetworkGuard';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useMeetings } from '../state/MeetingContext';
import { useSettings } from '../state/SettingsContext';
import { formatDuration } from '@decisiondesk/utils';

export type RecordScreenProps = NativeStackScreenProps<RootStackParamList, 'Record'>;

export function RecordScreen({ navigation }: RecordScreenProps) {
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [durationMillis, setDurationMillis] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showNotesPad, setShowNotesPad] = useState(false);
  const [liveNotes, setLiveNotes] = useState('');
  const { recordAndQueue, syncPendingOperations } = useMeetings();
  const { ensureAllowedConnection } = useNetworkGuard();
  const { allowCellular } = useSettings();

  useEffect(() => {
    if (!recording) return;
    const sub = (status: Audio.RecordingStatus) => {
      if (status.isRecording) setDurationMillis(status.durationMillis ?? 0);
    };
    recording.setOnRecordingStatusUpdate(sub);
    return () => recording.setOnRecordingStatusUpdate(undefined);
  }, [recording]);

  useEffect(() => {
    Network.getNetworkStateAsync().then((state) => {
      if (state.type === NetworkStateType.CELLULAR && !allowCellular) {
        Alert.alert(
          'Wi‑Fi preferencial',
          'Ative dados celulares nas configurações para sincronizar via 4G/5G.'
        );
      }
    });
  }, [allowCellular]);

  const startRecording = useCallback(async () => {
    if (recording) return;
    setIsPreparing(true);
    try {
      if (!permissionResponse || permissionResponse.status !== 'granted') {
        const { status } = await requestPermission();
        if (status !== 'granted') {
          Alert.alert('Permissão negada', 'Autorize o microfone para gravar reuniões.');
          return;
        }
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 48000, numberOfChannels: 1, bitRate: 96000 },
        ios: { extension: '.m4a', audioQuality: Audio.IOSAudioQuality.HIGH, outputFormat: Audio.IOSOutputFormat.MPEG4AAC, sampleRate: 48000, numberOfChannels: 1, bitRate: 96000 },
      });
      await rec.startAsync();
      setRecording(rec);
      setDurationMillis(0);
    } catch {
      Alert.alert('Erro', 'Não foi possível iniciar a gravação.');
    } finally {
      setIsPreparing(false);
    }
  }, [permissionResponse, recording, requestPermission]);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    setIsPreparing(true);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      if (!uri) throw new Error('Gravação indisponível');
      const meetingId = await recordAndQueue(uri, liveNotes);
      try {
        await ensureAllowedConnection();
        await syncPendingOperations();
      } catch { /* queued for later */ }
      Alert.alert('Gravação salva', 'Sua reunião foi armazenada e será sincronizada assim que possível.');
      navigation.replace('MeetingDetail', { id: meetingId });
    } catch {
      Alert.alert('Erro na gravação', 'Não foi possível salvar a reunião.');
    } finally {
      setRecording(null);
      setIsPreparing(false);
      setDurationMillis(0);
    }
  }, [ensureAllowedConnection, liveNotes, navigation, recordAndQueue, recording, syncPendingOperations]);

  return (
    <View className="flex-1 bg-slate-950">
      {/* Notes FAB */}
      {recording && (
        <Pressable
          onPress={() => setShowNotesPad(true)}
          className="absolute right-5 top-5 z-10 flex-row items-center gap-1.5 rounded-full bg-slate-800 px-4 py-2"
        >
          <Text className="text-base">📝</Text>
          <Text className="text-sm text-slate-300">Anotações</Text>
        </Pressable>
      )}

      {/* Main content */}
      <View className="flex-1 items-center justify-center px-8">
        <WaveformView isRecording={!!recording} height={80} />

        <Text className="mt-8 font-mono text-5xl font-bold text-slate-100">
          {formatDuration(durationMillis)}
        </Text>

        <View className="mt-3 flex-row items-center gap-2">
          {recording && <View className="h-2 w-2 animate-pulse rounded-full bg-red-500" />}
          <Text className="text-sm text-slate-400">
            {recording ? 'Gravando…' : 'Pronto para gravar'}
          </Text>
        </View>
      </View>

      {/* Action button */}
      <View className="px-8 pb-12">
        <Pressable
          onPress={recording ? stopRecording : startRecording}
          disabled={isPreparing}
          className={`items-center rounded-2xl py-4 ${
            recording ? 'bg-red-600 active:bg-red-700' : 'bg-emerald-600 active:bg-emerald-700'
          } disabled:opacity-50`}
        >
          <Text className="text-base font-semibold text-white">
            {isPreparing ? '…' : recording ? '◼  Parar e salvar' : '●  Gravar agora'}
          </Text>
        </Pressable>
        <Text className="mt-4 text-center text-xs text-slate-600">
          Arquivo salvo localmente · sincronizado quando disponível
        </Text>
      </View>

      <InMeetingNotesPad
        visible={showNotesPad}
        initialValue={liveNotes}
        onSave={setLiveNotes}
        onClose={() => setShowNotesPad(false)}
      />
    </View>
  );
}
```

**Step 2: Commit**

```bash
git add apps/mobile/src/screens/RecordScreen.tsx
git commit -m "feat(mobile): redesign RecordScreen with WaveformView and InMeetingNotesPad"
```

---

### Task 8: New services — Notes, People, Folders

**Files:**
- Create: `apps/mobile/src/services/notesService.ts`
- Create: `apps/mobile/src/services/peopleService.ts`
- Create: `apps/mobile/src/services/folderService.ts`

**Step 1: Create notesService**

```typescript
// apps/mobile/src/services/notesService.ts
import { api } from './api';
import type { MeetingNotes, ActionItem, Decision } from '@decisiondesk/types';

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
```

**Step 2: Create peopleService**

```typescript
// apps/mobile/src/services/peopleService.ts
import { api } from './api';
import type { Person, MeetingPerson } from '@decisiondesk/types';

export const peopleService = {
  async listPeople(query?: string): Promise<Person[]> {
    const { data } = await api.get('/people', { params: query ? { q: query } : undefined });
    return data;
  },

  async getMeetingPeople(meetingId: string): Promise<MeetingPerson[]> {
    const { data } = await api.get(`/meetings/${meetingId}/people`);
    return data;
  },
};
```

**Step 3: Create folderService**

```typescript
// apps/mobile/src/services/folderService.ts
import { api } from './api';
import type { Folder } from '@decisiondesk/types';

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
```

**Step 4: Commit**

```bash
git add apps/mobile/src/services/notesService.ts apps/mobile/src/services/peopleService.ts apps/mobile/src/services/folderService.ts
git commit -m "feat(mobile): add notesService, peopleService, folderService"
```

---

### Task 9: Redesign MeetingDetailScreen (3-tab)

**Files:**
- Modify: `apps/mobile/src/screens/MeetingDetailScreen.tsx`

**Step 1: Replace with 3-tab redesign**

```typescript
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';

import { AINotesView } from '../components/AINotesView';
import { SearchBar } from '../components/SearchBar';
import { StatusBadge } from '../components/StatusBadge';
import { SummaryView } from '../components/SummaryView';
import { TabBar } from '../components/TabBar';
import { TranscriptView } from '../components/TranscriptView';
import { PrimaryButton } from '../components/PrimaryButton';
import { TranscribeModal, type TranscribeModalOptions } from '../components/TranscribeModal';
import { useNetworkGuard } from '../hooks/useNetworkGuard';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useMeetings } from '../state/MeetingContext';
import { useSettings } from '../state/SettingsContext';
import { notesService } from '../services/notesService';
import { parseSpeakerLine } from '@decisiondesk/utils';
import type { TranscriptLine, ActionItem, Decision, MeetingNotes } from '@decisiondesk/types';

type DetailTab = 'transcript' | 'notes' | 'summary';

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'transcript', label: 'Transcrição' },
  { key: 'notes', label: 'Notas' },
  { key: 'summary', label: 'Resumo' },
];

export type MeetingDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'MeetingDetail'>;

export function MeetingDetailScreen({ route, navigation }: MeetingDetailScreenProps) {
  const { meetings, refreshMeeting, transcribeMeeting } = useMeetings();
  const { transcription } = useSettings();
  const { ensureAllowedConnection } = useNetworkGuard();

  const [activeTab, setActiveTab] = useState<DetailTab>('transcript');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [showTranscribeModal, setShowTranscribeModal] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [notes, setNotes] = useState<MeetingNotes>({});
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const meeting = useMemo(
    () => meetings.find((m) => m.id === route.params.id),
    [meetings, route.params.id]
  );

  useFocusEffect(
    useCallback(() => {
      if (meeting?.remoteId) refreshMeeting(meeting.id);
    }, [meeting?.remoteId, meeting?.id, refreshMeeting])
  );

  useEffect(() => {
    if (!meeting?.remoteId) return;
    notesService.getNotes(meeting.remoteId).then(setNotes).catch(() => {});
    notesService.getActionItems(meeting.remoteId).then(setActionItems).catch(() => {});
    notesService.getDecisions(meeting.remoteId).then(setDecisions).catch(() => {});
  }, [meeting?.remoteId]);

  const transcriptLines: TranscriptLine[] = useMemo(() => {
    if (!meeting?.transcriptText) return [];
    return meeting.transcriptText
      .split('\n')
      .filter(Boolean)
      .map((line) => parseSpeakerLine(line) ?? { text: line });
  }, [meeting?.transcriptText]);

  const handleTranscribe = useCallback(async (options: TranscribeModalOptions) => {
    if (!meeting) return;
    setShowTranscribeModal(false);
    try {
      await ensureAllowedConnection();
      setTranscribing(true);
      await transcribeMeeting(meeting.id, options);
      Alert.alert('Pedido enviado', 'A transcrição foi iniciada.');
    } catch {
      Alert.alert('Erro', 'Não foi possível solicitar a transcrição.');
    } finally {
      setTranscribing(false);
    }
  }, [ensureAllowedConnection, meeting, transcribeMeeting]);

  const handleSaveNotes = useCallback(async (content: string) => {
    if (!meeting?.remoteId) return;
    setNotes((n) => ({ ...n, liveNotesMd: content }));
    await notesService.saveLiveNotes(meeting.remoteId, content).catch(() => {});
  }, [meeting?.remoteId]);

  if (!meeting) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <Text className="text-slate-400">Reunião não encontrada.</Text>
      </View>
    );
  }

  const hasTranscript = Boolean(meeting.transcriptText);

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header info */}
      <View className="border-b border-slate-800 px-4 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-base font-semibold text-slate-100" numberOfLines={1}>
            {meeting.title || 'Reunião'}
          </Text>
          <StatusBadge status={meeting.status} />
        </View>
        {!hasTranscript && (
          <PrimaryButton
            title={transcribing ? 'Aguarde…' : 'Transcrever agora'}
            onPress={() => setShowTranscribeModal(true)}
            disabled={transcribing || !meeting.remoteId}
          />
        )}
      </View>

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'transcript' && (
        <View className="flex-1">
          <View className="px-4 py-2">
            <SearchBar
              value={transcriptSearch}
              onChangeText={setTranscriptSearch}
              placeholder="Buscar na transcrição…"
            />
          </View>
          <TranscriptView lines={transcriptLines} searchQuery={transcriptSearch} />
        </View>
      )}

      {activeTab === 'notes' && (
        <AINotesView
          liveNotes={notes.liveNotesMd ?? ''}
          actionItems={actionItems}
          decisions={decisions}
          onNotesChange={handleSaveNotes}
          onGenerateAI={() => Alert.alert('Em breve', 'Geração de notas com IA será adicionada.')}
        />
      )}

      {activeTab === 'summary' && (
        <SummaryView
          summaryMd={meeting.transcriptText ? undefined : undefined}
          onGenerate={() => Alert.alert('Em breve', 'Geração de resumo será adicionada.')}
          isGenerating={generatingSummary}
        />
      )}

      <TranscribeModal
        visible={showTranscribeModal}
        defaultProvider={transcription.defaultProvider}
        defaultModel={transcription.defaultModel}
        defaultDiarization={transcription.enableDiarization}
        onConfirm={handleTranscribe}
        onCancel={() => setShowTranscribeModal(false)}
      />
    </View>
  );
}
```

**Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
# Expected: no errors
```

**Step 3: Commit**

```bash
git add apps/mobile/src/screens/MeetingDetailScreen.tsx
git commit -m "feat(mobile): redesign MeetingDetailScreen with 3-tab Transcript/Notes/Summary"
```

---

### Task 10: Add SearchScreen, FolderScreen, PeopleScreen + update navigator

**Files:**
- Create: `apps/mobile/src/screens/SearchScreen.tsx`
- Create: `apps/mobile/src/screens/FolderScreen.tsx`
- Create: `apps/mobile/src/screens/PeopleScreen.tsx`
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`

**Step 1: Create SearchScreen**

```typescript
// apps/mobile/src/screens/SearchScreen.tsx
import { useState, useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { useMeetings } from '../state/MeetingContext';
import { highlightMatches } from '@decisiondesk/utils';
import type { RootStackParamList } from '../navigation/AppNavigator';

export type SearchScreenProps = NativeStackScreenProps<RootStackParamList, 'Search'>;

export function SearchScreen({ navigation }: SearchScreenProps) {
  const { meetings } = useMeetings();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return meetings
      .filter((m) => m.title?.toLowerCase().includes(q) || m.transcriptText?.toLowerCase().includes(q))
      .map((m) => {
        const snippet = m.transcriptText
          ? m.transcriptText.toLowerCase().indexOf(q) !== -1
            ? m.transcriptText.substring(Math.max(0, m.transcriptText.toLowerCase().indexOf(q) - 40), m.transcriptText.toLowerCase().indexOf(q) + 80)
            : undefined
          : undefined;
        return { meeting: m, snippet };
      });
  }, [meetings, query]);

  return (
    <View className="flex-1 bg-slate-950 px-4 pt-3">
      <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar em todas as reuniões…" />

      {query && results.length === 0 && (
        <EmptyState icon="🔍" title="Sem resultados" subtitle={`Nenhuma reunião encontrada para "${query}"`} />
      )}

      <FlatList
        data={results}
        className="mt-4"
        keyExtractor={(item) => item.meeting.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('MeetingDetail', { id: item.meeting.id })}
            className="mb-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
          >
            <Text className="text-sm font-semibold text-slate-100">{item.meeting.title || 'Reunião'}</Text>
            {item.snippet && (
              <Text className="mt-1 text-xs text-slate-500" numberOfLines={2}>…{item.snippet}…</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}
```

**Step 2: Create FolderScreen**

```typescript
// apps/mobile/src/screens/FolderScreen.tsx
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { folderService } from '../services/folderService';
import type { Folder } from '@decisiondesk/types';
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
```

**Step 3: Create PeopleScreen**

```typescript
// apps/mobile/src/screens/PeopleScreen.tsx
import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { peopleService } from '../services/peopleService';
import type { Person } from '@decisiondesk/types';
import type { RootStackParamList } from '../navigation/AppNavigator';

export type PeopleScreenProps = NativeStackScreenProps<RootStackParamList, 'People'>;

export function PeopleScreen({}: PeopleScreenProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    peopleService.listPeople(search || undefined).then(setPeople).catch(() => {});
  }, [search]);

  return (
    <View className="flex-1 bg-slate-950 px-4 pt-4">
      <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar pessoas…" />
      {people.length === 0 && (
        <EmptyState icon="👥" title="Nenhuma pessoa" subtitle="Adicione participantes às reuniões." />
      )}
      <FlatList
        data={people}
        className="mt-4"
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View className="mb-2 flex-row items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-800">
              <Text className="font-semibold text-emerald-200">{item.displayName[0].toUpperCase()}</Text>
            </View>
            <View>
              <Text className="text-sm font-medium text-slate-100">{item.displayName}</Text>
              {item.email && <Text className="text-xs text-slate-400">{item.email}</Text>}
            </View>
          </View>
        )}
      />
    </View>
  );
}
```

**Step 4: Update AppNavigator**

Replace `apps/mobile/src/navigation/AppNavigator.tsx`:

```typescript
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { FolderScreen } from '../screens/FolderScreen';
import { MeetingDetailScreen } from '../screens/MeetingDetailScreen';
import { MeetingListScreen } from '../screens/MeetingListScreen';
import { PeopleScreen } from '../screens/PeopleScreen';
import { RecordScreen } from '../screens/RecordScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type RootStackParamList = {
  Home: undefined;
  Record: undefined;
  MeetingDetail: { id: string };
  Settings: undefined;
  Search: undefined;
  Folders: undefined;
  People: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerTintColor: '#e2e8f0',
  headerStyle: { backgroundColor: '#020617' },
  headerTitleStyle: { fontWeight: '600' as const },
  contentStyle: { backgroundColor: '#020617' },
};

export function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={screenOptions}>
      <Stack.Screen name="Home" component={MeetingListScreen} options={{ title: 'Reuniões' }} />
      <Stack.Screen name="Record" component={RecordScreen} options={{ title: 'Nova gravação' }} />
      <Stack.Screen name="MeetingDetail" component={MeetingDetailScreen} options={{ title: 'Detalhes' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configurações' }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Buscar', presentation: 'modal' }} />
      <Stack.Screen name="Folders" component={FolderScreen} options={{ title: 'Pastas' }} />
      <Stack.Screen name="People" component={PeopleScreen} options={{ title: 'Pessoas' }} />
    </Stack.Navigator>
  );
}
```

**Step 5: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/src/screens/SearchScreen.tsx apps/mobile/src/screens/FolderScreen.tsx apps/mobile/src/screens/PeopleScreen.tsx apps/mobile/src/navigation/AppNavigator.tsx
git commit -m "feat(mobile): add SearchScreen, FolderScreen, PeopleScreen + update navigator"
```

---

## Phase 5 — Desktop Expansion

### Task 11: Desktop — new IPC handlers + MeetingsScreen

**Files:**
- Modify: `apps/desktop/src/main/index.ts` (add 4 IPC handlers)
- Create: `apps/desktop/src/renderer/screens/MeetingsScreen.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`

**Step 1: Add IPC handlers to main/index.ts**

Find the section with other `ipcMain.handle(...)` calls and add:

```typescript
// In apps/desktop/src/main/index.ts — add alongside existing handlers
import { db } from './database';

ipcMain.handle('meetings:list', async () => {
  return db.prepare(`
    SELECT id, title, status, created_at as createdAt, duration_sec as durationSec,
           cost_brl as costBrl, cost_usd as costUsd, folder_id as folderId
    FROM meetings ORDER BY created_at DESC
  `).all();
});

ipcMain.handle('meetings:get', async (_, id: string) => {
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
  const transcript = db.prepare('SELECT text as transcriptText FROM transcripts WHERE meeting_id = ?').get(id);
  const notes = db.prepare('SELECT agenda_md as agendaMd, live_notes_md as liveNotesMd, post_notes_md as postNotesMd FROM meeting_notes WHERE meeting_id = ?').get(id);
  return { ...meeting, ...(transcript ?? {}), notes: notes ?? {} };
});

ipcMain.handle('notes:get', async (_, meetingId: string) => {
  return db.prepare('SELECT agenda_md as agendaMd, live_notes_md as liveNotesMd, post_notes_md as postNotesMd FROM meeting_notes WHERE meeting_id = ?').get(meetingId) ?? {};
});

ipcMain.handle('notes:save', async (_, meetingId: string, phase: string, content: string) => {
  const col = phase === 'agenda' ? 'agenda_md' : phase === 'live' ? 'live_notes_md' : 'post_notes_md';
  const existing = db.prepare('SELECT id FROM meeting_notes WHERE meeting_id = ?').get(meetingId);
  if (existing) {
    db.prepare(`UPDATE meeting_notes SET ${col} = ?, updated_at = CURRENT_TIMESTAMP WHERE meeting_id = ?`).run(content, meetingId);
  } else {
    db.prepare(`INSERT INTO meeting_notes (meeting_id, ${col}) VALUES (?, ?)`).run(meetingId, content);
  }
});
```

**Step 2: Create MeetingsScreen**

Create `apps/desktop/src/renderer/screens/MeetingsScreen.tsx`:

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Meeting } from '@decisiondesk/types';
import { formatRelativeDate, formatDurationSec } from '@decisiondesk/utils';

interface MeetingsScreenProps {
  onSelectMeeting: (id: string) => void;
  selectedId?: string;
}

export function MeetingsScreen({ onSelectMeeting, selectedId }: MeetingsScreenProps) {
  const [search, setSearch] = useState('');

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ['meetings'],
    queryFn: () => window.electronAPI.meetings.list(),
    refetchInterval: 30000,
  });

  const filtered = meetings.filter((m) =>
    !search || m.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col">
      <div className="p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar reuniões…"
          className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2">
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelectMeeting(m.id)}
            className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition-colors ${
              selectedId === m.id ? 'bg-emerald-950/60 ring-1 ring-emerald-800' : 'hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium text-slate-100">
                {m.title || formatRelativeDate(m.createdAt)}
              </span>
              <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                m.status === 'DONE' ? 'bg-emerald-950 text-emerald-400' :
                m.status === 'PROCESSING' ? 'bg-amber-950 text-amber-400' :
                'bg-slate-800 text-slate-500'
              }`}>
                {m.status === 'DONE' ? '✓' : m.status === 'PROCESSING' ? '⏳' : '—'}
              </span>
            </div>
            {m.durationSec && (
              <span className="mt-0.5 block text-xs text-slate-500">
                {formatDurationSec(m.durationSec)}
              </span>
            )}
          </button>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">Nenhuma reunião</p>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Update App.tsx with new layout**

Replace `apps/desktop/src/renderer/App.tsx` to add meetings nav and panel state:

Key changes:
- Add `selectedMeetingId` state
- Add "📋 Reuniões" NavLink in sidebar
- Main route `/` now renders `<MeetingsScreen>` + `<MeetingDetailScreen>` side-by-side
- Import and use new screens

```typescript
// Add to imports
import { MeetingsScreen } from './screens/MeetingsScreen';
import { MeetingDetailScreen } from './screens/MeetingDetailScreen';
import { PeopleScreen } from './screens/PeopleScreen';

// Add route for /meetings, /people inside <Routes>
// Sidebar gets new NavLink items
```

(Full replacement is in Task 12 below alongside MeetingDetailScreen.)

**Step 4: Commit**

```bash
git add apps/desktop/src/main/index.ts apps/desktop/src/renderer/screens/MeetingsScreen.tsx
git commit -m "feat(desktop): add meetings IPC handlers and MeetingsScreen"
```

---

### Task 12: Desktop — MeetingDetailScreen + update App.tsx

**Files:**
- Create: `apps/desktop/src/renderer/screens/MeetingDetailScreen.tsx`
- Create: `apps/desktop/src/renderer/screens/PeopleScreen.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`

**Step 1: Create MeetingDetailScreen (desktop)**

```typescript
// apps/desktop/src/renderer/screens/MeetingDetailScreen.tsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parseSpeakerLine } from '@decisiondesk/utils';
import type { TranscriptLine } from '@decisiondesk/types';

interface MeetingDetailScreenProps {
  meetingId: string;
}

type DesktopTab = 'transcript' | 'notes' | 'summary';

export function MeetingDetailScreen({ meetingId }: MeetingDetailScreenProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DesktopTab>('transcript');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [liveNotes, setLiveNotes] = useState('');
  const [transcribing, setTranscribing] = useState(false);

  const { data: meeting } = useQuery({
    queryKey: ['meeting', meetingId],
    queryFn: () => window.electronAPI.meetings.get(meetingId),
    enabled: !!meetingId,
  });

  const { data: notes } = useQuery({
    queryKey: ['notes', meetingId],
    queryFn: () => window.electronAPI.notes.get(meetingId),
    enabled: !!meetingId,
  });

  useEffect(() => {
    if (notes?.liveNotesMd) setLiveNotes(notes.liveNotesMd);
  }, [notes?.liveNotesMd]);

  const saveNotesMutation = useMutation({
    mutationFn: (content: string) =>
      window.electronAPI.notes.save(meetingId, 'live', content),
  });

  const transcriptLines: TranscriptLine[] = meeting?.transcriptText
    ? meeting.transcriptText.split('\n').filter(Boolean).map((l: string) => parseSpeakerLine(l) ?? { text: l })
    : [];

  const filteredLines = transcriptSearch
    ? transcriptLines.filter((l) => l.text.toLowerCase().includes(transcriptSearch.toLowerCase()))
    : transcriptLines;

  const handleTranscribeLocally = async () => {
    if (!meetingId) return;
    setTranscribing(true);
    try {
      await window.electronAPI.queue.acceptJob(meetingId);
      await window.electronAPI.queue.processJob(meetingId);
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
    } catch (e) {
      console.error(e);
    } finally {
      setTranscribing(false);
    }
  };

  if (!meeting) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Selecione uma reunião
      </div>
    );
  }

  const hasTranscript = Boolean(meeting.transcriptText);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{meeting.title || 'Reunião'}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{meeting.createdAt?.slice(0, 10)}</p>
        </div>
        {!hasTranscript && (
          <button
            onClick={handleTranscribeLocally}
            disabled={transcribing}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {transcribing ? (
              <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Processando…</>
            ) : '▶ Transcrever localmente'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {(['transcript', 'notes', 'summary'] as DesktopTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              tab === t ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'transcript' ? 'Transcrição' : t === 'notes' ? 'Notas' : 'Resumo'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {tab === 'transcript' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-slate-800 px-4 py-2">
              <input
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Buscar na transcrição…"
                className="w-full rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {filteredLines.length === 0 && (
                <p className="text-center text-sm text-slate-500 pt-8">Sem transcrição</p>
              )}
              {filteredLines.map((line, i) => (
                <div key={i}>
                  {line.speaker && <span className="text-xs font-semibold text-emerald-400">{line.speaker}</span>}
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-300">{line.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div className="flex flex-1 flex-col p-6">
            <textarea
              value={liveNotes}
              onChange={(e) => setLiveNotes(e.target.value)}
              onBlur={() => saveNotesMutation.mutate(liveNotes)}
              placeholder="Adicione anotações da reunião…"
              className="flex-1 resize-none rounded-xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-300 placeholder-slate-600 outline-none focus:ring-1 focus:ring-emerald-800"
            />
          </div>
        )}

        {tab === 'summary' && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-500">Resumo disponível em breve</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create PeopleScreen (desktop)**

```typescript
// apps/desktop/src/renderer/screens/PeopleScreen.tsx
import { useState, useEffect } from 'react';

interface Person { id: string; displayName: string; email?: string; }

export function PeopleScreen() {
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    // Fetch from backend via API (desktop has connectivity)
    fetch('http://localhost:8087/api/v1/people')
      .then((r) => r.json())
      .then(setPeople)
      .catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <h2 className="mb-4 text-2xl font-bold text-slate-100">Pessoas</h2>
      <div className="grid grid-cols-2 gap-3">
        {people.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-800 text-sm font-semibold text-emerald-200">
              {p.displayName[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">{p.displayName}</p>
              {p.email && <p className="text-xs text-slate-500">{p.email}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Update App.tsx**

Replace `apps/desktop/src/renderer/App.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MeetingsScreen } from './screens/MeetingsScreen';
import { MeetingDetailScreen } from './screens/MeetingDetailScreen';
import { QueueScreen } from './screens/QueueScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { PeopleScreen } from './screens/PeopleScreen';
import type { ElectronAPI } from '../preload';

declare global { interface Window { electronAPI: ElectronAPI; } }

function Sidebar() {
  const { data: whisperStatus } = useQuery({
    queryKey: ['whisper-status'],
    queryFn: () => window.electronAPI.whisper.getStatus(),
  });
  const { data: syncCount } = useQuery({
    queryKey: ['sync-count'],
    queryFn: () => window.electronAPI.db.syncQueueCount(),
    refetchInterval: 5000,
  });
  const [connectivity, setConnectivity] = useState({ online: true, backendReachable: false });

  useEffect(() => {
    window.electronAPI.connectivity.getStatus().then(setConnectivity);
    window.electronAPI.connectivity.onStatusChange(setConnectivity);
  }, []);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive ? 'bg-emerald-950/50 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`;

  return (
    <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-900">
      <div className="drag-region flex h-14 items-center border-b border-slate-800 px-5">
        <h1 className="text-lg font-semibold text-slate-100">DecisionDesk</h1>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        <NavLink to="/" end className={navClass}>📋 Reuniões</NavLink>
        <NavLink to="/queue" className={navClass}>🖥 Fila</NavLink>
        <NavLink to="/people" className={navClass}>👥 Pessoas</NavLink>
        <NavLink to="/settings" className={navClass}>⚙️ Configurações</NavLink>
      </nav>
      <div className="space-y-2 border-t border-slate-800 p-4">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${connectivity.backendReachable ? 'bg-emerald-500' : connectivity.online ? 'bg-amber-500' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-400">
            {connectivity.backendReachable ? 'Backend conectado' : connectivity.online ? 'Offline do backend' : 'Sem conexão'}
          </span>
          {(syncCount ?? 0) > 0 && (
            <span className="ml-auto rounded-full bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              {syncCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${whisperStatus?.available ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-400">
            {whisperStatus?.available ? 'Whisper disponível' : 'Whisper não encontrado'}
          </span>
        </div>
      </div>
    </aside>
  );
}

function MeetingsLayout() {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | undefined>();
  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-slate-800 overflow-hidden">
        <MeetingsScreen onSelectMeeting={setSelectedMeetingId} selectedId={selectedMeetingId} />
      </div>
      <div className="flex-1 overflow-hidden">
        {selectedMeetingId
          ? <MeetingDetailScreen meetingId={selectedMeetingId} />
          : <div className="flex h-full items-center justify-center text-slate-500 text-sm">Selecione uma reunião</div>
        }
      </div>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <div className="flex h-screen bg-slate-950">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<MeetingsLayout />} />
            <Route path="/queue" element={<QueueScreen />} />
            <Route path="/people" element={<PeopleScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
```

**Step 4: Typecheck + commit**

```bash
cd apps/desktop && npm run typecheck
git add apps/desktop/src/renderer/screens/MeetingDetailScreen.tsx apps/desktop/src/renderer/screens/PeopleScreen.tsx apps/desktop/src/renderer/App.tsx
git commit -m "feat(desktop): add MeetingDetailScreen, PeopleScreen, update App layout"
```

---

## Phase 6 — Web App (PR10)

### Task 13: Scaffold apps/web/

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`

**Step 1: Scaffold via Vite**

```bash
cd apps/web && npm create vite@latest . -- --template react-ts
npm install
npm install react-router-dom @tanstack/react-query axios lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

**Step 2: Configure Tailwind in vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
```

**Step 3: Create src/main.tsx**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
```

**Step 4: Create src/index.css**

```css
@import "tailwindcss";

:root { color-scheme: dark; }
body { background: #020617; color: #f1f5f9; font-family: system-ui, sans-serif; }
```

**Step 5: Create src/services/api.ts**

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8087/api/v1',
  headers: { 'Content-Type': 'application/json' },
});
```

**Step 6: Verify it runs**

```bash
cd apps/web && npm run dev
# Expected: Vite dev server starts on http://localhost:5173
```

**Step 7: Commit**

```bash
git add apps/web/
git commit -m "feat(web): scaffold React/Vite web app with Tailwind and TanStack Query"
```

---

### Task 14: Web — Sidebar + MeetingsPage

**Files:**
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/hooks/useMeetings.ts`
- Create: `apps/web/src/components/Sidebar.tsx`
- Create: `apps/web/src/pages/MeetingsPage.tsx`

**Step 1: Create useMeetings hook**

```typescript
// apps/web/src/hooks/useMeetings.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Meeting } from '@decisiondesk/types';

export function useMeetings() {
  return useQuery<Meeting[]>({
    queryKey: ['meetings'],
    queryFn: async () => {
      const { data } = await api.get('/meetings');
      return data.content ?? data; // handle paginated or array response
    },
  });
}
```

**Step 2: Create Sidebar**

```typescript
// apps/web/src/components/Sidebar.tsx
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useMeetings } from '../hooks/useMeetings';
import { formatRelativeDate } from '@decisiondesk/utils';
import { Upload } from 'lucide-react';
import { useRef } from 'react';
import { api } from '../services/api';

export function Sidebar() {
  const { data: meetings = [] } = useMeetings();
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Create meeting shell
    const { data: meeting } = await api.post('/meetings', { title: file.name.replace(/\.[^.]+$/, '') });
    // Upload audio
    const form = new FormData();
    form.append('file', file);
    await api.post(`/meetings/${meeting.id}/audio`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    navigate(`/meetings/${meeting.id}`);
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-emerald-950/60 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
      <div className="flex h-14 items-center border-b border-slate-800 px-5">
        <span className="text-lg font-semibold text-slate-100">DecisionDesk</span>
      </div>

      {/* Upload */}
      <div className="p-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          <Upload size={16} />
          Upload áudio
        </button>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
      </div>

      {/* Nav */}
      <nav className="space-y-1 px-2">
        <NavLink to="/people" className={navClass}>👥 Pessoas</NavLink>
        <NavLink to="/settings" className={navClass}>⚙️ Configurações</NavLink>
      </nav>

      <div className="mt-4 border-t border-slate-800 px-2 pt-2">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Reuniões</p>
        <div className="space-y-0.5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {meetings.map((m) => (
            <NavLink key={m.id} to={`/meetings/${m.id}`} className={navClass}>
              <span className="truncate">{m.title || formatRelativeDate(m.createdAt)}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </aside>
  );
}
```

**Step 3: Create MeetingsPage**

```typescript
// apps/web/src/pages/MeetingsPage.tsx
import { useMeetings } from '../hooks/useMeetings';
import { formatRelativeDate, formatDurationSec } from '@decisiondesk/utils';
import { Link } from 'react-router-dom';

export function MeetingsPage() {
  const { data: meetings = [], isLoading } = useMeetings();

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" /></div>;
  }

  if (meetings.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
        <span className="text-5xl">🎙</span>
        <p className="text-base font-medium text-slate-300">Nenhuma reunião ainda</p>
        <p className="text-sm">Use o botão de upload na barra lateral para começar.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-100">Reuniões</h1>
      <div className="space-y-3">
        {meetings.map((m) => (
          <Link
            key={m.id}
            to={`/meetings/${m.id}`}
            className="block rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 transition-colors hover:border-slate-700"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-100">{m.title || formatRelativeDate(m.createdAt)}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                m.status === 'DONE' ? 'bg-emerald-950 text-emerald-400' :
                m.status === 'PROCESSING' ? 'bg-amber-950 text-amber-400' :
                'bg-slate-800 text-slate-500'
              }`}>
                {m.status}
              </span>
            </div>
            {m.durationSec && (
              <p className="mt-1 text-sm text-slate-500">{formatDurationSec(m.durationSec)}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Create App.tsx**

```typescript
// apps/web/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { MeetingsPage } from './pages/MeetingsPage';
import { MeetingDetailPage } from './pages/MeetingDetailPage';
import { PeoplePage } from './pages/PeoplePage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<MeetingsPage />} />
            <Route path="/meetings/:id" element={<MeetingDetailPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

**Step 5: Verify**

```bash
cd apps/web && npm run dev
# http://localhost:5173 — sidebar + meeting list visible
```

**Step 6: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add Sidebar, MeetingsPage, App routing"
```

---

### Task 15: Web — MeetingDetailPage (3-tab) + remaining pages

**Files:**
- Create: `apps/web/src/pages/MeetingDetailPage.tsx`
- Create: `apps/web/src/pages/PeoplePage.tsx`
- Create: `apps/web/src/pages/SettingsPage.tsx`
- Create: `apps/web/src/hooks/useMeetingDetail.ts`

**Step 1: Create useMeetingDetail**

```typescript
// apps/web/src/hooks/useMeetingDetail.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Meeting, MeetingNotes } from '@decisiondesk/types';

export function useMeetingDetail(id: string) {
  const queryClient = useQueryClient();

  const meeting = useQuery<Meeting>({
    queryKey: ['meeting', id],
    queryFn: async () => { const { data } = await api.get(`/meetings/${id}`); return data; },
    enabled: !!id,
    refetchInterval: (query) => query.state.data?.status === 'PROCESSING' ? 5000 : false,
  });

  const notes = useQuery<MeetingNotes>({
    queryKey: ['notes', id],
    queryFn: async () => { const { data } = await api.get(`/meetings/${id}/notes`); return data; },
    enabled: !!id,
  });

  const saveNotes = useMutation({
    mutationFn: async ({ phase, content }: { phase: string; content: string }) => {
      await api.patch(`/meetings/${id}/notes/${phase}`, { content });
    },
  });

  const transcribe = useMutation({
    mutationFn: async () => { await api.post(`/meetings/${id}/transcribe`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meeting', id] }),
  });

  return { meeting, notes, saveNotes, transcribe };
}
```

**Step 2: Create MeetingDetailPage**

```typescript
// apps/web/src/pages/MeetingDetailPage.tsx
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useMeetingDetail } from '../hooks/useMeetingDetail';
import { parseSpeakerLine, highlightMatches } from '@decisiondesk/utils';
import type { TranscriptLine } from '@decisiondesk/types';

type WebTab = 'transcript' | 'notes' | 'summary';

export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { meeting, notes, saveNotes, transcribe } = useMeetingDetail(id!);
  const [tab, setTab] = useState<WebTab>('transcript');
  const [search, setSearch] = useState('');
  const [liveNotes, setLiveNotes] = useState('');

  const m = meeting.data;
  const n = notes.data;

  const lines: TranscriptLine[] = m?.transcriptText
    ? m.transcriptText.split('\n').filter(Boolean).map((l) => parseSpeakerLine(l) ?? { text: l })
    : [];

  if (!m) return <div className="flex h-full items-center justify-center text-slate-500">Carregando…</div>;

  const tabClass = (t: WebTab) =>
    `px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
      tab === t ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'
    }`;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{m.title || 'Reunião'}</h1>
          <p className="mt-1 text-sm text-slate-500">{m.createdAt?.slice(0, 10)}</p>
        </div>
        {!m.transcriptText && (
          <button
            onClick={() => transcribe.mutate()}
            disabled={transcribe.isPending}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {transcribe.isPending ? 'Aguardando…' : 'Transcrever agora'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 px-4">
        <button className={tabClass('transcript')} onClick={() => setTab('transcript')}>Transcrição</button>
        <button className={tabClass('notes')} onClick={() => setTab('notes')}>Notas</button>
        <button className={tabClass('summary')} onClick={() => setTab('summary')}>Resumo</button>
      </div>

      {/* Content */}
      {tab === 'transcript' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-slate-800 px-6 py-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar na transcrição…"
              className="w-full max-w-md rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
            {lines.length === 0 && (
              <p className="text-center text-slate-500">Sem transcrição ainda.</p>
            )}
            {lines.map((line, i) => {
              const segments = search ? highlightMatches(line.text, search) : [{ text: line.text, highlighted: false }];
              return (
                <div key={i}>
                  {line.speaker && <span className="text-xs font-semibold text-emerald-400">{line.speaker}</span>}
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-300">
                    {segments.map((s, j) =>
                      s.highlighted
                        ? <mark key={j} className="rounded bg-emerald-950 text-emerald-300 px-0.5">{s.text}</mark>
                        : <span key={j}>{s.text}</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="flex flex-1 flex-col p-8">
          <textarea
            value={liveNotes || n?.liveNotesMd || ''}
            onChange={(e) => setLiveNotes(e.target.value)}
            onBlur={() => saveNotes.mutate({ phase: 'live', content: liveNotes })}
            placeholder="Anotações da reunião…"
            className="flex-1 resize-none rounded-xl bg-slate-900 p-5 text-sm leading-relaxed text-slate-300 placeholder-slate-600 outline-none focus:ring-1 focus:ring-emerald-800"
          />
        </div>
      )}

      {tab === 'summary' && (
        <div className="flex flex-1 items-center justify-center text-slate-500">
          Geração de resumo em breve
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create PeoplePage and SettingsPage**

```typescript
// apps/web/src/pages/PeoplePage.tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Person } from '@decisiondesk/types';

export function PeoplePage() {
  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ['people'],
    queryFn: async () => { const { data } = await api.get('/people'); return data; },
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-100">Pessoas</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {people.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-sm font-semibold text-emerald-200">
              {p.displayName[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">{p.displayName}</p>
              {p.email && <p className="truncate text-xs text-slate-500">{p.email}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// apps/web/src/pages/SettingsPage.tsx
export function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-100">Configurações</h1>
      <p className="text-sm text-slate-500">Em breve: idioma, provedor de transcrição, templates de resumo.</p>
    </div>
  );
}
```

**Step 4: Verify typecheck**

```bash
cd apps/web && npx tsc --noEmit
# Expected: no errors
```

**Step 5: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add MeetingDetailPage (3-tab), PeoplePage, SettingsPage"
```

---

## Final Verification

### Mobile

```bash
cd apps/mobile
npx tsc --noEmit          # no type errors
npm test                   # all tests pass
npx expo start --ios      # simulator: Home → Record (waveform shows) → stop → MeetingDetail (3 tabs)
# Tap 📝 during recording → notes pad opens
# Tap Transcrição tab → search bar → type keyword → transcript highlights
# Tap Notas tab → notes editor visible + action items parsed
```

### Desktop

```bash
cd apps/desktop
npm run typecheck          # no errors
npm run dev               # Electron opens
# Sidebar: Reuniões / Fila / Pessoas / Configurações all visible
# Reuniões → click meeting → detail loads with 3 tabs
# Click "Transcrever localmente" → spinner → transcript appears
# Fila → retry button on failed jobs
```

### Web

```bash
cd apps/web
npx tsc --noEmit          # no errors
npm run dev               # http://localhost:5173
# Sidebar shows meeting list
# Click meeting → MeetingDetailPage: 3 tabs, transcript search, notes editor
# Upload audio → drag file onto upload button → meeting created → navigate to detail
# /people → person grid
```

### Backend

```bash
make backend-test          # all existing tests still pass — no backend changes made
```

---

## Commit log summary (by the end)

```
feat(types): expand shared type library with full domain interfaces
feat(utils): add formatDuration, groupByDate, highlightMatches, parseSpeakerLine
feat(mobile): add WaveformView and InMeetingNotesPad components
feat(mobile): add TabBar, TranscriptView, SearchBar, EmptyState components
feat(mobile): add AINotesView, SummaryView, MeetingCard, ActionItemRow components
feat(mobile): add notesService, peopleService, folderService
feat(mobile): redesign MeetingListScreen with search, SectionList grouping, FAB
feat(mobile): redesign RecordScreen with WaveformView and InMeetingNotesPad
feat(mobile): redesign MeetingDetailScreen with 3-tab Transcript/Notes/Summary
feat(mobile): add SearchScreen, FolderScreen, PeopleScreen + update navigator
feat(desktop): add meetings IPC handlers and MeetingsScreen
feat(desktop): add MeetingDetailScreen, PeopleScreen, update App layout
feat(web): scaffold React/Vite web app with Tailwind and TanStack Query
feat(web): add Sidebar, MeetingsPage, App routing
feat(web): add MeetingDetailPage (3-tab), PeoplePage, SettingsPage
```
