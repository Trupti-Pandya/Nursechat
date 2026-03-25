"use client";
import { cn } from "@/lib/utils";
import React from "react";
import { useTheme } from "@/components/theme-provider";

export function BackgroundGradientAnimation({
  firstColor = "22, 163, 74",
  secondColor = "37, 99, 235",
  thirdColor = "250, 204, 21",
  fourthColor = "234, 88, 12",
  fifthColor = "139, 92, 246",
  sixthColor = "14, 165, 233",
  seventhColor = "217, 70, 239",
  children,
  className,
  containerClassName,
  interactive = false,
}: {
  gradientBackgroundStart?: string;
  gradientBackgroundEnd?: string;
  firstColor?: string;
  secondColor?: string;
  thirdColor?: string;
  fourthColor?: string;
  fifthColor?: string;
  sixthColor?: string;
  seventhColor?: string;
  pointerColor?: string;
  size?: string;
  blendingValue?: string;
  children?: React.ReactNode;
  className?: string;
  interactive?: boolean;
  containerClassName?: string;
}) {
  const { theme } = useTheme();
  // Define transparent background to let colors blend naturally
  const background = `transparent`;
  const isDark = theme === "dark";

  return (
    <div
      className={cn(
        "h-full flex relative w-full overflow-hidden",
        containerClassName
      )}
      style={{
        background: background,
      }}
    >
      <div 
        className={`absolute inset-0 ${isDark ? 'bg-gray-950/95' : 'bg-white/95'}`}
      />
      <div
        className="absolute inset-0 flex items-center justify-center"
      >
        <div
          className="animate-[moveVertical_30s_ease_infinite] absolute h-[35%] w-[45%] rounded-full"
          style={{
            filter: "blur(7rem)",
            background: `rgba(${firstColor}, ${isDark ? '0.4' : '0.5'})`,
            left: "10%",
            top: "15%",
          }}
        />
        <div
          className="animate-[moveInCircle_20s_reverse_infinite] absolute h-[30%] w-[35%] rounded-full"
          style={{
            filter: "blur(7rem)",
            background: `rgba(${secondColor}, ${isDark ? '0.4' : '0.5'})`,
            right: "15%",
            top: "20%",
          }}
        />
        <div
          className="animate-[moveInCircle_40s_linear_infinite] absolute h-[35%] w-[40%] rounded-full"
          style={{
            filter: "blur(7rem)",
            background: `rgba(${thirdColor}, ${isDark ? '0.4' : '0.5'})`,
            left: "10%",
            bottom: "10%",
          }}
        />
        <div
          className="animate-[moveHorizontal_40s_ease_infinite] absolute h-[38%] w-[48%] rounded-full"
          style={{
            filter: "blur(7rem)",
            background: `rgba(${fourthColor}, ${isDark ? '0.5' : '0.5'})`,
            right: "10%",
            bottom: "15%",
          }}
        />
        <div
          className="animate-[moveInCircle_20s_ease_infinite] absolute h-[30%] w-[40%] rounded-full"
          style={{
            filter: "blur(7rem)",
            background: `rgba(${fifthColor}, ${isDark ? '0.4' : '0.5'})`,
            right: "35%",
            top: "40%",
          }}
        />
        <div
          className="animate-[moveHorizontal_30s_ease_infinite] absolute h-[25%] w-[30%] rounded-full"
          style={{
            filter: "blur(7rem)",
            background: `rgba(${sixthColor || firstColor}, ${isDark ? '0.3' : '0.5'})`,
            left: "40%",
            top: "25%",
          }}
        />
        <div
          className="animate-[moveVertical_25s_ease_infinite] absolute h-[32%] w-[32%] rounded-full"
          style={{
            filter: "blur(7rem)",
            background: `rgba(${seventhColor || secondColor}, ${isDark ? '0.3' : '0.5'})`,
            left: "30%",
            bottom: "30%",
          }}
        />
      </div>
      <div className="relative z-10 flex-1">{children}</div>
    </div>
  );
}
