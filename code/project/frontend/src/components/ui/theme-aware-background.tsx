"use client";

import { useTheme } from '@/components/theme-provider';
import { BackgroundGradientAnimation } from './background-gradient-animation';
import React from 'react';

export function ThemeAwareBackground({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { theme } = useTheme();
  
  // Colors for light theme
  const lightColors = {
    firstColor: "22, 163, 74",     // green-600
    secondColor: "37, 99, 235",    // blue-600
    thirdColor: "250, 204, 21",    // yellow-400
    fourthColor: "234, 88, 12",    // amber-600
    fifthColor: "139, 92, 246",    // purple-500
  };
  
  // Darker and more subdued colors for dark theme
  const darkColors = {
    firstColor: "20, 83, 45",      // lighter dark green
    secondColor: "30, 58, 138",    // lighter dark blue
    thirdColor: "161, 98, 7",      // lighter dark amber
    fourthColor: "124, 45, 18",    // lighter dark red/brown
    fifthColor: "91, 33, 182",     // lighter dark purple
  };
  
  const colors = theme === 'dark' ? darkColors : lightColors;
  
  return (
    <BackgroundGradientAnimation
      {...colors}
      className={className}
      containerClassName={theme === 'dark' ? 'bg-gray-950' : ''}
    >
      {children}
    </BackgroundGradientAnimation>
  );
} 