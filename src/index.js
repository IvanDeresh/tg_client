import "./utils/server.js";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import fs from "fs";
import dotenv from "dotenv";
import { loadConfig as lc } from "./utils/loadConfig.js";
import { paths } from "./utils/paths.js";

dotenv.config();

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;

function loadConfig() {
    lc();
    return JSON.parse(fs.readFileSync(paths.config, "utf8"));
}

let config = loadConfig();

if (!fs.existsSync(paths.session)) {
    console.error("❌ No session found.");
    console.error("Please login first:");
    console.error("1. Start control bot");
    console.error("2. Send /start to control bot");
    console.error("3. Send /login and follow instructions");
    console.error("4. After successful login, restart this worker");
    process.exit(1);
}

if (!config.enabled) {
    console.log("⛔ Worker disabled.");
    console.log("Send /on to control bot to enable worker.");
    process.exit(0);
}

const chatId = config.chatId ? BigInt(config.chatId) : null;
const ADMIN_ID = process.env.ADMIN_ID;
const KEYWORDS = config.keywords;
const DAILY_LIMIT = config.dailyLimit;
const MIN_DELAY = config.delay.min;
const MAX_DELAY = config.delay.max;

const stringSession = new StringSession(fs.readFileSync(paths.session, "utf8"));

const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
});

let contacted = fs.existsSync(paths.contacted) ? JSON.parse(fs.readFileSync(paths.contacted)) : {};

try {
    await client.connect();
    console.log("✅ Session loaded and connected");
} catch (err) {
    console.error("❌ Connection error:", err.message);
    console.error("Session might be invalid or expired.");
    console.error("Please login again:");
    console.error("1. Send /logout to control bot");
    console.error("2. Send /login to control bot");
    process.exit(1);
}

console.log("👂 Listening to chat messages...");

client.addEventHandler(async (event) => {
    config = loadConfig();
    if (!config.enabled) return;

    const msg = event.message;
    if (!msg?.text) return;

    const peer = msg.peerId;
    if (
        (peer.className === "PeerChat" && peer.chatId.value !== chatId) ||
        (peer.className === "PeerChannel" && peer.channelId.value !== chatId)
    )
        return;

    const text = msg.text.toLowerCase();
    if (!KEYWORDS.some((k) => text.includes(k))) return;

    const sender = await msg.getSender();
    if (!sender || sender.bot || sender.self) return;

    const userId = sender.id.value;
    if (contacted[userId]) return;

    const today = new Date().toDateString();
    const todayCount = Object.values(contacted).filter((v) => v.date === today).length;
    if (todayCount >= DAILY_LIMIT) return;

    const delayMs = random(MIN_DELAY, MAX_DELAY);
    console.log(`⏳ Waiting ${Math.round(delayMs / 1000)}s before DM`);
    await delay(delayMs);

    try {
        await client.sendMessage(sender, { message: getTemplate(sender.firstName) });
        contacted[userId] = { date: today };
        fs.writeFileSync(paths.contacted, JSON.stringify(contacted, null, 2));
        console.log("✅ DM sent to", sender.firstName || userId);

        await client.sendMessage(ADMIN_ID, {
            message: `📩 New contact

👤 Client: ${sender.firstName || "Unknown"}
🆔 User ID: ${userId}
📅 Date: ${today}`,
        });
    } catch (e) {
        console.error("❌ Send error:", e.message);
    }
}, new NewMessage({}));

function getTemplate(name = "") {
    const templates = config.templates || [];
    return templates[Math.floor(Math.random() * templates.length)] || "Hello!";
}

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
