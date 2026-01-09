# LAIPath Backend Deployment Guide

Detailed guide for deploying the LAIPath Express.js backend server.

## Overview

The LAIPath backend is an Express.js server that provides:
- AI-powered syllabus generation
- Topic-scoped chat with AI mentor
- Learning evaluation
- Suggested questions generation
- LinkedIn draft generation

## Requirements

- Node.js 18+
- OpenAI API key
- Hosting platform account (Railway, Render, Heroku, or VPS)

## Quick Start

### 1. Prepare Server Directory

```bash
cd server
npm install
```

### 2. Set Environment Variables

Create `server/.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=production
PORT=3001
```

### 3. Test Locally

```bash
npm start
```

Verify server starts and `/api/health` returns `{ status: 'ok' }`

## Deployment Options

### Option 1: Railway (Recommended)

**Pros**: Easy setup, auto-deploys from Git, good free tier

1. Go to [railway.app](https://railway.app)
2. Sign up/login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your LAIPath repository
5. Railway auto-detects Node.js
6. Set root directory: `server`
7. Add environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `NODE_ENV`: `production`
8. Railway automatically:
   - Runs `npm install` in `server/` directory
   - Starts with `npm start`
   - Assigns a public URL

**Configuration:**
- **Build Command**: (auto-detected)
- **Start Command**: `npm start` (from server directory)
- **Root Directory**: `server`

### Option 2: Render

**Pros**: Free tier, easy setup, good documentation

1. Go to [render.com](https://render.com)
2. Sign up/login
3. New → Web Service
4. Connect GitHub repository
5. Configure:
   - **Name**: `laipath-backend`
   - **Environment**: Node
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Free (or paid for better performance)
6. Add environment variables:
   - `OPENAI_API_KEY`
   - `NODE_ENV=production`
7. Deploy

**Note**: Free tier spins down after inactivity. First request may be slow.

### Option 3: Heroku

**Pros**: Mature platform, good documentation

1. Install Heroku CLI: `npm install -g heroku-cli`
2. Login: `heroku login`
3. Create app: `heroku create laipath-backend`
4. Set environment variables:
   ```bash
   heroku config:set OPENAI_API_KEY=your_key
   heroku config:set NODE_ENV=production
   ```
5. Deploy:
   ```bash
   cd server
   git subtree push --prefix . heroku main
   ```
   Or use Heroku Git:
   ```bash
   heroku git:remote -a laipath-backend
   git push heroku main
   ```

**Note**: Heroku free tier discontinued. Requires paid plan.

### Option 4: DigitalOcean App Platform

**Pros**: Simple, scalable, good pricing

1. Go to [digitalocean.com](https://digitalocean.com)
2. Create App → GitHub
3. Select repository
4. Configure:
   - **Type**: Web Service
   - **Source Directory**: `server`
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`
5. Add environment variables
6. Deploy

### Option 5: VPS (Ubuntu/Debian)

**Pros**: Full control, cost-effective for high traffic

1. Set up Ubuntu server (DigitalOcean, AWS EC2, etc.)
2. Install Node.js 18+:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. Install PM2:
   ```bash
   sudo npm install -g pm2
   ```
4. Clone repository:
   ```bash
   git clone https://github.com/yourusername/LAIPath.git
   cd LAIPath/server
   ```
5. Install dependencies:
   ```bash
   npm install --production
   ```
6. Create `.env`:
   ```bash
   nano .env
   # Add: OPENAI_API_KEY, NODE_ENV, PORT
   ```
7. Start with PM2:
   ```bash
   pm2 start server.js --name laipath-backend
   pm2 save
   pm2 startup  # Follow instructions to enable auto-start
   ```
8. Configure firewall:
   ```bash
   sudo ufw allow 3001/tcp
   ```
9. (Optional) Set up nginx reverse proxy:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Environment Variables

### Required

- `OPENAI_API_KEY`: Your OpenAI API key (get from [platform.openai.com](https://platform.openai.com))

### Optional

- `NODE_ENV`: Set to `production` for production
- `PORT`: Server port (default: 3001, hosting platforms usually set this)

## Process Management

### PM2 (Recommended for VPS)

```bash
# Start
pm2 start server.js --name laipath-backend

# Stop
pm2 stop laipath-backend

# Restart
pm2 restart laipath-backend

# View logs
pm2 logs laipath-backend

# Monitor
pm2 monit

# Save process list
pm2 save

# Auto-start on reboot
pm2 startup
```

### systemd (Alternative for VPS)

Create `/etc/systemd/system/laipath-backend.service`:

```ini
[Unit]
Description=LAIPath Backend Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/LAIPath/server
Environment="NODE_ENV=production"
Environment="OPENAI_API_KEY=your_key"
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable laipath-backend
sudo systemctl start laipath-backend
```

## Health Check

The backend includes a health check endpoint:

```
GET /api/health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

Use this for:
- Monitoring
- Load balancer health checks
- Deployment verification

## CORS Configuration

The server is configured to allow requests from:
- Localhost (development)
- Vercel domains (production)

Update `server.js` if deploying to custom domain:

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'https://your-vercel-app.vercel.app',
  'https://your-custom-domain.com'
]
```

## Monitoring

### Logs

- **Railway**: View in dashboard
- **Render**: View in dashboard
- **Heroku**: `heroku logs --tail`
- **PM2**: `pm2 logs laipath-backend`
- **systemd**: `journalctl -u laipath-backend -f`

### Error Tracking

Consider adding:
- Sentry for error tracking
- LogRocket for session replay
- DataDog for APM

## Scaling

### Horizontal Scaling

- Use load balancer (nginx, AWS ALB)
- Deploy multiple instances
- Use Redis for shared state (if needed)

### Vertical Scaling

- Upgrade hosting plan
- Increase server resources

## Security

1. **Never commit `.env` files**
2. **Use environment variables** for all secrets
3. **Enable HTTPS** (automatic on most platforms)
4. **Set up firewall rules** (VPS)
5. **Regular updates**: Keep dependencies updated
6. **Rate limiting**: Consider adding rate limiting middleware

## Troubleshooting

### Server won't start

- Check `PORT` is set correctly
- Verify `OPENAI_API_KEY` is valid
- Check Node.js version (18+)
- Review logs for errors

### API calls fail

- Verify CORS settings
- Check firewall rules
- Verify environment variables
- Test health endpoint

### High memory usage

- Monitor with `pm2 monit` or hosting dashboard
- Consider upgrading plan
- Review code for memory leaks

### Slow responses

- Check OpenAI API status
- Monitor network latency
- Review token usage
- Consider caching

## Cost Optimization

1. **Use free tiers** when possible (Railway, Render)
2. **Monitor OpenAI API usage** (set up billing alerts)
3. **Optimize token limits** (already configured in `aiConfig.js`)
4. **Use appropriate hosting tier** for traffic

## Backup

- **Code**: Git repository (already backed up)
- **Environment variables**: Store securely (password manager, secrets manager)
- **Database**: If using Supabase, backups are automatic

## Updates

1. Pull latest code: `git pull`
2. Install dependencies: `npm install`
3. Restart server:
   - PM2: `pm2 restart laipath-backend`
   - systemd: `sudo systemctl restart laipath-backend`
   - Platform: Redeploy via dashboard

## Support

For issues:
1. Check server logs
2. Verify environment variables
3. Test health endpoint
4. Review this documentation

---

**Last Updated**: 2024
**Version**: 1.0.0
