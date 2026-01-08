# Environment Variables Setup

## Supabase Credentials

### Location
Create a `.env` file in the **root directory** (same level as `package.json`):

```
LAI/
├── .env              ← Create here
├── package.json
├── vite.config.js
└── ...
```

### Format
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Important Rules
1. ✅ Variable names **MUST** start with `VITE_` (Vite requirement)
2. ✅ No quotes around values
3. ✅ No spaces around `=` sign
4. ✅ File must be in **root directory** (not `server/` or `src/`)
5. ✅ **Restart dev server** after creating/updating `.env`

### How to Get Credentials
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

### Verification
After creating `.env` and restarting the dev server, check the browser console:
- ✅ Should see: "✅ Supabase credentials loaded from .env"
- ❌ If you see: "⚠️ Supabase credentials not found" → Check file location and format

## Server Environment Variables

### Location
Create a `.env` file in the `server/` directory:

```
LAI/
└── server/
    ├── .env          ← Create here
    ├── server.js
    └── ...
```

### Format
```env
OPENAI_API_KEY=sk-your-openai-key-here
```

## Troubleshooting

### Credentials Not Loading?

1. **Check file location:**
   - Supabase `.env` → Root directory (same as `package.json`)
   - OpenAI `.env` → `server/` directory

2. **Check variable names:**
   - Must be exactly: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Case-sensitive!

3. **Check format:**
   ```env
   # ✅ Correct
   VITE_SUPABASE_URL=https://abc.supabase.co
   
   # ❌ Wrong (quotes)
   VITE_SUPABASE_URL="https://abc.supabase.co"
   
   # ❌ Wrong (spaces)
   VITE_SUPABASE_URL = https://abc.supabase.co
   ```

4. **Restart dev server:**
   - Stop the server (Ctrl+C)
   - Run `npm run dev` again
   - Vite only loads `.env` on startup

5. **Check browser console:**
   - Open DevTools (F12)
   - Look for credential status messages
   - Should see "✅ Supabase credentials loaded" if working

### Still Not Working?

Check that Vite is loading the file:
- The `.env` file is automatically loaded by Vite
- Variables are exposed via `import.meta.env.VITE_*`
- No additional configuration needed
