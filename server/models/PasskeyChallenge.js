const mongoose = require("mongoose");

const passkeyChallengeSchema = new mongoose.Schema({
  challenge: {
    type: String,
    required: true,
    unique: true,
  },
  purpose: {
    type: String,
    enum: ["registration", "authentication"],
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model("PasskeyChallenge", passkeyChallengeSchema);
