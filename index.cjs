const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const pino = require("pino");
const express = require("express");

// Global variable to hold latest QR
let latestQR = null;

// Express server to show QR image
const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
  if (!latestQR) return res.send("QR not generated yet. Please wait...");
  res.send(`
    <h2>📱 Scan this QR Code with WhatsApp</h2>
    <img src="/qr" alt="QR Code" />
  `);
});

app.get("/qr", async (req, res) => {
  if (!latestQR) return res.status(404).send("No QR code available");
  try {
    const qrImageBuffer = await QRCode.toBuffer(latestQR);
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": qrImageBuffer.length,
    });
    res.end(qrImageBuffer);
  } catch (err) {
    res.status(500).send("Failed to generate QR image");
  }
});

app.listen(PORT, () => {
  console.log(`🌐 QR Code web server running at: http://localhost:${PORT}`);
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const { version } = await fetchLatestBaileysVersion();

  const logger = pino({
    level: "trace",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  });

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log(
        "📱 Scan this QR code with WhatsApp (Linked Devices > Link a Device):"
      );
      qrcode.generate(qr, { small: true });
      console.log(`🌐 Also available at: http://localhost:${PORT}`);
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log("❌ Disconnected. Reconnecting?", shouldReconnect);
      if (shouldReconnect) {
        startBot().catch((err) => console.error("Reconnect failed:", err));
      }
    } else if (connection === "open") {
      console.log("✅ Connected to WhatsApp!");
    }
  });

  const activeCalls = new Map();

  sock.ev.on("call", async (calls) => {
    console.log("📞 Raw call event:", JSON.stringify(calls, null, 2));
    const call = calls[0];
    if (!call) return;

    const caller = call.from;
    const callId = call.id;
    console.log(
      `📞 Call from ${caller} (ID: ${callId}, Status: ${
        call.status || "unknown"
      })`
    );

    if (call.status === "ringing") {
      console.log(`📞 Incoming call from ${caller} (Call ID: ${callId})`);
      activeCalls.set(callId, { caller, callId, isAccepted: false });
    } else if (call.status === "accept") {
      console.log(`📞 Call accepted from ${caller} (Call ID: ${callId})`);
      if (activeCalls.has(callId)) {
        activeCalls.set(callId, {
          ...activeCalls.get(callId),
          isAccepted: true,
        });
      }
    } else if (call.status === "terminate") {
      console.log(`📞 Call terminated from ${caller} (Call ID: ${callId})`);

      if (activeCalls.has(callId) && !activeCalls.get(callId).isAccepted) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          if (!fs.existsSync("./auto_response.mp3")) {
            throw new Error("Voice message file (auto_response.mp3) not found");
          }

          console.log(`Sending voice message to ${caller}`);
          for (let i = 0; i < 3; i++) {
            try {
              await sock.sendMessage(caller, {
                audio: fs.readFileSync("./auto_response.mp3"),
                mimetype: "audio/mp4",
                ptt: true,
              });
              console.log(`✅ Voice message sent to ${caller}`);
              break;
            } catch (err) {
              console.error(
                `Voice message attempt ${i + 1} failed:`,
                err.stack
              );
              if (i === 2) throw err;
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }

          console.log(`Sending text message to ${caller}`);
          for (let i = 0; i < 3; i++) {
            try {
              await sock.sendMessage(caller, {
                text: "I'm maybe offline or unavailable and couldn't process your call. Please try again later!",
              });
              console.log(`✅ Text message sent to ${caller}`);
              break;
            } catch (err) {
              console.error(`Text message attempt ${i + 1} failed:`, err.stack);
              if (i === 2) throw err;
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        } catch (err) {
          console.error(
            `Error handling terminated call from ${caller}:`,
            err.stack
          );
          try {
            await sock.sendMessage(caller, {
              text: "I'm maybe offline or unavailable and couldn't process your call. Please try again later!",
            });
            console.log(`✅ Fallback text message sent to ${caller}`);
          } catch (sendErr) {
            console.error("Failed to send fallback message:", sendErr.stack);
          }
        } finally {
          activeCalls.delete(callId);
        }
      } else {
        console.log(
          `🟢 No action taken: Call ID ${callId} ${
            activeCalls.has(callId) ? "was accepted" : "not tracked"
          }`
        );
        activeCalls.delete(callId);
      }
    } else {
      console.log(`⚠️ Unhandled call status: ${call.status || "unknown"}`);
    }
  });

  sock.ev.on("calls.upsert", async ({ calls }) => {
    console.log("📞 Calls upsert event:", JSON.stringify(calls, null, 2));
  });
}

startBot().catch((err) => {
  console.error("Failed to start bot:", err);
  process.exit(1);
});
