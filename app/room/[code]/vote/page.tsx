'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRoom } from '@/components/RoomProvider'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import { SwipeVote, type VoteMovie } from '@/components/SwipeVote'
import { submitVote, checkVotingComplete } from './actions'
import styles from './vote.module.css'
import { Toast } from '@/components/Toast'

export default function VotePage({ params }: { params: { code: string } }) {
  const { room, participants, currentUser } = useRoom()
  const [moviesToVote, setMoviesToVote] = useState<VoteMovie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [votesCast, setVotesCast] = useState(0)
  const [totalExpectedVotes, setTotalExpectedVotes] = useState(0)
  const [myVotingDone, setMyVotingDone] = useState(false)
  
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const roomCode = params.code

  useEffect(() => {
    if (room?.status === 'proposing') {
      router.push(`/room/${roomCode}/lobby`)
      return
    }
    if (room?.status === 'done') {
      router.push(`/room/${roomCode}/results`)
      return
    }
  }, [room?.status, router, roomCode])

  useEffect(() => {
    let isMounted = true

    async function loadVotingData() {
      try {
        // 1. Fetch all movies in room
        const { data: moviesData, error: mErr } = await supabase
          .from('movies')
          .select('*')
          .eq('room_code', roomCode)
          
        if (mErr) throw mErr

        // 2. Fetch my existing votes
        const { data: myVotesData, error: vErr } = await supabase
          .from('votes')
          .select('movie_id')
          .eq('room_code', roomCode)
          .eq('user_id', currentUser?.id)
          
        if (vErr) throw vErr

        // 3. Fetch total total votes to show progress
        const { count: votesCount, error: tcErr } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('room_code', roomCode)
          
        if (tcErr) throw tcErr

        if (isMounted && moviesData) {
          const votedMovieIds = new Set(myVotesData?.map(v => v.movie_id) || [])
          
          // Only pass movies I haven't voted on yet
          const pendingMovies = moviesData.filter(m => !votedMovieIds.has(m.id))
          
          // Randomize order a bit for fun, or keep as is
          setMoviesToVote(pendingMovies.sort(() => Math.random() - 0.5) as VoteMovie[])
          
          if (pendingMovies.length === 0) {
             setMyVotingDone(true)
          }

          setTotalExpectedVotes(participants.length * moviesData.length)
          setVotesCast(votesCount || 0)
          setLoading(false)
        }
      } catch (err: any) {
         if (isMounted) {
           setError(err.message)
           setLoading(false)
         }
      }
    }

    if (currentUser) {
      loadVotingData()
    }

    // Subscribe to all votes to update progress
    const channel = supabase
      .channel(`votes-progress-${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `room_code=eq.${roomCode}` },
        () => {
           if (isMounted) {
             setVotesCast(prev => {
                const newTotal = prev + 1
                // Periodically check if complete (debounced or just probability based, or strictly let server handle it on action return)
                return newTotal
             })
           }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [roomCode, currentUser, supabase, participants.length])


  const handleVote = async (movieId: number, isYes: boolean) => {
    try {
      await submitVote(roomCode, movieId, isYes)
      // On success, we also trigger check Complete
      const { isComplete } = await checkVotingComplete(roomCode)
      // If complete, Realtime on rooms table will push us to /results
    } catch (err: any) {
      setError(err.message)
      throw err // Let Swipe component handle state un-freeze
    }
  }

  const handleVotingComplete = async () => {
     setMyVotingDone(true)
     // Final check just in case
     await checkVotingComplete(roomCode)
  }

  if (loading) return <div>Loading voting deck...</div>

  // Calculate percentage of total room progress
  const progressPercent = totalExpectedVotes > 0 
     ? Math.min(100, Math.round((votesCast / totalExpectedVotes) * 100)) 
     : 0

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Voting Phase</h1>
        <p className={styles.subtitle}>Swipe Right (Yes) or Left (No)</p>
      </div>

      <div className={styles.progressContainer}>
        <div className={styles.progressLabel}>
          <span>Room Progress</span>
          <span>{votesCast} / {totalExpectedVotes} votes</span>
        </div>
        <div className={styles.progressBar}>
           <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className={styles.mainArea}>
        {myVotingDone ? (
          <div className={styles.waitingState}>
             <h2 className={styles.waitingTitle}>You've voted on all movies!</h2>
             <p className={styles.waitingDesc}>Waiting for others to finish...</p>
             <div className={styles.spinner}></div>
          </div>
        ) : (
          <SwipeVote 
            movies={moviesToVote} 
            onVote={handleVote} 
            onComplete={handleVotingComplete} 
          />
        )}
      </div>

      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
    </div>
  )
}
