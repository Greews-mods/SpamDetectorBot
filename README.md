# 🛡️ Discord Spam Detection Bot

Automaticky detekuje spam, ztlumí účet na 24h, smaže zprávy za posledních 24h a informuje adminy.

---

## 📁 Struktura souborů

```
discord-spam-bot/
├── bot.js            ← hlavní logika bota
├── spamDetector.js   ← detekce spamu (pravidla)
├── config.js         ← nastavení (token, pravidla, admin kanál)
├── package.json
└── README.md
```

---

## 🚀 Instalace a spuštění

### 1. Nainstaluj závislosti
```bash
npm install
```

### 2. Vytvoř bota na Discord Developer Portal

1. Jdi na https://discord.com/developers/applications
2. Klikni **New Application** → pojmenuj ho
3. Vlevo **Bot** → klikni **Add Bot**
4. Zkopíruj **Token** (použiješ v kroku 3)
5. Povol tyto **Privileged Gateway Intents**:
   - ✅ `SERVER MEMBERS INTENT`
   - ✅ `MESSAGE CONTENT INTENT`

### 3. Nastav token

**Varianta A – environment variable (doporučeno):**
```bash
# Linux / Mac
export DISCORD_TOKEN=tvůj_token_zde
node bot.js

# Windows (PowerShell)
$env:DISCORD_TOKEN="tvůj_token_zde"
node bot.js
```

**Varianta B – přímo v config.js:**
```js
token: 'tvůj_token_zde',
```

### 4. Pozvi bota na server

Vygeneruj OAuth2 URL na Developer Portal:
- Scopes: `bot`
- Bot Permissions:
  - ✅ Read Messages / View Channels
  - ✅ Send Messages
  - ✅ Manage Messages  ← nutné pro mazání
  - ✅ Moderate Members ← nutné pro timeout/mute

### 5. Spusť bota
```bash
npm start
# nebo pro development s auto-restartem:
npm run dev
```

---

## ⚙️ Konfigurace (config.js)

| Parametr | Výchozí | Popis |
|---|---|---|
| `adminChannelName` | `admin-log` | Název kanálu pro admin notifikace |
| `windowSeconds` | `10` | Časové okno pro počítání zpráv (s) |
| `maxMessagesPerWindow` | `7` | Max zpráv v okně |
| `maxDuplicates` | `4` | Max stejných zpráv |
| `maxMentions` | `5` | Max @zmínek v jedné zprávě |
| `maxLinksPerWindow` | `5` | Max odkazů v okně |
| `maxInvitesPerWindow` | `3` | Max Discord pozvánek v okně |
| `maxMessageLength` | `1000` | Max délka jedné zprávy |

---

## 🔍 Co bot detekuje

| Typ spamu | Pravidlo |
|---|---|
| **Zprávy záplavou** | 7+ zpráv za 10 sekund |
| **Opakující se obsah** | 4× stejná zpráva |
| **Mass-mention** | @everyone / @here nebo 5+ zmínek |
| **Odkaz flood** | 5+ URL v okně |
| **Invite flood** | 3+ Discord pozvánek |
| **Stěna textu** | zpráva >1000 znaků nebo 20+ stejných znaků za sebou |

---

## 📨 Vzor admin notifikace

Bot pošle embed zprávu do admin kanálu:

> 🚨 **Spam detekován – automatická akce**
> Osoba @uživatel nejspíše spamovala, proběhlo ztlumení a smazání zpráv za posledních 24h.
>
> 👤 Uživatel: [user#1234](https://discord.com/users/ID)
> ⏱️ Ztlumení: 24 hodin
> 🗑️ Smazaných zpráv: 15

---

## ⚠️ Důležité poznámky

- Bot **ignoruje administrátory** a uživatele s oprávněním `Manage Messages`
- Role bota musí být **výše** než role uživatele, kterého chce ztlumit
- Discord API umožňuje bulk-delete jen zpráv **mladších 14 dní**
- Doporučuje se provozovat na VPS nebo službě jako Railway / Fly.io pro 24/7 provoz
