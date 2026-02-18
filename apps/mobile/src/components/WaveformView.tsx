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
