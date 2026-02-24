'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import { Toast } from '@/components/Toast'

export type RoomStatus = 'proposing' | 'voting' | 'done'

export interface Room {
  room_code: string
  status: RoomStatus
  host_user_id: string
  winner_movie_id: number | null
}

export interface Participant {
  id: number
  user_id: string
  room_code: string
  display_name: string
}

interface RoomContextType {
  room: Room | null
  participants: Participant[]
  currentUser: any
  currentParticipant: Participant | null
  isHost: boolean
}

const RoomContext = createContext<RoomContextType>({
  room: null,
  participants: [],
  currentUser: null,
  currentParticipant: null,
  isHost: false,
})

export const useRoom = () => useContext(RoomContext)

export function RoomProvider({
  children,
  roomCodeParam,
}: {
  children: ReactNode
  roomCodeParam: string
}) {
  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const roomCode = roomCodeParam.toUpperCase()

  useEffect(() => {
    let isMounted = true

    async function init() {
      try {
        // 1. Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          router.push('/join')
          return
        }
        if (isMounted) setCurrentUser(user)

        // 2. Fetch room
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', roomCode)
          .single()

        if (roomError) {
          setError(`DB Error: ${roomError.message} (Code: ${roomError.code})`)
          setLoading(false)
          return
        }
        if (!roomData) {
          setError('Room not found')
          setLoading(false)
          return
        }
        if (isMounted) setRoom(roomData)

        // 3. Fetch participants
        const { data: participantsData, error: participantsError } = await supabase
          .from('participants')
          .select('*')
          .eq('room_code', roomCode)

        if (participantsError) {
          setError('Failed to load participants')
        } else if (isMounted) {
          setParticipants(participantsData || [])
          
          // Verify user is a participant
          const isParticipant = participantsData?.some((p: any) => p.user_id === user.id)
          if (!isParticipant) {
            router.push('/join')
            return
          }
        }

        if (isMounted) setLoading(false)
      } catch (err: any) {
        if (isMounted) {
          setError(err.message)
          setLoading(false)
        }
      }
    }

    init()

    // 4. Set up realtime subscriptions
    const channel = supabase
      .channel(`room-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `room_code=eq.${roomCode}` },
        (payload: any) => {
          if (isMounted) {
            const newRoom = payload.new as Room
            setRoom(newRoom)
            // Handle navigation based on status
            if (newRoom.status === 'voting') {
              router.push(`/room/${roomCode}/vote`)
            } else if (newRoom.status === 'done') {
              router.push(`/room/${roomCode}/results`)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_code=eq.${roomCode}` },
        async () => {
          // Re-fetch participants to keep it simple
          const { data } = await supabase
            .from('participants')
            .select('*')
            .eq('room_code', roomCode)
          if (isMounted && data) setParticipants(data)
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [roomCode, router, supabase])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading room...</div>
  }

  if (error || !room) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
        <h2>{error || 'Room not found'}</h2>
        <button onClick={() => router.push('/join')} style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius-md)' }}>Go Back</button>
      </div>
    )
  }

  const currentParticipant = participants.find(p => p.user_id === currentUser?.id) || null
  const isHost = room.host_user_id === currentUser?.id

  return (
    <RoomContext.Provider value={{ room, participants, currentUser, currentParticipant, isHost }}>
      {children}
      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
    </RoomContext.Provider>
  )
}
