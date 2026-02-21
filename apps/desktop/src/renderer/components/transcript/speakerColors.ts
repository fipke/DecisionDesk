// 8 distinct colors for speaker identification on dark backgrounds
export const SPEAKER_COLORS = [
  { name: 'blue',    border: 'border-l-blue-400',    text: 'text-blue-400',    bg: 'bg-blue-400',    bgFaint: 'bg-blue-400/10' },
  { name: 'emerald', border: 'border-l-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400', bgFaint: 'bg-emerald-400/10' },
  { name: 'amber',   border: 'border-l-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-400',   bgFaint: 'bg-amber-400/10' },
  { name: 'rose',    border: 'border-l-rose-400',    text: 'text-rose-400',    bg: 'bg-rose-400',    bgFaint: 'bg-rose-400/10' },
  { name: 'violet',  border: 'border-l-violet-400',  text: 'text-violet-400',  bg: 'bg-violet-400',  bgFaint: 'bg-violet-400/10' },
  { name: 'cyan',    border: 'border-l-cyan-400',    text: 'text-cyan-400',    bg: 'bg-cyan-400',    bgFaint: 'bg-cyan-400/10' },
  { name: 'orange',  border: 'border-l-orange-400',  text: 'text-orange-400',  bg: 'bg-orange-400',  bgFaint: 'bg-orange-400/10' },
  { name: 'pink',    border: 'border-l-pink-400',    text: 'text-pink-400',    bg: 'bg-pink-400',    bgFaint: 'bg-pink-400/10' },
] as const;

export function getSpeakerColor(colorIndex: number) {
  return SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
}
