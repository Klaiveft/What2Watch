'use client'

import { useState, useEffect } from 'react'
import { searchMovies, type TMDBMovie } from '@/lib/tmdb'
import { MovieCard } from './MovieCard'
import styles from './MovieSearch.module.css'
import { Search } from 'lucide-react'

interface MovieSearchProps {
  onSelect: (movie: TMDBMovie) => void
  selectedMovies: TMDBMovie[]
  maxSelections?: number
}

export function MovieSearch({ onSelect, selectedMovies, maxSelections = 3 }: MovieSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TMDBMovie[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2) {
        setLoading(true)
        try {
          const movies = await searchMovies(query)
          setResults(movies)
        } catch (error) {
          console.error("Search failed", error)
        } finally {
          setLoading(false)
        }
      } else {
        setResults([])
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (movie: TMDBMovie) => {
    const isSelected = selectedMovies.some(m => m.id === movie.id)
    if (!isSelected && selectedMovies.length >= maxSelections) {
      alert(`You can only propose up to ${maxSelections} movies.`)
      return
    }
    onSelect(movie)
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <Search className={styles.searchIcon} size={20} />
        <input
          type="text"
          placeholder="Search for movies..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles.input}
        />
      </div>

      {loading && <div className={styles.loading}>Searching...</div>}

      <div className={styles.grid}>
        {results.map((movie) => {
          const isSelected = selectedMovies.some(m => m.id === movie.id)
          return (
            <MovieCard
              key={movie.id}
              movie={movie}
              onSelect={() => handleSelect(movie)}
              selected={isSelected}
            />
          )
        })}
      </div>
      {!loading && query.length > 2 && results.length === 0 && (
        <div className={styles.empty}>No movies found</div>
      )}
    </div>
  )
}
