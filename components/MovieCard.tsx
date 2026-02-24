import Image from 'next/image'
import styles from './MovieCard.module.css'
import type { TMDBMovie } from '@/lib/tmdb'

interface MovieCardProps {
  movie: TMDBMovie
  onSelect?: () => void
  selected?: boolean
  hideSelect?: boolean
}

export function MovieCard({ movie, onSelect, selected, hideSelect }: MovieCardProps) {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null

  return (
    <div 
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onSelect}
      role={onSelect ? "button" : "article"}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className={styles.posterContainer}>
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={movie.title}
            fill
            className={styles.poster}
            unoptimized // Since TMDB images, bypass Next.js optimization for simplicity here
          />
        ) : (
          <div className={styles.noPoster}>
            <span>No Image</span>
          </div>
        )}
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>{movie.title}</h3>
        <p className={styles.year}>{movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</p>
        <p className={styles.overview}>{movie.overview}</p>
      </div>
      {!hideSelect && onSelect && (
        <div className={styles.action}>
          <button className={selected ? styles.btnSelected : styles.btnSelect}>
            {selected ? 'Selected' : 'Select'}
          </button>
        </div>
      )}
    </div>
  )
}
