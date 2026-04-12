const express = require('express');
const router  = express.Router();
const Match   = require('../models/Match');

/* ── helper: generate unique 4-digit code ── */
async function generateCode() {
  let code, exists;
  do {
    code   = String(Math.floor(1000 + Math.random() * 9000));
    exists = await Match.exists({ code });
  } while (exists);
  return code;
}

/* ────────────────────────────────────────────
   POST /api/matches
   Create a new match, returns the saved match
──────────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const { mode, players, maxPoints, teams } = req.body;

    if (!mode || !players || players.length < 2) {
      return res.status(400).json({ error: 'mode and at least 2 players are required' });
    }

    const code = await generateCode();

    const match = await Match.create({
      code,
      mode,
      players,
      maxPoints: maxPoints || null,
      teams:     teams    || null,
      rounds:    [],
      eliminated: [],
      finished:  false
    });

    res.status(201).json(match);
  } catch (err) {
    console.error('POST /matches:', err);
    res.status(500).json({ error: 'Failed to create match' });
  }
});

/* ────────────────────────────────────────────
   GET /api/matches/:code
   Fetch a match by its 4-digit code
──────────────────────────────────────────── */
router.get('/:code', async (req, res) => {
  try {
    const match = await Match.findOne({ code: req.params.code });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (err) {
    console.error('GET /matches/:code:', err);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

/* ────────────────────────────────────────────
   POST /api/matches/:code/rounds
   Append a new round's scores
   Body: { scores: { "0": 10, "1": 25, ... } }
──────────────────────────────────────────── */
router.post('/:code/rounds', async (req, res) => {
  try {
    const match = await Match.findOne({ code: req.params.code });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.finished) return res.status(400).json({ error: 'Match is already finished' });

    const { scores, eliminated, finished, winner } = req.body;
    if (!scores) return res.status(400).json({ error: 'scores object is required' });

    match.rounds.push(scores);

    if (eliminated && Array.isArray(eliminated)) {
      match.eliminated = eliminated;
    }
    if (finished) {
      match.finished = true;
      match.winner   = winner || null;
    }

    await match.save();
    res.json(match);
  } catch (err) {
    console.error('POST /matches/:code/rounds:', err);
    res.status(500).json({ error: 'Failed to save round' });
  }
});

/* ────────────────────────────────────────────
   PATCH /api/matches/:code/finish
   Mark a match as finished, set winner
──────────────────────────────────────────── */
router.patch('/:code/finish', async (req, res) => {
  try {
    const match = await Match.findOne({ code: req.params.code });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    match.finished = true;
    match.winner   = req.body.winner || null;
    await match.save();

    res.json(match);
  } catch (err) {
    console.error('PATCH /matches/:code/finish:', err);
    res.status(500).json({ error: 'Failed to finish match' });
  }
});

/* ────────────────────────────────────────────
   GET /api/matches/:code/view
   Read-only live view (same as GET but explicit intent)
──────────────────────────────────────────── */
router.get('/:code/view', async (req, res) => {
  try {
    const match = await Match.findOne({ code: req.params.code })
      .select('-__v');
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

module.exports = router;
