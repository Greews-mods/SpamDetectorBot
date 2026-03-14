const config = require('./config');

function diceSimilarity(a, b) {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;

  const getBigrams = (str) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2).toLowerCase());
    }
    return bigrams;
  };

  const aGrams = getBigrams(a);
  const bGrams = getBigrams(b);

  let intersection = 0;
  for (const gram of aGrams) {
    if (bGrams.has(gram)) intersection++;
  }

  return (2.0 * intersection) / (aGrams.size + bGrams.size);
}

function normalizeContent(content) {
  return content
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '[URL]')
    .replace(/\s+/g, ' ')
    .trim();
}

function countLinks(content) {
  const urlRegex = /https?:\/\/\S+/gi;
  const matches = content.match(urlRegex);
  return matches ? matches.length : 0;
}

function isPureLink(content) {
  // Message is only a URL with no other text
  return /^\s*https?:\/\/\S+\s*$/.test(content);
}

class SpamDetector {
  constructor() {
    this.userMessages = new Map();
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  analyze(message) {
    const userId = message.author.id;
    const content = message.content || '';
    const now = Date.now();

    const record = {
      content,
      normalized: normalizeContent(content),
      links: countLinks(content),
      isPureLink: isPureLink(content),
      timestamp: now,
    };

    if (!this.userMessages.has(userId)) {
      this.userMessages.set(userId, []);
    }

    const history = this.userMessages.get(userId);
    history.push(record);

    const windowMs = config.spam.windowMs;
    const recent = history.filter((r) => now - r.timestamp <= windowMs);
    this.userMessages.set(userId, recent);

    // Rule 1: Rate flood — too many messages regardless of content
    if (recent.length >= config.spam.maxMessagesInWindow) {
      console.log(`[SpamDetector] Rate flood: ${message.author.tag} (${recent.length} msgs in window)`);
      return true;
    }

    // Rule 2: Pure link spam — sending links repeatedly (2+ is enough)
    const recentPureLinks = recent.filter((r) => r.isPureLink);
    if (recentPureLinks.length >= config.spam.maxLinksInWindow) {
      console.log(`[SpamDetector] Pure link spam: ${message.author.tag} (${recentPureLinks.length} pure link msgs)`);
      return true;
    }

    // Rule 3: Any messages with links repeated (not just pure links)
    const recentWithLinks = recent.filter((r) => r.links > 0);
    if (recentWithLinks.length >= config.spam.maxLinksInWindow + 1) {
      console.log(`[SpamDetector] Link spam: ${message.author.tag} (${recentWithLinks.length} link msgs)`);
      return true;
    }

    // Rule 4: Duplicate / near-duplicate flood
    if (recent.length >= config.spam.minDuplicatesForSpam) {
      const similarities = [];
      for (let i = 0; i < recent.length - 1; i++) {
        const sim = diceSimilarity(recent[i].normalized, record.normalized);
        similarities.push(sim);
      }
      const highSimilarityCount = similarities.filter(
        (s) => s >= config.spam.similarityThreshold
      ).length;

      if (highSimilarityCount >= config.spam.minDuplicatesForSpam - 1) {
        console.log(`[SpamDetector] Duplicate flood: ${message.author.tag} (${highSimilarityCount} similar msgs)`);
        return true;
      }
    }

    return false;
  }

  clearUser(userId) {
    this.userMessages.delete(userId);
  }

  cleanup() {
    const now = Date.now();
    const windowMs = config.spam.windowMs;
    for (const [userId, messages] of this.userMessages) {
      const fresh = messages.filter((m) => now - m.timestamp <= windowMs);
      if (fresh.length === 0) {
        this.userMessages.delete(userId);
      } else {
        this.userMessages.set(userId, fresh);
      }
    }
  }
}

module.exports = SpamDetector;