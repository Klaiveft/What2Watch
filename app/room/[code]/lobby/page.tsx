'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRoom } from '@/components/RoomProvider'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import { MovieSearch } from '@/components/MovieSearch'
import { MovieCard } from '@/components/MovieCard'
import { getMovieDetails, type TMDBMovie } from '@/lib/tmdb'
import styles from './lobby.module.css'
import { Toast } from '@/components/Toast'

interface ProposeMovie extends TMDBMovie {
  proposal_id: number
  proposed_by: string
}

export default function LobbyPage({ params }: { params: { code: string } }) {
  const { room, participants, currentUser, currentParticipant, isHost } = useRoom()
  const [proposedMovies, setProposedMovies] = useState<ProposeMovie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const roomCode = params.code

  useEffect(() => {
    if (room?.status === 'voting') {
      router.push(`/room/${roomCode}/vote`)
      return
    }
    if (room?.status === 'done') {
      router.push(`/room/${roomCode}/results`)
      return
    }
  }, [room?.status, router, roomCode])

  useEffect(() => {
    let isMounted = true

    async function fetchProposals() {
      try {
        const { data, error } = await supabase
          .from('proposals')
          .select(`
            id,
            user_id,
            movies (*)
          `)
          .eq('room_code', roomCode)

        if (error) throw error

        if (isMounted && data) {
          const mapped = data.map((p: any) => {
            const participant = participants.find(part => part.user_id === p.user_id)
            return {
              proposal_id: p.id,
              proposed_by: participant?.display_name || 'Unknown',
              id: p.movies.id, // Internal DB ID, but we map it for the UI if needed
              tmdb_id: p.movies.tmdb_id,
              title: p.movies.title,
              poster_path: p.movies.poster_path,
              release_date: p.movies.release_year?.toString() || '',
              overview: p.movies.overview || '',
            } as any // Forcing type for simplicity here, TMDBMovie structure
          })
          
          // Deduplicate by tmdb_id for display if multiple proposed the same
          // But technically our DB enforces unique(user, movie), and unique(room, tmdb)
          // Wait, the DB schema:
          // movies (room_code, tmdb_id) unique
          // proposals (user_id, movie_id) unique
          // So a movie is in `movies` once per room. Multiple users can propose it.
          
          const uniqueMovies = Array.from(new Map(mapped.map((m: any) => [m.tmdb_id, m])).values())
          
          setProposedMovies(uniqueMovies as ProposeMovie[])
        }
      } catch (err: any) {
        if (isMounted) setError(err.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    if (participants.length > 0) {
      fetchProposals()
    }

    const channel = supabase
      .channel(`proposals-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proposals', filter: `room_code=eq.${roomCode}` },
        () => {
          fetchProposals()
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [roomCode, participants, supabase])


  const handlePropose = async (movie: TMDBMovie) => {
    if (!currentUser) return
    setError(null)
    
    // Check limit
    const myProposals = proposedMovies.filter(p => p.proposed_by === currentParticipant?.display_name) // Quick hack relying on display_name sync
    // In a real app we'd count exactly my user_id.
    const myCount = proposedMovies.length // This is wrong, let's fetch exactly 
    
    try {
      // 1. Check strict server side max 3 rule
      const { count } = await supabase
        .from('proposals')
        .select('*', { count: 'exact', head: true })
        .eq('room_code', roomCode)
        .eq('user_id', currentUser.id)
        
      if (count !== null && count >= 3) {
        throw new Error('You can only propose up to 3 movies.')
      }

      // 2. Fetch full details from TMDB
      const details = await getMovieDetails(movie.id)
      if (!details) throw new Error('Could not fetch movie details')

      // 3. Upsert into movies table
      let movieId: number

      const { data: existingMovie } = await supabase
        .from('movies')
        .select('id')
        .eq('room_code', roomCode)
        .eq('tmdb_id', movie.id)
        .single()

      if (existingMovie) {
        movieId = existingMovie.id
      } else {
        const { data: newMovie, error: insertError } = await supabase
          .from('movies')
          .insert({
            room_code: roomCode,
            tmdb_id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            release_year: movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : null,
            runtime: details.runtime,
            overview: movie.overview,
            genres: details.genres.map(g => g.name).join(', ')
          })
          .select('id')
          .single()
          
        if (insertError) throw new Error(insertError.message)
        movieId = newMovie.id
      }

      // 4. Insert proposal
      const { error: proposalError } = await supabase
        .from('proposals')
        .insert({
          room_code: roomCode,
          user_id: currentUser.id,
          movie_id: movieId
        })

      if (proposalError) {
        if (proposalError.code === '23505') {
          throw new Error('You already proposed this movie.')
        }
        throw new Error(proposalError.message)
      }
      
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleStartVoting = async () => {
    if (!isHost) return
    setError(null)

    if (participants.length < 2) {
      setError('You need at least 2 participants to start voting.')
      return
    }

    if (proposedMovies.length < 2) {
      setError('You need at least 2 proposed movies to start voting.')
      return
    }

    try {
      const { error } = await supabase.rpc('start_voting', { p_room_code: roomCode })
      if (error) throw new Error(error.message)
      // Realtime will automatically push us to /vote
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) return <div>Loading lobby...</div>

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Room: {roomCode}</h1>
          <p className={styles.subtitle}>Propose up to 3 movies</p>
        </div>
        
        {isHost && (
          <button 
            onClick={handleStartVoting} 
            className={styles.btnStart}
          >
            Start Voting
          </button>
        )}
      </div>

      <div className={styles.gridContainer}>
        <div className={styles.mainCol}>
           <div className={styles.searchSection}>
              <h2 className={styles.sectionTitle}>Add a Movie</h2>
              <MovieSearch 
                onSelect={handlePropose} 
                selectedMovies={proposedMovies} // In a strict world we'd pass only MY proposals here to show "Selected"
              />
           </div>

           <div className={styles.proposalsSection}>
              <h2 className={styles.sectionTitle}>Proposed Movies ({proposedMovies.length})</h2>
              {proposedMovies.length === 0 ? (
                <div className={styles.emptyState}>No movies proposed yet. Be the first!</div>
              ) : (
                <div className={styles.movieGrid}>
                  {proposedMovies.map((m) => (
                    <div key={m.proposal_id} className={styles.proposedCard}>
                      <MovieCard movie={m as any} hideSelect />
                    </div>
                  ))}
                </div>
              )}
           </div>
        </div>

        <div className={styles.sideCol}>
           <div className={styles.panel}>
              <h2 className={styles.sectionTitle}>Participants ({participants.length})</h2>
              <ul className={styles.participantList}>
                 {participants.map(p => (
                   <li key={p.id} className={styles.participantItem}>
                     {p.display_name} {p.user_id === room?.host_user_id && <span className={styles.hostBadge}>Host</span>}
                     {p.user_id === currentUser?.id && <span className={styles.youBadge}>You</span>}
                   </li>
                 ))}
              </ul>
           </div>
        </div>
      </div>

      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
    </div>
  )
}
