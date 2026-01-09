# Google OAuth Setup for LAIPath

This guide explains how to configure Google OAuth credentials in Google Cloud Console for use with Supabase authentication.

## Why Google Cloud Console?

LAIPath uses **Supabase** for authentication, which supports Google OAuth. To enable Google login, you need to:
1. Create OAuth credentials in **Google Cloud Console**
2. Configure those credentials in **Supabase Dashboard**

## Step-by-Step Guide

### Step 1: Create OAuth Credentials in Google Cloud Console

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select a Project**
   - Click the project dropdown at the top
   - Click "New Project" (or select an existing one)
   - Name it: `LAIPath` (or any name you prefer)
   - Click "Create"

3. **Enable Google+ API**
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable" (if not already enabled)

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - If prompted, configure the OAuth consent screen first:
     - User Type: **External** (unless you have a Google Workspace)
     - App name: `LAIPath`
     - User support email: Your email
     - Developer contact: Your email
     - Click "Save and Continue"
     - Scopes: Click "Save and Continue" (default scopes are fine)
     - Test users: Add your email, click "Save and Continue"
     - Click "Back to Dashboard"

5. **Create OAuth Client ID**
   - Application type: **Web application**
   - Name: `LAIPath Web Client`
   - Authorized JavaScript origins:
     ```
     http://localhost:5173
     http://localhost:3000
     https://your-vercel-app.vercel.app
     https://your-project-ref.supabase.co
     ```
   - Authorized redirect URIs:
     ```
     https://your-project-ref.supabase.co/auth/v1/callback
     ```
     **Important**: Replace `your-project-ref` with your actual Supabase project reference
   - Click "Create"

6. **Copy Your Credentials**
   - You'll see a popup with:
     - **Client ID** (looks like: `123456789-abcdefg.apps.googleusercontent.com`)
     - **Client Secret** (looks like: `GOCSPX-abcdefghijklmnop`)
   - **Save these** - you'll need them for Supabase

### Step 2: Configure in Supabase Dashboard

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your LAIPath project

2. **Enable Google Provider**
   - Go to "Authentication" → "Providers"
   - Find "Google" in the list
   - Toggle it to **Enabled**

3. **Add OAuth Credentials**
   - **Client ID (for OAuth)**: Paste your Google Client ID
   - **Client Secret (for OAuth)**: Paste your Google Client Secret
   - Click "Save"

4. **Get Your Supabase Project Reference**
   - Go to "Settings" → "API"
   - Your project URL looks like: `https://abcdefghijklmnop.supabase.co`
   - The project reference is: `abcdefghijklmnop`
   - Use this in the redirect URI in Google Cloud Console

### Step 3: Update Redirect URI in Google Cloud Console

After getting your Supabase project reference:

1. Go back to Google Cloud Console
2. Go to "APIs & Services" → "Credentials"
3. Click on your OAuth 2.0 Client ID
4. Under "Authorized redirect URIs", add:
   ```
   https://YOUR-SUPABASE-REF.supabase.co/auth/v1/callback
   ```
5. Click "Save"

### Step 4: Test Google OAuth

1. **Deploy your app** (if not already deployed)
2. **Visit your deployed app**
3. **Click "Continue with Google"** on the landing page
4. **Complete the OAuth flow**
5. You should be redirected back and logged in

## Important Notes

### For Production Deployment

When deploying to Vercel, make sure to add these to your **Authorized JavaScript origins** in Google Cloud Console:

```
https://your-app-name.vercel.app
https://your-custom-domain.com (if using custom domain)
```

### For Local Development

For local development, add:
```
http://localhost:5173
http://localhost:3000
```

### Security Best Practices

1. **Never commit** OAuth credentials to Git
2. **Use environment variables** in Supabase (already configured)
3. **Restrict redirect URIs** to only your domains
4. **Use HTTPS** in production (Vercel provides this automatically)

## Troubleshooting

### "Redirect URI mismatch" Error

- **Problem**: The redirect URI in Google Cloud Console doesn't match Supabase
- **Solution**: 
  1. Check your Supabase project reference
  2. Ensure redirect URI is exactly: `https://YOUR-REF.supabase.co/auth/v1/callback`
  3. Wait a few minutes after updating (Google caches changes)

### "OAuth client not found" Error

- **Problem**: Client ID is incorrect
- **Solution**: Double-check the Client ID in Supabase matches Google Cloud Console

### OAuth Works Locally But Not in Production

- **Problem**: Production domain not in authorized origins
- **Solution**: Add your Vercel domain to "Authorized JavaScript origins" in Google Cloud Console

## What You DON'T Need to Configure

- ❌ **Google Cloud Storage** - Not used
- ❌ **Google Cloud Functions** - Not used
- ❌ **Firebase** - Not used
- ❌ **Google Cloud SQL** - Not used (Supabase uses PostgreSQL)

## Summary

**You only need Google Cloud Console for:**
- ✅ Creating OAuth 2.0 credentials (Client ID & Secret)
- ✅ Configuring authorized redirect URIs

**Everything else is handled by:**
- **Vercel** - Hosting and deployment
- **Supabase** - Authentication, database, storage
- **OpenAI** - AI features

---

**Quick Checklist:**
- [ ] Created Google Cloud project
- [ ] Enabled Google+ API
- [ ] Created OAuth 2.0 Client ID
- [ ] Added redirect URI: `https://YOUR-REF.supabase.co/auth/v1/callback`
- [ ] Added authorized origins (localhost + Vercel domain)
- [ ] Copied Client ID and Secret
- [ ] Configured in Supabase Dashboard
- [ ] Tested Google login

---

**Last Updated**: January 2026
