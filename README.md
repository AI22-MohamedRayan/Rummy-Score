# 🃏 Rummy Score Tracker

A full-featured score tracking web application for Rummy — built with vanilla HTML, CSS, and JavaScript. No build tools needed.

## 🚀 Live Demo
Deploy to GitHub Pages and share the URL with friends!

## ✨ Features

### Game Modes

**Normal Game**
- Set player count (2–10) and player names
- Define maximum points threshold
- Players are eliminated when they cross the limit
- Last player standing wins
- Unlimited rounds

**Best of 7**
- Exactly 7 rounds
- Round 1 & Round 7 scores are **doubled**
- No elimination — lowest total score wins
- Optional **Team Mode**: pair players into teams, see team totals alongside individual scores

### App Flow
| Screen | Description |
|--------|-------------|
| 🏠 Home | Choose Host / View / Continue |
| 🎮 Host Match | Pick mode, configure players, start game |
| 📊 View Match | Enter a code or pick from recent matches |
| 🔄 Continue Match | Resume any in-progress match via 4-digit code |

### Score Tracking
- Live bar chart updating after every round
- Sorted leaderboard (ascending — lowest score is best)
- Round-by-round breakdown with doubling indicators
- Elimination badges in Normal mode

### Saving Results
- **Save as PDF** — formatted results sheet
- **Screenshot** — full-screen capture of results

## 🗂 File Structure
```
rummy-tracker/
├── index.html          # App shell + all screens
├── style.css           # Full dark theme UI
├── app.js              # Game logic + state management
├── .github/
│   └── workflows/
│       └── deploy.yml  # GitHub Pages auto-deploy
└── README.md
```

## 🛠 Deploy to GitHub Pages

1. Create a new GitHub repo
2. Push these files to the `main` branch
3. Go to **Settings → Pages → Source** → select **GitHub Actions**
4. The workflow will auto-deploy on every push
5. Access at `https://<your-username>.github.io/<repo-name>/`

## 💾 Data Storage
Match data is stored in **localStorage** — no server needed. The 4-digit match code lets you:
- Resume a match on the same device
- Share with others viewing on the same device

## 🎨 Tech Stack
- Vanilla HTML / CSS / JavaScript
- [Chart.js 4.4](https://www.chartjs.org/) — score visualization
- [html2canvas](https://html2canvas.hertzen.com/) — screenshot export
- [jsPDF](https://github.com/parallax/jsPDF) — PDF export
- Google Fonts: Syne + DM Sans
