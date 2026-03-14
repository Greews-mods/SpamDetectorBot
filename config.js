require('dotenv').config();

module.exports = {
  // ── Required ──────────────────────────────────────────────
  token: process.env.DISCORD_TOKEN,

  // Channel where admin notifications are sent (#hlášení-spamu)
  adminChannelId: '1482323156046970942',

  // Role to ping in admin notifications (optional, leave blank to just say @admin)
  adminRoleId: process.env.ADMIN_ROLE_ID || '',

  // Name of the mute role (created automatically if missing)
  muteRoleName: process.env.MUTE_ROLE_NAME || 'Muted',

  // ── Spam detection thresholds ─────────────────────────────
  spam: {
    // Time window in ms to track messages per user
    windowMs: parseInt(process.env.SPAM_WINDOW_MS) || 8000, // 8 seconds

    // How many messages in that window triggers rate-flood detection
    maxMessagesInWindow: parseInt(process.env.SPAM_MAX_MESSAGES) || 5,

    // How many similar messages in the window trigger duplicate-flood detection
    minDuplicatesForSpam: parseInt(process.env.SPAM_MIN_DUPLICATES) || 3,

    // Similarity score (0–1) to consider two messages "the same"
    // 1.0 = identical only, 0.7 = very similar (recommended)
    similarityThreshold: parseFloat(process.env.SPAM_SIMILARITY_THRESHOLD) || 0.75,

    // How many messages containing links in the window = link spam
    // (single link message is fine; this triggers on repeated link messages)
    maxLinksInWindow: parseInt(process.env.SPAM_MAX_LINKS) || 3,
  },
};