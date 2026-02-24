'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function submitVote(roomCode: string, movieId: number, value: boolean) {
  const supabase = createSupabaseServerClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  // We could add extra checks here, but RLS on 'votes' handles ensuring 
  // users can only vote for themselves and only when room is 'voting'.
  
  const { error } = await supabase
    .from('votes')
    .insert({
      room_code: roomCode,
      user_id: user.id,
      movie_id: movieId,
      value
    })
    
  if (error) {
    if (error.code === '23505') {
       // already voted, ignore or throw
       return { success: true, message: 'Already voted' }
    }
    console.error('Submit vote error:', error)
    throw new Error('Failed to submit vote')
  }

  return { success: true }
}

export async function checkVotingComplete(roomCode: string, forceComplete: boolean = false) {
  const supabase = createSupabaseServerClient()

  // 1. Get total participants count
  const { count: participantsCount, error: pErr } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('room_code', roomCode)

  if (pErr) throw new Error(pErr.message)

  // 2. Get total movies count
  const { count: moviesCount, error: mErr } = await supabase
    .from('movies')
    .select('*', { count: 'exact', head: true })
    .eq('room_code', roomCode)

  if (mErr) throw new Error(mErr.message)

  // 3. Get total votes cast
  const expectedVotes = (participantsCount || 0) * (moviesCount || 0)

  const { count: votesCount, error: vErr } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('room_code', roomCode)

  if (vErr) throw new Error(vErr.message)

  // 4. If complete or forced, calculate winner
  if (forceComplete || (votesCount !== null && votesCount >= expectedVotes)) {
    // We should call a secure server-side finalize.
    // However, since we might need to bypass RLS to compute and update the room
    const adminSupabase = (await import('@/lib/supabase-server')).createSupabaseAdminClient()
    
    // Fetch all votes and movies
    const { data: votes } = await adminSupabase.from('votes').select('*').eq('room_code', roomCode)
    const { data: movies } = await adminSupabase.from('movies').select('id').eq('room_code', roomCode)
    
    if (!votes || !movies) return { isComplete: true, winnerId: null }

    const results = movies.map(m => {
       const movieVotes = votes.filter(v => v.movie_id === m.id)
       const yesCount = movieVotes.filter(v => v.value === true).length
       const totalVotes = movieVotes.length
       const yesRatio = totalVotes > 0 ? yesCount / totalVotes : 0
       return { id: m.id, yesCount, yesRatio }
    })

    // Sort by YES count desc, then YES ratio desc, then random
    results.sort((a, b) => {
      if (b.yesCount !== a.yesCount) return b.yesCount - a.yesCount
      if (b.yesRatio !== a.yesRatio) return b.yesRatio - a.yesRatio
      return Math.random() - 0.5 // tie-breaker
    })

    const winnerId = results[0]?.id || null

    // Update room status
    await adminSupabase
      .from('rooms')
      .update({ status: 'done', winner_movie_id: winnerId })
      .eq('room_code', roomCode)

    return { isComplete: true, winnerId, expectedVotes, votesCount }
  }

  return { isComplete: false, expectedVotes, votesCount }
}
