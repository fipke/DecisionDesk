import { Pressable, Text } from 'react-native';
import { ReactNode } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  icon?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-emerald-500',
  secondary: 'bg-slate-700',
  danger: 'bg-rose-500'
};

export function PrimaryButton({ title, onPress, disabled = false, variant = 'primary', icon }: PrimaryButtonProps) {
  return (
    <Pressable
      className={clsx(
        'mt-4 flex-row items-center justify-center rounded-xl px-4 py-3',
        variantClasses[variant],
        disabled && 'opacity-40'
      )}
      onPress={disabled ? undefined : onPress}
    >
      {icon}
      <Text className={clsx('text-base font-semibold text-slate-50', icon ? 'ml-2' : undefined)}>
        {title}
      </Text>
    </Pressable>
  );
}
