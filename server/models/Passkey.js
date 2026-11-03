const mongoose = require("mongoose");

const passkeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  credentialId: {
    type: String,
    required: true,
    unique: true,
  },
  publicKey: {
    type: Buffer,
    required: true,
  },
  counter: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  transports: {
    type: [String],
    default: [],
  },
  deviceName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  lastUsedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model("Passkey", passkeySchema);
