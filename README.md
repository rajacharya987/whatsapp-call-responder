---

# 📞 WhatsApp Auto-Responder Bot using Baileys

This Node.js bot uses the [Baileys](https://github.com/WhiskeySockets/Baileys) library to connect to WhatsApp Web and handle incoming calls. If a call is not accepted (e.g., because the device is offline), the bot automatically sends a pre-recorded voice message and a follow-up text message.

---

## ⚙️ Features

* ✅ Connects to WhatsApp Web using multi-file authentication
* 📷 Displays QR code for initial login
* 📞 Detects incoming WhatsApp calls
* 🛑 Auto-handles call rejection if the main device is offline
* 🎙️ Sends a voice message (`auto_response.mp3`) after missed calls
* 💬 Sends a follow-up text message after missed calls
* 🧠 Caches call state to prevent duplicate replies
* 🧾 Pretty logging using `pino`

---

## 🧑‍💻 Requirements

* Node.js 18+
* A `./auth/` folder to store WhatsApp session credentials
* A voice file named `auto_response.mp3` in the project root

---

## 📦 Installation

```bash
git clone https://github.com/YOUR_USERNAME/whatsapp-call-responder.git
cd whatsapp-call-responder
npm install
```

Make sure you have a valid `auto_response.mp3` file in the root directory.

---

## 🚀 Usage

```bash
node index.js
```

When you run the script for the first time:

* A QR code will be printed in the terminal.
* Scan the code from your WhatsApp mobile app under **Linked Devices > Link a device**.

---

## 📁 File Structure

```
.
├── index.js              # Main bot script
├── auth/                 # WhatsApp session storage (auto-created)
├── auto_response.mp3     # Pre-recorded voice message
├── package.json
```

---

## 🧠 How It Works

1. **Connection Setup**:

   * Uses `makeWASocket()` with persistent multi-file authentication.
   * Connects using the latest WhatsApp Web version.
   * Displays a QR code if not yet authenticated.

2. **Call Handling**:

   * Tracks incoming call events (`ringing`, `accept`, `terminate`).
   * If a call is **terminated** without being accepted:

     * Sends a `.mp3` voice message (`ptt: true`).
     * Sends a follow-up text message.

3. **Retries**:

   * Voice and text messages are retried up to 3 times in case of temporary delivery failures.

---

## 📄 Dependencies

* [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys)
* [`pino`](https://github.com/pinojs/pino) — pretty logging
* [`qrcode-terminal`](https://www.npmjs.com/package/qrcode-terminal)
* Built-in Node.js `fs` module

Install all with:

```bash
npm install @whiskeysockets/baileys pino qrcode-terminal
```

---

## 🔐 Authentication

The bot uses Baileys' `useMultiFileAuthState()` to persist authentication in the `./auth/` directory. Do not delete this folder after scanning the QR code unless you want to re-authenticate.

---

## 📢 Logs

All actions (calls, connection status, retries, errors) are logged to the terminal using a colorized and timestamped format via `pino`.

---

## ⚠️ Disclaimer

This bot is intended for **educational and personal use**. Use responsibly and do not violate WhatsApp's [Terms of Service](https://www.whatsapp.com/legal/terms-of-service).

---

## 🛠️ To-Do / Ideas

* [ ] Support sending different responses for different callers
* [ ] Admin dashboard to monitor call events
* [ ] Remote control via WhatsApp chat commands
* [ ] Add fallback voice synthesis if `auto_response.mp3` is missing

---

## 📬 Contact

For issues or contributions, open an [issue](https://github.com/rajacharya987/whatsapp-call-responder/issues) or submit a pull request!

---
