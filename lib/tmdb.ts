const TMDB_API_KEY = process.env.TMDB_API_KEY
const BASE_URL = 'https://api.themoviedb.org/3'

export interface TMDBMovie {
  id: number
  title: string
  poster_path: string | null
  release_date: string
  overview: string
  genre_ids?: number[]
}

export interface TMDBMovieDetails extends TMDBMovie {
  runtime: number
  genres: { id: number; name: string }[]
}

export async function searchMovies(query: string): Promise<TMDBMovie[]> {
  if (!query) return []

  const res = await fetch(
    `${BASE_URL}/search/movie?query=${encodeURIComponent(
      query
    )}&include_adult=false&language=en-US&page=1`,
    {
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
        accept: 'application/json',
      },
    }
  )

  if (!res.ok) {
    console.error('Failed to fetch TMDB search', await res.text())
    return []
  }

  const data = await res.json()
  return data.results || []
}

export async function getMovieDetails(tmdbId: number): Promise<TMDBMovieDetails | null> {
  const res = await fetch(`${BASE_URL}/movie/${tmdbId}?language=en-US`, {
    headers: {
      Authorization: `Bearer ${TMDB_API_KEY}`,
      accept: 'application/json',
    },
  })

  if (!res.ok) {
    console.error('Failed to fetch TMDB details', await res.text())
    return null
  }

  return res.json()
}
