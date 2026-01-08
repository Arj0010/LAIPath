# Supabase Setup Guide

## Prerequisites

1. Create a Supabase project at https://supabase.com
2. Get your project URL and anon key from the Supabase dashboard

## Environment Variables

Create a `.env` file in the **root directory** (same level as `package.json`):

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important Notes:**
- The `.env` file must be in the **root directory** (not in `server/` or `src/`)
- Variable names **must** start with `VITE_` for Vite to expose them to the frontend
- No quotes needed around values
- No spaces around the `=` sign
- After creating/updating `.env`, **restart the dev server** (`npm run dev`)

**Example .env file location:**
```
LAI/
├── .env              ← Create here (root directory)
├── package.json
├── vite.config.js
├── src/
└── server/
```

## Database Schema

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Create profiles table (uses id as primary key, matching auth.users(id))
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  preferred_study_time TEXT DEFAULT '20:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create syllabi table (metadata only)
CREATE TABLE IF NOT EXISTS syllabi (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  hours_per_day NUMERIC NOT NULL,
  total_days INTEGER NOT NULL,
  start_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create syllabus_days table (one row per day)
CREATE TABLE IF NOT EXISTS syllabus_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id TEXT NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date DATE NOT NULL,
  topic TEXT NOT NULL,
  subtasks JSONB NOT NULL, -- Array stored as JSONB
  ai_expert_prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  learning_input TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(syllabus_id, day_number)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_days ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create policies for syllabi
CREATE POLICY "Users can view their own syllabus"
  ON syllabi FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own syllabus"
  ON syllabi FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own syllabus"
  ON syllabi FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own syllabus"
  ON syllabi FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for syllabus_days
CREATE POLICY "Users can view their own syllabus days"
  ON syllabus_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM syllabi 
      WHERE syllabi.id = syllabus_days.syllabus_id 
      AND syllabi.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own syllabus days"
  ON syllabus_days FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM syllabi 
      WHERE syllabi.id = syllabus_days.syllabus_id 
      AND syllabi.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own syllabus days"
  ON syllabus_days FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM syllabi 
      WHERE syllabi.id = syllabus_days.syllabus_id 
      AND syllabi.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own syllabus days"
  ON syllabus_days FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM syllabi 
      WHERE syllabi.id = syllabus_days.syllabus_id 
      AND syllabi.user_id = auth.uid()
    )
  );
```

## Google OAuth Setup

1. Go to Authentication > Providers in your Supabase dashboard
2. Enable Google provider
3. Add your Google OAuth credentials:
   - Client ID
   - Client Secret
4. Add authorized redirect URL: `https://your-project-ref.supabase.co/auth/v1/callback`

## Testing

1. Start the app: `npm run dev`
2. Click "Continue with Google" on the landing page
3. Complete Google OAuth flow
4. Your syllabus and profile will be saved to Supabase
5. Refresh the page - your session should be restored

