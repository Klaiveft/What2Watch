-- Drop tables if they exist
drop table if exists votes cascade;
drop table if exists proposals cascade;
drop table if exists movies cascade;
drop table if exists participants cascade;
drop table if exists rooms cascade;

-- Create tables
create table rooms (
  room_code text primary key,
  status text not null default 'proposing', -- 'proposing', 'voting', 'done'
  host_user_id uuid not null, -- The creator's anonymous user id
  winner_movie_id bigint references movies(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint status_check check (status in ('proposing', 'voting', 'done'))
);

create table participants (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  room_code text references rooms(room_code) on delete cascade not null,
  display_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (room_code, user_id)
);

create table movies (
  id bigint generated always as identity primary key,
  room_code text references rooms(room_code) on delete cascade not null,
  tmdb_id bigint not null,
  title text not null,
  poster_path text,
  release_year integer,
  runtime integer,
  overview text,
  genres text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (room_code, tmdb_id)
);

create table proposals (
  id bigint generated always as identity primary key,
  room_code text references rooms(room_code) on delete cascade not null,
  user_id uuid not null,
  movie_id bigint references movies(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, movie_id)
);

create table votes (
  id bigint generated always as identity primary key,
  room_code text references rooms(room_code) on delete cascade not null,
  user_id uuid not null,
  movie_id bigint references movies(id) on delete cascade not null,
  value boolean not null, -- true for YES, false for NO
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, movie_id)
);

-- Row Level Security (RLS) setup
alter table rooms enable row level security;
alter table participants enable row level security;
alter table movies enable row level security;
alter table proposals enable row level security;
alter table votes enable row level security;

-- Policies for rooms
-- Anyone can read rooms
create policy "Rooms are readable by everyone." on rooms
  for select using (true);

-- Authenticated users can create rooms
create policy "Users can create rooms." on rooms
  for insert with check (auth.uid() = host_user_id);

-- Only host can update the room (to start voting or finalize)
-- In a real production app, finalize should probably be restricted to service role
create policy "Hosts can update their rooms." on rooms
  for update using (auth.uid() = host_user_id);

-- Policies for participants
-- Anyone can read participants for a specific room
create policy "Participants are readable by everyone." on participants
  for select using (true);

-- Users can join a room (insert themselves)
create policy "Users can join rooms." on participants
  for insert with check (auth.uid() = user_id);

-- Policies for movies
-- Anyone can read movies in a room
create policy "Movies are readable by everyone." on movies
  for select using (true);

-- Any participant can add a movie to the room if proposing phase
create policy "Participants can add movies." on movies
  for insert with check (
    exists (
      select 1 from rooms
      where rooms.room_code = movies.room_code
      and rooms.status = 'proposing'
    )
  );

-- Policies for proposals
-- Anyone can read proposals
create policy "Proposals are readable by everyone." on proposals
  for select using (true);

-- Participants can propose a movie (max 3 rule should be enforced by constraint/trigger or client/server code)
create policy "Users can add proposals." on proposals
  for insert with check (
    auth.uid() = user_id and
    exists (
        select 1 from rooms
        where rooms.room_code = proposals.room_code
        and rooms.status = 'proposing'
    )
  );

-- Policies for votes
-- Everyone can read all votes (but we'll hide the actual 'value' from UI or use aggregated functions)
-- Actually, we have to let everyone read them for realtime to work easily, or we could secure it better.
create policy "Votes are readable by everyone." on votes
  for select using (true);

-- Users can only vote for themselves during 'voting' phase
create policy "Users can cast votes." on votes
  for insert with check (
    auth.uid() = user_id and
    exists (
      select 1 from rooms
      where rooms.room_code = votes.room_code
      and rooms.status = 'voting'
    )
  );


-- Functions & Triggers

-- Function to start voting (host only)
CREATE OR REPLACE FUNCTION start_voting(p_room_code text)
RETURNS void AS $$
BEGIN
  -- We assume the policy checks host_user_id or we do it carefully in the server action. 
  -- For safety, let's just do the update. If RLS is enabled, the caller must be host or service_role.
  UPDATE rooms SET status = 'voting' WHERE room_code = p_room_code AND status = 'proposing';
END;
$$ LANGUAGE plpgsql;

-- Set up Realtime publications
begin;
  -- remove the supabase_realtime publication
  drop publication if exists supabase_realtime;
  -- re-create the supabase_realtime publication with no tables
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table movies;
alter publication supabase_realtime add table proposals;
alter publication supabase_realtime add table votes;
