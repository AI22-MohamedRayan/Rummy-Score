const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  id:    { type: Number, required: true },
  name:  { type: String, required: true },
  color: { type: String, required: true }
}, { _id: false });

const TeamSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  players: [{ type: Number }]
}, { _id: false });

const MatchSchema = new mongoose.Schema({
  code:       { type: String, required: true, unique: true, index: true },
  mode:       { type: String, enum: ['normal', 'best7'], required: true },
  players:    [PlayerSchema],
  rounds:     [{ type: mongoose.Schema.Types.Mixed }],   // array of {playerId: score} objects
  eliminated: [{ type: Number }],
  teams:      [TeamSchema],
  maxPoints:  { type: Number, default: null },
  finished:   { type: Boolean, default: false },
  winner:     { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now }
});

// Auto-update updatedAt on save
MatchSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Match', MatchSchema);
