# Movie Night Swipe

A Next.js 14 WebApp using Supabase (Auth, Postgres, Realtime) and TMDB API. It allows users to join a room, propose movies, swipe YES/NO, and see the winner.

## Setup Instructions

### 1. Supabase Setup
1. Create a new project on [Supabase](https://supabase.com/).
2. Go to `Authentication > Providers` and enable "Anonymous Sign-ins".
3. Go to the `SQL Editor` and run the contents of the `database.sql` file provided to create tables, relations, policies, and realtime publications.

### 2. TMDB Setup
1. Create an account on [TMDB](https://www.themoviedb.org/).
2. Go to Settings > API and generate an API key (Read Access Token / v4 auth or standard v3 key).

### 3. Environment Variables
1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
2. Fill in the variables from your Supabase Project Settings > API and your TMDB Dashboard.

### 4. Local Development
1. Install dependencies:
```bash
npm install
```
2. Run the development server:
```bash
npm run dev
```
3. Open `http://localhost:3000` in your browser.

## Deployment to Vercel
1. Push your code to a GitHub repository.
2. Import the project in Vercel.
3. In the Vercel project settings, define the following environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TMDB_API_KEY`
4. Deploy!

## Core Features
- Create/Join a realtime room via short code.
- Search TMDB in real time and propose up to 3 movies per user.
- Swipe UI to vote YES/NO on all proposed movies.
- Real-time updates on lobby and voting progress.
- Automatic computation of results including primary and tie-breaker mechanics.
