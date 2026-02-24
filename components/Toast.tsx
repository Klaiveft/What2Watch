'use client'

import { useState, useEffect } from 'react'
import styles from './Toast.module.css'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
  onClose?: () => void
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      if (onClose) setTimeout(onClose, 300) // wait for fade out
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!visible && !onClose) return null

  return (
    <div className={`${styles.toast} ${styles[type]} ${!visible ? styles.hiding : ''}`}>
      {message}
    </div>
  )
}
