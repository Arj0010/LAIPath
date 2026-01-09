# LAIPath - Adaptive Daily Learning System

An AI-powered learning platform that generates personalized daily learning syllabi, enforces daily learning discipline, and adapts the learning path based on user progress and behavior.

## 🎯 Overview

LAIPath helps learners complete self-directed goals by providing:
- **AI-Generated Learning Syllabi** - Break down any learning goal into structured daily topics
- **Mandatory Daily Input** - Enforce daily learning discipline with required reflections
- **Adaptive Learning Path** - Automatically adjust syllabus based on progress (completed/skipped/leave)
- **Topic-Specific AI Assistance** - Get expert help that stays focused on today's learning topic
- **Calendar Integration** - Visual calendar that mirrors and updates with your syllabus

## ✨ Features

### Core Features
- ✅ **Syllabus Generation** - AI-powered generation of daily learning plans
- ✅ **Daily Learning Pages** - Focused learning interface for each day
- ✅ **AI Expert Chat** - Topic-scoped AI mentor that only answers questions about today's topic
- ✅ **Suggested Questions** - AI-generated follow-up questions after mentor answers
- ✅ **Mandatory Daily Reflection** - Required input before progressing to next day
- ✅ **Adaptive Syllabus** - Automatically adjusts future days based on learning evaluation
- ✅ **Calendar View** - Visual calendar showing all learning days
- ✅ **Day State Management** - Complete, skip, or apply leave to days
- ✅ **LinkedIn Draft Generator** - Generate social media posts from completed days
- ✅ **Profile Management** - Accessible from any tab, view stats, edit profile
- ✅ **Gamification** - XP tracking, streak counter, level system with milestones
- ✅ **Theme Support** - Dark/light theme switching
- ✅ **Supabase Integration** - Optional cloud storage for syllabus persistence

### Safety Features
- ✅ **Domain Safety Gates** - Blocks unsafe learning topics
- ✅ **Scope Validation** - Embedding-based semantic validation for AI responses
- ✅ **Error Handling** - Graceful fallbacks and mock responses
- ✅ **Token Limits** - Cost control for AI API calls

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- (Optional) OpenAI API key for AI features
- (Optional) Supabase credentials for cloud storage

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/LAIPath.git
   cd LAIPath
   ```

2. **Install Frontend Dependencies**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Configure Environment Variables**

   Create `server/.env`:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   (Optional) Create `.env` in root for Supabase:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   > **Note**: The app works without API keys using mock data, but AI features will be limited.

### Running the Application

**Terminal 1 - Backend Server:**
```bash
cd server
npm run dev
```
Backend runs on `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
npm run dev
```
Frontend runs on `http://localhost:5173` (Vite default)

Open `http://localhost:5173` in your browser.

## 📖 Usage Guide

### Creating a Learning Plan

1. Enter your learning goal (e.g., "Master React.js")
2. Set hours per day (e.g., 1.5)
3. Set total days (e.g., 30)
4. Click "Generate Syllabus"
5. AI generates a structured daily learning plan

### Daily Learning Flow

1. **View Today's Topic** - See the day's topic and subtasks
2. **Ask AI Expert** - Click "Ask AI Expert" to chat about today's topic
3. **Get Suggestions** - After mentor answers, see suggested follow-up questions
4. **End Day** - Click "End Day" and submit a reflection (minimum 50 characters)
5. **Auto-Progress** - System evaluates your input and activates the next day

### Day Management

- **Complete Day**: Submit learning reflection → Day marked complete → Next day activated
- **Skip Day**: Skip current day → All future days shift forward by 1 day
- **Apply Leave**: Take N days off → All future days shift forward by N days

### Calendar View

- View all learning days in calendar format
- See dates, topics, and status for each day
- Calendar automatically updates when syllabus changes

## 🏗️ Project Structure

```
LAIPath/
├── api/                          # Vercel serverless functions
│   └── index.js                  # Serverless function entry point
├── src/                          # Frontend React application
│   ├── App.jsx                   # Main app component
│   ├── LandingPage.jsx           # Landing page with auth
│   ├── DailyLearningPage.jsx    # Daily learning interface
│   ├── CalendarView.jsx         # Calendar visualization
│   ├── ProfilePage.jsx          # User profile page
│   ├── contexts/                 # React contexts (Auth, Theme)
│   ├── lib/                      # Utilities (Supabase, storage)
│   ├── hooks/                    # Custom React hooks
│   └── utils/                    # Helper utilities
├── server/                       # Backend Express server
│   ├── server.js                # Main server with API endpoints
│   ├── aiConfig.js               # AI configuration and limits
│   └── package.json              # Backend dependencies
├── scripts/                      # Utility scripts
│   ├── demoCheck.js              # Demo mode checker
│   └── e2eTest.js                # End-to-end tests
├── dist/                         # Build output (generated)
├── package.json                  # Root dependencies (includes backend)
├── vercel.json                   # Vercel configuration
└── vite.config.js               # Vite configuration
```

## 🔌 API Endpoints

### Backend API (Port 3001)

- `POST /api/generate-syllabus` - Generate learning syllabus
- `POST /api/topic-chat` - Chat with topic-specific AI mentor
- `POST /api/generate-suggested-questions` - Generate follow-up questions
- `POST /api/evaluate-learning` - Evaluate learning input
- `POST /api/regenerate-future-days` - Regenerate future days
- `POST /api/update-syllabus` - Update syllabus state
- `POST /api/generate-linkedin-draft` - Generate LinkedIn post
- `GET /api/syllabus` - Get current syllabus
- `GET /api/health` - Health check

## 🛡️ Safety & Security

- **Domain Safety Gates** - Blocks unsafe learning topics (hacking, illegal activities, etc.)
- **Scope Validation** - Embedding-based semantic validation ensures AI only answers topic-relevant questions
- **Token Limits** - Strict limits on AI API calls for cost control
- **Error Handling** - Graceful fallbacks prevent crashes
- **Mock Responses** - Safe mock data when API keys are missing

See `SAFETY_AUDIT.md` for detailed safety documentation.

## 🧪 Testing

Run automated tests:
```bash
npm run test:e2e
```

Check demo mode:
```bash
npm run check:demo
```

See `TEST_CHECKLIST.md` and `E2E_TEST_RESULTS.md` for test results.

## 📚 Documentation

- `PRD.txt` - Product Requirements Document
- `SAFETY_AUDIT.md` - Safety and security audit
- `ENV_SETUP.md` - Environment setup guide
- `SUPABASE_SETUP.md` - Supabase configuration guide
- `TEST_CHECKLIST.md` - Testing checklist
- `E2E_TEST_RESULTS.md` - End-to-end test results

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Supabase** - Authentication and storage (optional)
- **CSS3** - Styling with custom themes

### Backend
- **Express.js** - REST API server
- **OpenAI API** - AI-powered features (GPT-4o-mini, text-embedding-3-small)
- **CORS** - Cross-origin resource sharing

## 🎨 Features in Detail

### AI-Powered Syllabus Generation
- Generates structured daily learning plans from any goal
- Creates topics, subtasks, and expert prompts for each day
- Adapts future days based on learning evaluation

### Topic-Scoped AI Mentor
- Only answers questions related to today's learning topic
- Uses embedding-based semantic validation
- Suggests follow-up questions after each answer
- Refuses off-topic questions gracefully

### Adaptive Learning Path
- Evaluates learning input quality
- Regenerates future days when needed (repeat/simplify actions)
- Handles day state transitions (complete/skip/leave)
- Automatically updates calendar

### Calendar System
- Visual calendar showing all learning days
- Auto-populates from syllabus
- Updates automatically when syllabus changes
- Shows dates, topics, and status

### Profile & Gamification
- **Profile Access** - Accessible from any tab via navigation
- **XP System** - Earn XP for completed days and streaks
- **Level System** - Level up based on XP (100 XP per level)
- **Streak Tracking** - Track consecutive learning days
- **Milestones** - Unlock milestones at levels 3, 5, 8, and 12
- **Profile Stats** - View XP, level, and streak in dropdown and profile page

## 🚀 Deployment

LAIPath can be deployed as a **full-stack application on Vercel** (recommended) or with separate frontend/backend hosting.

### Full-Stack Vercel Deployment (Recommended)

Deploy both frontend and backend together on Vercel using serverless functions:

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Deploy to Vercel**:
   ```bash
   npm i -g vercel
   vercel login
   vercel --prod
   ```

3. **Set environment variables** in Vercel Dashboard:
   - `OPENAI_API_KEY` (required)
   - `VITE_SUPABASE_URL` (optional)
   - `VITE_SUPABASE_ANON_KEY` (optional)

### Separate Deployment (Alternative)

- **Frontend**: Vercel (static hosting)
- **Backend**: Railway, Render, Heroku, or VPS

See [DEPLOYMENT_BACKEND.md](DEPLOYMENT_BACKEND.md) for backend-only deployment.

### Full Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete full-stack Vercel deployment guide
- **[DEPLOYMENT_BACKEND.md](DEPLOYMENT_BACKEND.md)** - Separate backend deployment details

### Environment Variables

**For Full-Stack Vercel Deployment:**
- `OPENAI_API_KEY` (required) - OpenAI API key for AI features
- `VITE_SUPABASE_URL` (optional) - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` (optional) - Supabase anonymous key
- `NODE_ENV=production` (optional) - Set to production

**For Separate Deployment:**
- **Frontend (Vercel)**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`
- **Backend (Hosting platform)**: `OPENAI_API_KEY`, `NODE_ENV=production`, `PORT`

## 🤝 Contributing

This is a solo MVP project. For questions or issues, please open an issue on GitHub.

## 📝 License

This project is part of a capstone/portfolio project.

## 🙏 Acknowledgments

- OpenAI for AI capabilities
- Supabase for backend services
- React and Vite communities

---

**Built with ❤️ for learners who want structured, adaptive learning paths**
