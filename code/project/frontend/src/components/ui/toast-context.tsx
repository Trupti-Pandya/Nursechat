"use client"

import { createContext, useContext, useState, useCallback } from 'react'
import { Toast, ToastContainer } from './toast'
import { v4 as uuidv4 } from 'uuid'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, type: ToastType, duration?: number) => void
  hideToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType, duration = 5000) => {
    const id = uuidv4()
    setToasts((prevToasts) => [...prevToasts, { id, message, type, duration }])
  }, [])

  const hideToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}
      <ToastContainer>
        {toasts.map((toast, index) => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={hideToast}
            duration={toast.duration}
            style={{
              // Apply a staggered offset for stacking effect
              zIndex: 1000 - index,
              marginBottom: index > 0 ? `-${Math.min(index * 8, 24)}px` : '0',
              transform: `scale(${1 - index * 0.03}) translateY(${index * 5}px)`,
              opacity: 1 - (index * 0.15),
            }}
          />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
} 