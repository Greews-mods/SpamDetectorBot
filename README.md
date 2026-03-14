# Discord Spam Detection Bot

Automatically detects spammers, mutes them for 24 hours, deletes their messages from the last 24 hours, and notifies admins in a specified channel.

## How it works

The bot monitors all messages and flags a user as a spammer if any of these conditions are met within an 8 second window:

- 5 or more messages sent (rate flood)
- 3 or more messages that are identical or very similar (duplicate flood)
- 2 or more messages that are only a link (pure link spam)

A single link message on its own is never flagged.

When spam is detected the bot will apply the Muted role to the user (creating it automatically if it does not exist), delete all their messages from the last 24 hours across all channels, and post a notification to the admin channel. The mute is automatically removed after 24 hours.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Discord Developer Portal

Go to https://discord.com/developers/applications and open your app.

Under the Bot tab, enable all three Privileged Gateway Intents:
- Presence Intent
- Server Members Intent
- Message Content Intent

### 3. Invite the bot

Use the OAuth2 URL Generator with the bot scope and these permissions:
- Manage Roles
- Manage Messages
- Read Message History
- Send Messages
- View Channels

Open the generated URL in your browser and invite the bot to your server.

### 4. Role order

In your server's role settings, drag the bot's role above the Muted role. Without this the bot cannot assign the Muted role to anyone.

### 5. Environment variable

The only variable required is DISCORD_TOKEN. Set this in Railway's Variables tab. Everything else is hardcoded in config.js.

### 6. Run

```bash
npm start
```

Or deploy via Railway by pushing to GitHub.

## Configuration

All settings are in config.js. The admin notification channel and admin role are hardcoded there. Spam detection thresholds can also be adjusted in that file.

| Setting | Default | Description |
|---|---|---|
| windowMs | 8000 | Tracking window in milliseconds |
| maxMessagesInWindow | 5 | Messages in window before rate flood triggers |
| minDuplicatesForSpam | 3 | Similar messages before duplicate flood triggers |
| similarityThreshold | 0.75 | How similar two messages need to be (0-1) |
| maxLinksInWindow | 2 | Pure link messages before link spam triggers |