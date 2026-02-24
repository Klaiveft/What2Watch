'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useRoom } from '@/components/RoomProvider'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import styles from './results.module.css'
import { Toast } from '@/components/Toast'
import { Trophy, Medal, Users, Ticket } from 'lucide-react'

interface MovieResult {
  id: number
  title: string
  poster_path: string | null
  yesCount: number
  yesRatio: number
}

export default function ResultsPage({ params }: { params: { code: string } }) {
  const { room, participants } = useRoom()
  const [results, setResults] = useState<MovieResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const roomCode = params.code

  useEffect(() => {
    if (room?.status !== 'done') {
      router.push(`/room/${roomCode}/lobby`)
      return
    }
  }, [room?.status, router, roomCode])

  useEffect(() => {
    let isMounted = true

    async function loadResults() {
      try {
        // 1. Fetch all movies
        const { data: movies, error: mErr } = await supabase
          .from('movies')
          .select('*')
          .eq('room_code', roomCode)
          
        if (mErr) throw mErr

        // 2. Fetch all votes
        const { data: votes, error: vErr } = await supabase
          .from('votes')
          .select('*')
          .eq('room_code', roomCode)
          
        if (vErr) throw vErr

        if (isMounted && movies && votes) {
          const stats = movies.map(m => {
            const movieVotes = votes.filter(v => v.movie_id === m.id)
            const yesCount = movieVotes.filter(v => v.value === true).length
            const totalVotes = movieVotes.length
            const yesRatio = totalVotes > 0 ? yesCount / totalVotes : 0
            
            return {
              id: m.id,
              title: m.title,
              poster_path: m.poster_path,
              yesCount,
              yesRatio
            }
          })

          // Sort exact same way as server
          stats.sort((a, b) => {
            if (b.yesCount !== a.yesCount) return b.yesCount - a.yesCount
            if (b.yesRatio !== a.yesRatio) return b.yesRatio - a.yesRatio
            return 0 
          })

          setResults(stats)
          setLoading(false)
        }
      } catch (err: any) {
         if (isMounted) {
           setError(err.message)
           setLoading(false)
         }
      }
    }

    loadResults()
    
    return () => { isMounted = false }
  }, [roomCode, supabase])


  if (loading) return <div>Loading results...</div>

  if (results.length === 0) {
     return <div className={styles.container}>No movies were proposed.</div>
  }

  const winner = results[0]
  const runnersUp = results.slice(1, 4)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Results</h1>
        <p className={styles.subtitle}>Room: {roomCode}</p>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statBubble}>
           <Users size={20} />
           <span>{participants.length} Participants</span>
        </div>
        <div className={styles.statBubble}>
           <Ticket size={20} />
           <span>{results.length} Movies</span>
        </div>
      </div>

      <div className={styles.winnerSection}>
        <div className={styles.winnerHeader}>
           <Trophy className={styles.trophyIcon} size={40} />
           <h2>Tonight's Movie</h2>
        </div>
        
        <div className={styles.winnerCard}>
           {winner.poster_path ? (
              <div className={styles.winnerPosterContainer}>
                <Image
                  src={`https://image.tmdb.org/t/p/w500${winner.poster_path}`}
                  alt={winner.title}
                  fill
                  className={styles.winnerPoster}
                  unoptimized
                />
              </div>
           ) : (
             <div className={styles.winnerNoPoster}>No Image</div>
           )}
           
           <div className={styles.winnerInfo}>
              <h3 className={styles.winnerTitle}>{winner.title}</h3>
              <div className={styles.winnerStats}>
                 <div className={styles.statBox}>
                    <span className={styles.statValue}>{winner.yesCount}</span>
                    <span className={styles.statLabel}>YES Votes</span>
                 </div>
                 <div className={styles.statBox}>
                    <span className={styles.statValue}>{Math.round(winner.yesRatio * 100)}%</span>
                    <span className={styles.statLabel}>Match Rate</span>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {runnersUp.length > 0 && (
        <div className={styles.runnersUpSection}>
          <h3 className={styles.runnersUpTitle}><Medal size={20} /> Runners Up</h3>
          <div className={styles.runnersUpList}>
            {runnersUp.map((movie, index) => (
              <div key={movie.id} className={styles.runnerUpCard}>
                 <span className={styles.rank}>#{index + 2}</span>
                 {movie.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                      alt={movie.title}
                      width={60}
                      height={90}
                      className={styles.runnerUpPoster}
                      unoptimized
                    />
                 ) : (
                    <div className={styles.runnerUpNoPoster}></div>
                 )}
                 <div className={styles.runnerUpInfo}>
                    <h4>{movie.title}</h4>
                    <p>{movie.yesCount} YES votes ({Math.round(movie.yesRatio * 100)}%)</p>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
    </div>
  )
}
