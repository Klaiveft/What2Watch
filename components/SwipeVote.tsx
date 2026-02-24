'use client'

import { useState } from 'react'
import Image from 'next/image'
import styles from './SwipeVote.module.css'
import { X, Check } from 'lucide-react'

// Using the same generic structure from the NextJS server
export interface VoteMovie {
  id: number
  tmdb_id: number
  title: string
  poster_path: string | null
  release_year: number | null
  runtime: number | null
  overview: string | null
  genres: string | null
}

interface SwipeVoteProps {
  movies: VoteMovie[]
  onVote: (movieId: number, isYes: boolean) => Promise<void>
  onComplete: () => void
}

export function SwipeVote({ movies, onVote, onComplete }: SwipeVoteProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVoting, setIsVoting] = useState(false)
  
  if (currentIndex >= movies.length) {
    onComplete()
    return null
  }

  const currentMovie = movies[currentIndex]
  const posterUrl = currentMovie.poster_path
    ? `https://image.tmdb.org/t/p/w780${currentMovie.poster_path}`
    : null

  const handleVote = (isYes: boolean) => {
    // Optimistically move to next card instantly
    setCurrentIndex(prev => prev + 1)
    
    // Fire and forget the vote submission
    onVote(currentMovie.id, isYes).catch(err => {
      console.error('Failed to submit vote:', err)
      // In a real app we might want to revert the swipe or show a toast,
      // but fire-and-forget is usually fine for a fun prototype.
    })
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.posterContainer}>
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={currentMovie.title}
              fill
              className={styles.poster}
              priority
              unoptimized
            />
          ) : (
             <div className={styles.noPoster}>No Image</div>
          )}
          
          <div className={styles.overlay}>
             <h2 className={styles.title}>{currentMovie.title}</h2>
             <div className={styles.meta}>
               {currentMovie.release_year && <span>{currentMovie.release_year}</span>}
               {currentMovie.runtime && (
                 <>
                   <span className={styles.dot}>•</span>
                   <span>{currentMovie.runtime} min</span>
                 </>
               )}
             </div>
             {currentMovie.genres && <div className={styles.genres}>{currentMovie.genres}</div>}
          </div>
        </div>
        
        <div className={styles.infoRow}>
          <p className={styles.overview}>{currentMovie.overview}</p>
        </div>
      </div>
      
      <div className={styles.actions}>
        <button 
          onClick={() => handleVote(false)} 
          className={`${styles.voteBtn} ${styles.btnNo}`}
          aria-label="Vote No"
        >
          <X size={32} />
        </button>
        <button 
          onClick={() => handleVote(true)} 
          className={`${styles.voteBtn} ${styles.btnYes}`}
          aria-label="Vote Yes"
        >
          <Check size={32} />
        </button>
      </div>
      
      <div className={styles.progress}>
        {currentIndex + 1} of {movies.length}
      </div>
    </div>
  )
}
