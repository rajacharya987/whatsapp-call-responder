const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const qrcode = require("qrcode-terminal");
const pino = require("pino");

async function startBot() {
  // Load authentication state from ./auth folder
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  // Fetch the latest WhatsApp Web version
  const { version } = await fetchLatestBaileysVersion();

  // Set up a logger with trace level support
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

  // Create the WhatsApp socket connection
  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
  });

  // Save credentials whenever updated
  sock.ev.on("creds.update", saveCreds);

  // Handle connection updates
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(
        "📱 Scan this QR code with WhatsApp (Linked Devices > Link a Device):"
      );
      qrcode.generate(qr, { small: true });
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

  // Track active calls
  const activeCalls = new Map(); // Store call ID, caller JID, and acceptance status

  // Handle call events
  sock.ev.on("call", async (calls) => {
    console.log("📞 Raw call event:", JSON.stringify(calls, null, 2));
    const call = calls[0];
    if (!call) return;

    const caller = call.from;
    const callId = call.id; // Use call.id as the unique key
    console.log(
      `📞 Call from ${caller} (ID: ${callId}, Status: ${
        call.status || "unknown"
      })`
    );

    if (call.status === "ringing") {
      console.log(`📞 Incoming call from ${caller} (Call ID: ${callId})`);
      // Store call details, assume not accepted initially
      activeCalls.set(callId, { caller, callId, isAccepted: false });
    } else if (call.status === "accept") {
      console.log(`📞 Call accepted from ${caller} (Call ID: ${callId})`);
      // Mark call as accepted
      if (activeCalls.has(callId)) {
        activeCalls.set(callId, {
          ...activeCalls.get(callId),
          isAccepted: true,
        });
      }
    } else if (call.status === "terminate") {
      console.log(`📞 Call terminated from ${caller} (Call ID: ${callId})`);

      if (activeCalls.has(callId) && !activeCalls.get(callId).isAccepted) {
        // Delay to ensure call is fully terminated
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          // Check if voice message file exists
          if (!fs.existsSync("./auto_response.mp3")) {
            throw new Error("Voice message file (auto_response.mp3) not found");
          }

          // Send a voice message with retry
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

          // Send a text message with retry
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
          // Send a fallback text message
          try {
            await sock.sendMessage(caller, {
              text: "I'm maybe offline or unavailable and couldn't process your call. Please try again later!",
            });
            console.log(`✅ Fallback text message sent to ${caller}`);
          } catch (sendErr) {
            console.error("Failed to send fallback message:", sendErr.stack);
          }
        } finally {
          // Clean up
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

  // Keep calls.upsert for debugging
  sock.ev.on("calls.upsert", async ({ calls }) => {
    console.log("📞 Calls upsert event:", JSON.stringify(calls, null, 2));
  });
}

// Run the bot
startBot().catch((err) => {
  console.error("Failed to start bot:", err);
  process.exit(1);
});
