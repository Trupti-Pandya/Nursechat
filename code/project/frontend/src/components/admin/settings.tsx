'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export function SystemInformation() {
  const [chatbotStatus, setChatbotStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [isChecking, setIsChecking] = useState(false)
  
  // Function to check chatbot status
  const checkChatbotStatus = () => {
    setIsChecking(true)
    
    // Simulating API call to check chatbot status
    setTimeout(() => {
      // Randomly determine connection status for demo purposes
      const isConnected = Math.random() > 0.3
      setChatbotStatus(isConnected ? 'connected' : 'disconnected')
      setIsChecking(false)
    }, 1500)
  }
  
  // Check status on component mount
  useEffect(() => {
    checkChatbotStatus()
  }, [])

  return (
    <div className="space-y-6">
      <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-xl shadow-sm p-5 dark:bg-gray-800/20 dark:border-gray-700/30">
        <h3 className="text-lg font-medium text-gray-800 mb-4 dark:text-gray-200">System Information</h3>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Version</span>
              <span className="text-sm text-gray-800 dark:text-gray-200">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Environment</span>
              <span className="text-sm text-gray-800 dark:text-gray-200">Production</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Database</span>
              <span className="flex items-center text-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-2"></span>
                <span className="text-gray-800 dark:text-gray-200">Connected</span>
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Chatbot Status</span>
              <div className="flex items-center">
                <span className="flex items-center text-sm">
                  <span 
                    className={`inline-block h-2 w-2 rounded-full mr-2 ${
                      chatbotStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  ></span>
                  <span className={`mr-2 ${
                    chatbotStatus === 'connected' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {chatbotStatus === 'connected' ? 'Connected' : 'Disconnected'}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={checkChatbotStatus}
                  disabled={isChecking}
                  className="text-xs"
                >
                  {isChecking ? 'Checking...' : 'Check'}
                </Button>
              </div>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Updated</span>
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {new Date().toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm dark:bg-blue-900/30 dark:text-blue-300">
          System is operating normally. All services are running as expected.
        </div>
      </div>
      
      <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-xl shadow-sm p-5 dark:bg-gray-800/20 dark:border-gray-700/30">
        <h3 className="text-lg font-medium text-gray-800 mb-4 dark:text-gray-200">Resource Usage</h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">CPU Usage</span>
              <span className="text-sm text-gray-800 dark:text-gray-200">32%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '32%' }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Memory Usage</span>
              <span className="text-sm text-gray-800 dark:text-gray-200">64%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div className="bg-purple-500 h-2 rounded-full" style={{ width: '64%' }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Disk Usage</span>
              <span className="text-sm text-gray-800 dark:text-gray-200">47%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div className="bg-amber-500 h-2 rounded-full" style={{ width: '47%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemInformation 