import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

export default function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const animated = useAnimatedNumber(value);
  return (
    <span>
      {prefix}
      {animated.toFixed(decimals)}
      {suffix}
    </span>
  );
}
