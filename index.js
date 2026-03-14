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
  console.log(`Spam bot online as ${client.user.tag}`);
  console.log(`Admin channel ID: ${config.adminChannelId}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

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

  const muteRole = await getOrCreateMuteRole(guild);
  if (member.roles.cache.has(muteRole.id)) return;

  console.log(`Spam detected from ${user.tag} (${user.id})`);

  try {
    // Mute immediately
    await member.roles.add(muteRole, 'Spam detection - auto mute 24h');
    spamDetector.clearUser(user.id);

    // DM the muted user
    await user.send(
      'Byl/a jsi ztlumen/a na 24h z důvodu podezření spamů a tvé zprávy za posledních 24h na tomto serveru byly automaticky smazány.'
    ).catch(() => {});

    // Notify admins
    await notifyAdmins(guild, user);

    // Delete messages in background (non-blocking)
    deleteRecentMessages(guild, user.id).catch(err =>
      console.error('Error deleting messages:', err.message)
    );

    // Schedule unmute after 24h
    setTimeout(async () => {
      try {
        const freshMember = await guild.members.fetch(user.id).catch(() => null);
        if (freshMember) {
          await freshMember.roles.remove(muteRole, 'Auto unmute after 24h');
          console.log(`Auto-unmuted ${user.tag} after 24h`);
        }
      } catch (e) {
        console.error(`Failed to unmute ${user.tag}:`, e.message);
      }
    }, 24 * 60 * 60 * 1000);

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
      const messages = await channel.messages.fetch({ limit: 100 });
      const toDelete = messages.filter(
        (m) => m.author.id === userId && m.createdTimestamp > cutoff
      );

      if (toDelete.size === 0) continue;

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

async function notifyAdmins(guild, user) {
  const adminChannel = await client.channels.fetch(config.adminChannelId).catch(() => null);
  if (!adminChannel) {
    console.warn(`Admin channel ${config.adminChannelId} not found!`);
    return;
  }

  const adminMention = config.adminRoleId ? `<@&${config.adminRoleId}>` : '@admin';

  await adminChannel.send(
    `${adminMention} Osoba <@${user.id}> byla ztlumena z podezření na spam. ` +
    `Zprávy za posledních 24 hodin byly smazány. ` +
    `Ztlumení vyprší za 24 hodin.`
  ).catch(err => console.error('Failed to send admin notification:', err.message));
}

client.login(config.token);