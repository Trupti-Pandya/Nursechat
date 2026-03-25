'use client'

import React from 'react'

interface LoaderProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
  fullScreen?: boolean
}

export function Loader({ 
  size = 'medium', 
  color = 'primary',
  fullScreen = false 
}: LoaderProps) {
  // Size mappings
  const sizes = {
    small: 'w-6 h-6',
    medium: 'w-10 h-10',
    large: 'w-16 h-16'
  }
  
  // Color mappings
  const colorClasses = {
    primary: 'border-blue-500 border-t-blue-200 dark:border-blue-400 dark:border-t-blue-900',
    green: 'border-green-500 border-t-green-200 dark:border-green-400 dark:border-t-green-900',
    amber: 'border-amber-500 border-t-amber-200 dark:border-amber-400 dark:border-t-amber-900',
    red: 'border-red-500 border-t-red-200 dark:border-red-400 dark:border-t-red-900',
    purple: 'border-purple-500 border-t-purple-200 dark:border-purple-400 dark:border-t-purple-900'
  }
  
  const containerClass = fullScreen ? 'fixed inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm dark:bg-gray-900/50' : 'flex items-center justify-center';
  
  return (
    <div className={containerClass}>
      <div className="relative">
        {/* Main spinner */}
        <div className={`${sizes[size]} rounded-full border-4 ${colorClasses[color]} animate-spin`}></div>
        
        {/* Pulsing background */}
        <div className={`absolute inset-0 ${sizes[size]} rounded-full bg-blue-500/20 dark:bg-blue-400/10 animate-pulse`}></div>
        
        {/* Center dot */}
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full`}></div>
        
        {/* Ripple effect */}
        <div className={`absolute inset-0 ${sizes[size]} rounded-full border border-blue-500/30 dark:border-blue-400/30 animate-ping`} style={{ animationDuration: '1.5s' }}></div>
      </div>
    </div>
  );
}

export function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/30 dark:bg-gray-900/30">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin dark:border-blue-400"></div>
      </div>
    </div>
  );
} 