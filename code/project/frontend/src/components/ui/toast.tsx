"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, AlertCircle, Info, X } from 'lucide-react'

interface ToastProps {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  onClose: (id: string) => void
  duration?: number
  style?: React.CSSProperties
}

export function Toast({ id, message, type, onClose, duration = 5000, style }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id)
    }, duration)

    return () => clearTimeout(timer)
  }, [id, duration, onClose])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Check className="w-5 h-5 text-green-500 dark:text-green-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-500 dark:text-blue-400" />
      default:
        return null
    }
  }

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100/80 border-green-200/80 text-green-800 dark:bg-green-900/40 dark:border-green-800/50 dark:text-green-300'
      case 'error':
        return 'bg-red-100/80 border-red-200/80 text-red-800 dark:bg-red-900/40 dark:border-red-800/50 dark:text-red-300'
      case 'info':
        return 'bg-blue-100/80 border-blue-200/80 text-blue-800 dark:bg-blue-900/40 dark:border-blue-800/50 dark:text-blue-300'
      default:
        return 'bg-gray-100/80 border-gray-200/80 text-gray-800 dark:bg-gray-800/40 dark:border-gray-700/50 dark:text-gray-300'
    }
  }

  return (
    <motion.div
      className={`backdrop-blur-md rounded-lg shadow-md p-4 border ${getToastStyles()} flex items-center justify-between max-w-md w-full`}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={style}
    >
      <div className="flex items-center space-x-3">
        {getIcon()}
        <span className="text-sm font-medium">{message}</span>
      </div>
      <button 
        onClick={() => onClose(id)} 
        className="p-1 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

export function ToastContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
      <AnimatePresence>
        {children}
      </AnimatePresence>
    </div>
  )
} 