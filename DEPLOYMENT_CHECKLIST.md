# Deployment Checklist

Use this checklist to ensure a smooth deployment.

## Pre-Deployment

- [x] Build completes successfully (`npm run build`)
- [x] All environment variables documented
- [x] No hardcoded localhost URLs
- [x] Health check endpoint working
- [x] CORS configured correctly
- [x] Error handling in place
- [x] Timeout handling implemented

## Frontend (Vercel)

- [ ] Repository pushed to GitHub
- [ ] Vercel project created
- [ ] Build command set: `npm run build`
- [ ] Output directory set: `dist`
- [ ] Environment variables configured:
  - [ ] `VITE_SUPABASE_URL` (if using Supabase)
  - [ ] `VITE_SUPABASE_ANON_KEY` (if using Supabase)
  - [ ] `VITE_API_URL` (optional, for direct API calls)
- [ ] `vercel.json` updated with backend URL
- [ ] First deployment successful
- [ ] Site loads at Vercel URL

## Backend

- [ ] Backend hosting platform selected
- [ ] Repository connected
- [ ] Build/start commands configured
- [ ] Environment variables set:
  - [ ] `OPENAI_API_KEY`
  - [ ] `NODE_ENV=production`
  - [ ] `PORT` (if needed)
- [ ] Backend deployed and accessible
- [ ] Health check endpoint working: `/api/health`
- [ ] CORS allows Vercel domain

## Integration Testing

- [ ] Frontend can reach backend API
- [ ] Syllabus generation works
- [ ] AI chat works
- [ ] Evaluation flow works
- [ ] Suggested questions appear
- [ ] Day completion works
- [ ] Calendar updates correctly

## Post-Deployment

- [ ] Monitor logs for errors
- [ ] Test on mobile devices
- [ ] Verify HTTPS is enabled
- [ ] Check API response times
- [ ] Monitor OpenAI API usage
- [ ] Set up error tracking (optional)
- [ ] Document production URLs

## Rollback Plan

- [ ] Know how to rollback Vercel deployment
- [ ] Know how to rollback backend deployment
- [ ] Have previous working version tagged in Git

## Security

- [ ] No secrets in code
- [ ] Environment variables secured
- [ ] CORS properly configured
- [ ] HTTPS enabled
- [ ] API keys rotated if needed

## Monitoring

- [ ] Logs accessible
- [ ] Error tracking set up (optional)
- [ ] Performance monitoring (optional)
- [ ] Uptime monitoring (optional)

---

**Status**: Ready for deployment
**Last Updated**: 2024
