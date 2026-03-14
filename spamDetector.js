/**
 * SpamDetector – heuristic, multi-signal spam detection
 *
 * Signals checked:
 *  1. Message frequency  – too many messages in a short window
 *  2. Duplicate content  – same text repeated N times
 *  3. Mass-mention       – pinging many users / roles / @everyone
 *  4. Link flood         – many URLs in one or consecutive messages
 *  5. Character flood    – very long wall-of-text / repeated chars
 *  6. Discord invite     – repeated posting of invite links
 */

const config = require('./config.js');

class SpamDetector {
  constructor() {
    // Map<userId, { messages: [{content, timestamp}], warned: bool }>
    this.userHistory = new Map();

    // Purge old records every 10 minutes
    setInterval(() => this._purgeOld(), 10 * 60 * 1000);
  }

  /**
   * Analyse a single Discord message.
   * Returns true if spam is detected.
   */
  analyze(message) {
    const userId = message.author.id;
    const content = message.content || '';
    const now = Date.now();

    // Initialise history for this user
    if (!this.userHistory.has(userId)) {
      this.userHistory.set(userId, { messages: [] });
    }

    const record = this.userHistory.get(userId);

    // Store message
    record.messages.push({ content, timestamp: now });

    // Only keep messages within the detection window
    const windowMs = (config.spam.windowSeconds || 10) * 1000;
    record.messages = record.messages.filter((m) => now - m.timestamp <= windowMs);

    // ── Run checks ──────────────────────────────────────────────────────────
    if (this._checkFrequency(record)) return true;
    if (this._checkDuplicates(record)) return true;
    if (this._checkMassMention(message)) return true;
    if (this._checkLinkFlood(record)) return true;
    if (this._checkCharFlood(content)) return true;
    if (this._checkInviteFlood(record)) return true;

    return false;
  }

  // ── Individual checks ──────────────────────────────────────────────────────

  /** Too many messages in the sliding window */
  _checkFrequency(record) {
    const limit = config.spam.maxMessagesPerWindow || 7;
    return record.messages.length >= limit;
  }

  /** Same (or very similar) message repeated */
  _checkDuplicates(record) {
    const limit = config.spam.maxDuplicates || 4;
    const latest = record.messages[record.messages.length - 1].content.toLowerCase().trim();
    if (!latest) return false;

    const count = record.messages.filter(
      (m) => m.content.toLowerCase().trim() === latest
    ).length;
    return count >= limit;
  }

  /** Mentions @everyone / @here or many individual users */
  _checkMassMention(message) {
    if (message.mentions.everyone) return true;
    const limit = config.spam.maxMentions || 5;
    return message.mentions.users.size + message.mentions.roles.size >= limit;
  }

  /** Multiple URLs across recent messages */
  _checkLinkFlood(record) {
    const urlRegex = /https?:\/\/\S+/gi;
    const limit = config.spam.maxLinksPerWindow || 5;
    let linkCount = 0;
    for (const m of record.messages) {
      const matches = m.content.match(urlRegex);
      if (matches) linkCount += matches.length;
    }
    return linkCount >= limit;
  }

  /** Very long message or sequences of repeated characters */
  _checkCharFlood(content) {
    if (content.length > (config.spam.maxMessageLength || 1000)) return true;
    // Detect 20+ identical consecutive characters (e.g. "aaaaaaaaaaaaaaaaaaaaa")
    if (/(.)\1{19,}/.test(content)) return true;
    return false;
  }

  /** Repeated Discord invite links */
  _checkInviteFlood(record) {
    const inviteRegex = /discord(?:\.gg|app\.com\/invite)\/\S+/gi;
    const limit = config.spam.maxInvitesPerWindow || 3;
    let count = 0;
    for (const m of record.messages) {
      if (inviteRegex.test(m.content)) count++;
      inviteRegex.lastIndex = 0; // reset regex state
    }
    return count >= limit;
  }

  // ── Housekeeping ────────────────────────────────────────────────────────────

  _purgeOld() {
    const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
    for (const [userId, record] of this.userHistory) {
      record.messages = record.messages.filter((m) => m.timestamp >= cutoff);
      if (record.messages.length === 0) this.userHistory.delete(userId);
    }
  }
}

module.exports = SpamDetector;
