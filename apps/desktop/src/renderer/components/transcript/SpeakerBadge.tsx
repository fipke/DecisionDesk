import { getSpeakerColor } from './speakerColors';

interface SpeakerBadgeProps {
  displayName: string | null;
  label: string;
  colorIndex: number;
  size?: 'sm' | 'md';
}

export function SpeakerBadge({ displayName, label, colorIndex, size = 'sm' }: SpeakerBadgeProps) {
  const color = getSpeakerColor(colorIndex);
  const name = displayName || label;
  const initials = name.slice(0, 2).toUpperCase();

  const sizeClasses = size === 'md'
    ? 'h-7 w-7 text-xs'
    : 'h-5 w-5 text-[10px]';

  return (
    <div className="flex items-center gap-1.5">
      <span className={`${sizeClasses} flex items-center justify-center rounded-full ${color.bgFaint} ${color.text} font-semibold shrink-0`}>
        {initials}
      </span>
      <span className={`font-medium text-sm ${color.text}`}>
        {name}
      </span>
    </div>
  );
}
