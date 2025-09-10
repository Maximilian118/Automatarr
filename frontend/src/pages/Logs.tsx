import React, { useState, useEffect, useRef } from 'react'
import { getApiBaseUrl } from '../utils/apiConfig'

interface LogEntry {
  timestamp: string
  level: string
  message: string
}

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [logs])

  const fetchInitialLogs = async () => {
    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/api/logs`)
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (error) {
      console.error('Failed to fetch initial logs:', error)
    }
  }

  const startStreaming = () => {
    if (isStreaming) return
    
    const apiBaseUrl = getApiBaseUrl()
    const es = new EventSource(`${apiBaseUrl}/api/logs/stream`)
    
    es.onmessage = (event) => {
      try {
        const logEntry: LogEntry = JSON.parse(event.data)
        setLogs(prev => [...prev, logEntry])
      } catch (error) {
        console.error('Failed to parse log entry:', error)
      }
    }
    
    es.onerror = () => {
      console.error('EventSource connection error')
      setIsStreaming(false)
    }
    
    setEventSource(es)
    setIsStreaming(true)
  }

  useEffect(() => {
    fetchInitialLogs()
    startStreaming()
    
    return () => {
      if (eventSource) {
        eventSource.close()
        setEventSource(null)
        setIsStreaming(false)
      }
    }
  }, [])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close()
        setEventSource(null)
        setIsStreaming(false)
      }
    }
  }, [eventSource])

  const formatLogLine = (entry: LogEntry, index: number) => {
    // Remove ANSI color codes for cleaner display
    const cleanMessage = entry.message.replace(/\x1b\[[0-9;]*m/g, '')
    
    // Color code different log levels
    let color = '#ffffff'
    if (cleanMessage.includes('✅ SUCCESS')) color = '#4caf50'
    else if (cleanMessage.includes('⚠️ WARN')) color = '#ff9800'
    else if (cleanMessage.includes('❌ ERROR')) color = '#f44336'
    else if (cleanMessage.includes('ℹ️ INFO')) color = '#2196f3'
    else if (cleanMessage.includes('🤖 BOT')) color = '#9c27b0'
    
    // Format timestamp
    const timestamp = new Date(entry.timestamp).toLocaleTimeString()
    
    return (
      <div
        key={index}
        style={{
          color,
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          fontSize: '12px',
          lineHeight: '1.4',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          margin: '1px 0',
        }}
      >
        <span style={{ color: '#888', marginRight: '8px' }}>[{timestamp}]</span>
        {cleanMessage}
      </div>
    )
  }

  return (
    <div style={{
      height: 'calc(100vh - 48px)',
      width: '100vw',
      position: 'fixed',
      top: '48px',
      left: 0,
      zIndex: 1,
      overflow: 'hidden',
      background: 'transparent' // Let app background show through
    }}>
      {/* Logs container */}
      <div
        ref={logsContainerRef}
        style={{
          height: '100%', // Full height now that header is removed
          width: '100%',
          overflow: 'auto',
          padding: '16px',
          boxSizing: 'border-box',
          background: 'transparent'
        }}
      >
        {logs.length === 0 ? (
          <div style={{
            color: '#888',
            fontStyle: 'italic',
            textAlign: 'center',
            marginTop: '2rem'
          }}>
            {isStreaming ? "Loading logs..." : "No logs available."}
          </div>
        ) : (
          logs.map((entry, index) => formatLogLine(entry, index))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}

export default Logs