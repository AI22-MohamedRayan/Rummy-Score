# 🃏 Rummy Score Tracker — Full Stack

**Frontend:** HTML / CSS / JS → GitHub Pages  
**Backend:** Node.js + Express → Render (free tier)  
**Database:** MongoDB Atlas (free tier)

## 📁 Project Structure

frontend/   ← Deploy to GitHub Pages
backend/    ← Deploy to Render

## Step 1 — MongoDB Atlas

1. Create free account at mongodb.com/cloud/atlas
2. Create free M0 cluster
3. Database Access → add user with password
4. Network Access → Allow from Anywhere (0.0.0.0/0)
5. Connect → copy connection string:
   mongodb+srv://user:pass@cluster.mongodb.net/rummy-tracker?retryWrites=true&w=majority

## Step 2 — Deploy Backend to Render

1. Push backend/ to GitHub
2. Render → New Web Service → connect repo
3. Root Directory: backend | Build: npm install | Start: npm start
4. Environment variables:
   MONGO_URI = your atlas string
   ALLOWED_ORIGIN = https://yourusername.github.io
5. Copy your Render URL: https://rummy-tracker-api.onrender.com

## Step 3 — Deploy Frontend to GitHub Pages

1. In frontend/index.html update:
   window.RUMMY_API_BASE = 'https://rummy-tracker-api.onrender.com/api';
2. Push frontend/ contents to GitHub repo root
3. Settings → Pages → Deploy from branch → main / root

Live at: https://yourusername.github.io/repo-name/

## API Endpoints

POST   /api/matches              Create match
GET    /api/matches/:code        Get match
POST   /api/matches/:code/rounds Add round
PATCH  /api/matches/:code/finish Finish match
GET    /api/matches/:code/view   Live read-only view
GET    /health                   Health check
