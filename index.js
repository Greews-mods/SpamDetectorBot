const { Client, GatewayIntentBits, Partials, PermissionFlagsBits } = require('discord.js');
const config = require('./config');
const SpamDetector = require('./spamDetector');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel],
});

const spamDetector = new SpamDetector();

client.once('ready', () => {
  console.log(`✅ Spam bot online as ${client.user.tag}`);
  console.log(`📋 Admin log channel ID: ${config.adminChannelId}`);
});

client.on('messageCreate', async (message) => {
  // Ignore bots and system messages
  if (message.author.bot || !message.guild) return;

  // Ignore admins / moderators
  const member = message.member;
  if (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  ) return;

  const isSpam = spamDetector.analyze(message);

  if (isSpam) {
    await handleSpammer(message);
  }
});

async function handleSpammer(triggerMessage) {
  const guild = triggerMessage.guild;
  const member = triggerMessage.member;
  const user = triggerMessage.author;

  if (!member) return;

  // Already muted? skip
  const muteRole = await getOrCreateMuteRole(guild);
  if (member.roles.cache.has(muteRole.id)) return;

  console.log(`🚨 Spam detected from ${user.tag} (${user.id})`);

  try {
    // 1. Apply mute role
    await member.roles.add(muteRole, 'Spam detection - auto mute 24h');

    // 2. Schedule unmute after 24h
    setTimeout(async () => {
      try {
        const freshMember = await guild.members.fetch(user.id).catch(() => null);
        if (freshMember) {
          await freshMember.roles.remove(muteRole, 'Auto unmute after 24h');
          console.log(`🔓 Auto-unmuted ${user.tag} after 24h`);
        }
      } catch (e) {
        console.error(`Failed to unmute ${user.tag}:`, e.message);
      }
    }, 24 * 60 * 60 * 1000);

    // 3. Delete messages from last 24h across all channels
    const deleted = await deleteRecentMessages(guild, user.id);

    // 4. Clear spam tracker for this user
    spamDetector.clearUser(user.id);

    // 5. Notify admin channel
    await notifyAdmins(guild, user, deleted);

  } catch (err) {
    console.error('Error handling spammer:', err);
  }
}

async function deleteRecentMessages(guild, userId) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let totalDeleted = 0;

  const channels = guild.channels.cache.filter(
    (ch) => ch.isTextBased() && ch.permissionsFor(guild.members.me).has(PermissionFlagsBits.ManageMessages)
  );

  for (const [, channel] of channels) {
    try {
      // Fetch up to 100 recent messages per channel
      const messages = await channel.messages.fetch({ limit: 100 });
      const toDelete = messages.filter(
        (m) => m.author.id === userId && m.createdTimestamp > cutoff
      );

      if (toDelete.size === 0) continue;

      // Discord bulk delete only works for messages < 14 days old
      if (toDelete.size === 1) {
        await toDelete.first().delete().catch(() => {});
        totalDeleted += 1;
      } else {
        const deleted = await channel.bulkDelete(toDelete, true).catch(() => null);
        totalDeleted += deleted ? deleted.size : 0;
      }
    } catch (e) {
      // Channel not accessible, skip
    }
  }

  return totalDeleted;
}

async function getOrCreateMuteRole(guild) {
  // Look for existing mute role by name
  let muteRole = guild.roles.cache.find(
    (r) => r.name.toLowerCase() === config.muteRoleName.toLowerCase()
  );

  if (!muteRole) {
    console.log(`Creating mute role "${config.muteRoleName}"...`);
    muteRole = await guild.roles.create({
      name: config.muteRoleName,
      color: 0x808080,
      reason: 'Auto-created by spam bot',
      permissions: [],
    });

    // Deny SEND_MESSAGES in every text channel
    for (const [, channel] of guild.channels.cache) {
      if (channel.isTextBased()) {
        await channel.permissionOverwrites.create(muteRole, {
          SendMessages: false,
          AddReactions: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
          SendMessagesInThreads: false,
        }).catch(() => {});
      }
    }
  }

  return muteRole;
}

async function notifyAdmins(guild, user, deletedCount) {
  const adminChannel = guild.channels.cache.get(config.adminChannelId);
  if (!adminChannel) {
    console.warn(`⚠️  Admin channel ${config.adminChannelId} not found!`);
    return;
  }

  const adminMention = config.adminRoleId ? `<@&${config.adminRoleId}>` : '@admin';

  await adminChannel.send(
    `${adminMention} Osoba <@${user.id}> byla ztlumena z podezření na spam. ` +
    `Zprávy za posledních 24 hodin byly smazány (${deletedCount} zpráv odstraněno). ` +
    `Ztlumení vyprší za 24 hodin.`
  );
}

client.login(config.token);
