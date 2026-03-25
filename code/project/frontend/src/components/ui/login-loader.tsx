'use client'

import React from 'react'

interface LoginLoaderProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
}

export function LoginLoader({ 
  size = 'medium', 
  color = 'primary'
}: LoginLoaderProps) {
  // Size mappings
  const sizes = {
    small: 'w-6 h-6',
    medium: 'w-10 h-10',
    large: 'w-16 h-16'
  }
  
  // Color mappings - no dark mode variants
  const colorClasses = {
    primary: 'border-blue-500 border-t-blue-200',
    green: 'border-green-500 border-t-green-200',
    amber: 'border-amber-500 border-t-amber-200',
    red: 'border-red-500 border-t-red-200',
    purple: 'border-purple-500 border-t-purple-200'
  }
  
  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        {/* Main spinner */}
        <div className={`${sizes[size]} rounded-full border-4 ${colorClasses[color]} animate-spin`}></div>
        
        {/* Pulsing background */}
        <div className={`absolute inset-0 ${sizes[size]} rounded-full bg-blue-500/20 animate-pulse`}></div>
        
        {/* Center dot */}
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full`}></div>
        
        {/* Ripple effect */}
        <div className={`absolute inset-0 ${sizes[size]} rounded-full border border-blue-500/30 animate-ping`} style={{ animationDuration: '1.5s' }}></div>
      </div>
    </div>
  );
}

export function LoginFullScreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/30">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
      </div>
    </div>
  );
} 