import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function TagEditor({ meetingId, tags }: { meetingId: string; tags: Record<string, string> }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allTags = [] } = useQuery({
    queryKey: ['all-tags'],
    queryFn: () => window.electronAPI.db.listAllTags(),
  });

  const mutation = useMutation({
    mutationFn: (newTags: Record<string, string>) =>
      window.electronAPI.db.upsertMeeting({ id: meetingId, tags: newTags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  const tagEntries = Object.entries(tags);

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || tags[trimmed]) return;
    mutation.mutate({ ...tags, [trimmed]: trimmed });
    setInput('');
    setShowDropdown(false);
  };

  const removeTag = (key: string) => {
    const next = { ...tags };
    delete next[key];
    mutation.mutate(next);
  };

  const filtered = allTags.filter(
    (t) => t.toLowerCase().includes(input.toLowerCase()) && !tags[t]
  );

  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.parentElement?.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tagEntries.map(([key, val]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-400"
        >
          {val}
          <button
            onClick={() => removeTag(key)}
            className="text-violet-400/60 hover:text-violet-300 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}

      <div className="relative">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(input); }
          }}
          placeholder="+ tag"
          className="w-20 rounded border border-dd-border bg-dd-elevated px-2 py-0.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:w-28 transition-all"
        />
        {showDropdown && input && filtered.length > 0 && (
          <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-dd-border bg-dd-elevated shadow-lg max-h-28 overflow-auto">
            {filtered.slice(0, 6).map((t) => (
              <button
                key={t}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(t)}
                className="block w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-dd-surface"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
