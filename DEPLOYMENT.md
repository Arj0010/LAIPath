# LAIPath Deployment Guide - Full Stack on Vercel

This guide covers deploying LAIPath to production using Vercel for both frontend and backend (serverless functions).

## Overview

- **Frontend**: Deployed to Vercel (static site)
- **Backend**: Deployed as Vercel serverless functions (in `api/` folder)
- **Single Deployment**: Everything deployed together on Vercel

## Prerequisites

- Node.js 18+ installed
- Vercel account (free tier works, but Pro recommended for 60s timeout)
- OpenAI API key (for AI features)
- Supabase account (for cloud storage)

## Deployment Steps

### Step 1: Prepare Repository

1. Ensure all changes are committed:
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push
   ```

2. Verify build works locally:
   ```bash
   npm run build
   ```

3. Test serverless function locally (optional):
   ```bash
   npm run dev
   # In another terminal:
   npm run dev --prefix server
   ```

### Step 2: Deploy to Vercel

#### Option A: Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Follow prompts:
   - Link to existing project or create new
   - Confirm settings (Vercel auto-detects from `vercel.json`)

5. Deploy to production:
   ```bash
   vercel --prod
   ```

#### Option B: GitHub Integration (Recommended)

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect settings from `vercel.json`
5. Configure environment variables (see Step 3)
6. Click "Deploy"

### Step 3: Configure Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables, add:

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

**Optional:**
- `NODE_ENV` - Set to `production` for production deployments

**For all environments (Development, Preview, Production):**

1. Go to Project Settings → Environment Variables
2. Add each variable
3. Select all environments (Development, Preview, Production)
4. Save

### Step 4: Verify Deployment

1. Visit your Vercel deployment URL
2. Test the application:
   - Create a learning plan
   - Complete a day
   - Test AI chat
   - Verify profile access

3. Check serverless function logs:
   - Vercel Dashboard → Functions → View logs

## Project Structure

```
LAIPath/
├── api/
│   └── index.js          # Vercel serverless function entry point
├── server/
│   ├── server.js         # Express app (exported for Vercel)
│   └── aiConfig.js      # AI configuration
├── src/                  # React frontend
├── dist/                 # Build output (generated)
├── vercel.json          # Vercel configuration
└── package.json         # Dependencies (includes backend deps)
```

## How It Works

1. **Frontend**: Vite builds React app to `dist/` folder
2. **Backend**: Express app in `server/server.js` is exported and used by `api/index.js`
3. **Routing**: Vercel rewrites `/api/*` requests to the serverless function
4. **Serverless**: Each API request invokes the Express app as a serverless function

## Important Notes

### Timeout Limits

- **Free Tier**: 10 seconds per function execution
- **Pro Tier**: 60 seconds per function execution (recommended for AI features)

For OpenAI API calls that may take longer, consider:
- Using Pro tier (60s timeout)
- Implementing request queuing
- Using streaming responses

### Cold Starts

Serverless functions may have cold starts (first request slower). This is normal and subsequent requests are fast.

### Environment Variables

- Backend variables (like `OPENAI_API_KEY`) are available to serverless functions
- Frontend variables (prefixed with `VITE_`) are embedded at build time
- Update environment variables in Vercel Dashboard, then redeploy

## Troubleshooting

### Function Timeout

**Error**: Function execution exceeded timeout

**Solution**:
- Upgrade to Vercel Pro for 60s timeout
- Optimize AI prompts to reduce response time
- Implement request queuing for long operations

### API Routes Not Working

**Error**: 404 on `/api/*` routes

**Solution**:
- Verify `vercel.json` has correct rewrites
- Check `api/index.js` exists and exports the app
- Verify `server/server.js` exports the app correctly

### Environment Variables Not Available

**Error**: `process.env.OPENAI_API_KEY` is undefined

**Solution**:
- Add variables in Vercel Dashboard → Environment Variables
- Redeploy after adding variables
- Verify variable names match exactly

### Build Failures

**Error**: Build fails on Vercel

**Solution**:
- Check `package.json` includes all dependencies
- Verify Node.js version (18+) in Vercel settings
- Check build logs in Vercel Dashboard

## Local Development

For local development with the same structure:

1. **Frontend** (runs on port 3000):
   ```bash
   npm run dev
   ```

2. **Backend** (runs on port 3001):
   ```bash
   cd server
   npm run dev
   ```

The frontend proxy in `vite.config.js` routes `/api/*` to `http://localhost:3001`.

## Production Checklist

- [ ] All environment variables configured in Vercel
- [ ] Build succeeds locally (`npm run build`)
- [ ] Frontend accessible at Vercel URL
- [ ] API endpoints working (`/api/health` returns 200)
- [ ] OpenAI API key valid and has credits
- [ ] Supabase connection working
- [ ] Profile accessible from all tabs
- [ ] XP and streak display correctly
- [ ] All features tested in production

## Support

For issues:
1. Check Vercel function logs
2. Check browser console for frontend errors
3. Verify environment variables
4. Review `vercel.json` configuration

## Next Steps

After deployment:
- Set up custom domain (optional)
- Configure analytics (optional)
- Set up monitoring (optional)
- Review and optimize function performance
