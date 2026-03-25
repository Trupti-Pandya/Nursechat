'use client'

import { useState, useEffect } from 'react'

export function DashboardOverview() {
  return (
    <div className="space-y-6">
      <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-xl shadow-sm p-6 dark:bg-gray-800/20 dark:border-gray-700/30">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4 dark:text-gray-200">Welcome!</h2>
        <p className="text-gray-700 dark:text-gray-300">
          Welcome to the Medical Screening Assistant Admin Dashboard. Use the sidebar to navigate through different sections.
        </p>
      </div>
    </div>
  )
} 