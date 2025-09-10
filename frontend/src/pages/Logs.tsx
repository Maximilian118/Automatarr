import React, { useState, useEffect, useRef } from 'react'
import { Typography, Box, Paper } from '@mui/material'
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
      }
    }
  }, [])

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
    <Box sx={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden' }}>
      <Paper
        elevation={3}
        sx={{
          backgroundColor: '#1e1e1e',
          border: '1px solid #333',
          borderRadius: 1,
          flex: '1 1 0',
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box
          sx={{
            backgroundColor: '#2d2d2d',
            color: '#ffffff',
            padding: '8px 32px 8px 16px',
            borderBottom: '1px solid #333',
            fontSize: '14px',
            fontWeight: 'bold',
            flexShrink: 0
          }}
        >
          Backend Logs
        </Box>
        
        <Box
          ref={logsContainerRef}
          sx={{
            flex: '1 1 0',
            minHeight: 0,
            overflow: 'auto',
            padding: '16px',
            backgroundColor: '#1e1e1e',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: '#2d2d2d',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#555',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              backgroundColor: '#777',
            },
          }}
        >
          {logs.length === 0 ? (
            <Typography
              variant="body2"
              sx={{
                color: '#888',
                fontStyle: 'italic',
                textAlign: 'center',
                mt: 4
              }}
            >
              No logs yet. Click "Start Streaming" to begin viewing real-time logs.
            </Typography>
          ) : (
            logs.map((entry, index) => formatLogLine(entry, index))
          )}
          <div ref={logsEndRef} />
        </Box>
      </Paper>
    </Box>
  )
}

export default Logs