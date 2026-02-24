'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import styles from './page.module.css'
import { Toast } from '@/components/Toast'

export default function JoinPage() {
  const [displayName, setDisplayName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('Please enter a display name')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // 1. Sign in anonymously if not already
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
      if (authError || !authData.user) throw new Error('Failed to sign in anonymously')
      const userId = authData.user.id

      // 2. Generate short code
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      
      // 3. Create room
      const { error: roomError } = await supabase
        .from('rooms')
        .insert({ room_code: newCode, host_user_id: userId, status: 'proposing' })
      if (roomError) throw new Error(roomError.message)

      // 4. Join room
      const { error: joinError } = await supabase
        .from('participants')
        .insert({ room_code: newCode, user_id: userId, display_name: displayName.trim() })
      if (joinError) throw new Error(joinError.message)

      router.push(`/room/${newCode}/lobby`)
    } catch (err: any) {
      setError(err.message || 'Error creating room')
      setLoading(false)
    }
  }

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim() || !roomCode.trim()) {
      setError('Please enter both name and room code')
      return
    }

    setLoading(true)
    setError(null)

    try {
       const upperCode = roomCode.toUpperCase()
       // 1. Verify room exists and is in proposing phase
       const { data: roomData, error: roomError } = await supabase
         .from('rooms')
         .select('status')
         .eq('room_code', upperCode)
         .single()
         
       if (roomError) throw new Error(`DB Error: ${roomError.message}`)
       if (!roomData) throw new Error('Room not found')
       if (roomData.status !== 'proposing') throw new Error('Room is no longer accepting proposals')

       // 2. Sign in anonymously
       let { data: { user } } = await supabase.auth.getUser()
       if (!user) {
         const { data, error } = await supabase.auth.signInAnonymously()
         if (error || !data.user) throw new Error('Failed to sign in anonymously')
         user = data.user
       }

       // 3. Join room (upsert in case they rejoin)
       const { error: joinError } = await supabase
         .from('participants')
         .upsert({ room_code: upperCode, user_id: user.id, display_name: displayName.trim() }, {
           onConflict: 'room_code, user_id'
         })
         
       if (joinError) throw new Error(joinError.message)

       router.push(`/room/${upperCode}/lobby`)
    } catch (err: any) {
      setError(err.message || 'Error joining room')
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Movie Night Swipe 🍿</h1>
      
      <div className={styles.cardsContainer}>
        {/* Create Room Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Create a Room</h2>
          <p className={styles.cardDesc}>Host a movie night and invite your friends to swipe on movies.</p>
          <form onSubmit={handleCreateRoom} className={styles.form}>
            <input 
              type="text" 
              placeholder="Your Display Name" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={styles.input}
              maxLength={20}
            />
            <button type="submit" disabled={loading} className={`${styles.btn} ${styles.btnPrimary}`}>
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        </div>
        
        <div className={styles.divider}>
           <span>OR</span>
        </div>

        {/* Join Room Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Join a Room</h2>
          <p className={styles.cardDesc}>Have a code? Enter it below to join the fun.</p>
          <form onSubmit={handleJoinRoom} className={styles.form}>
            <input 
              type="text" 
              placeholder="Your Display Name" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={styles.input}
              maxLength={20}
            />
            <input 
              type="text" 
              placeholder="Room Code (e.g. AB12CD)" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className={styles.input}
              style={{ textTransform: 'uppercase' }}
              maxLength={6}
            />
            <button type="submit" disabled={loading} className={`${styles.btn} ${styles.btnSecondary}`}>
              {loading ? 'Joining...' : 'Join Room'}
            </button>
          </form>
        </div>
      </div>
      
      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
    </div>
  )
}
