const { BufferJSON, WA_DEFAULT_EPHEMERAL, generateWAMessageFromContent, proto, generateWAMessageContent, generateWAMessage, prepareWAMessageMedia, areJidsSameUser, getContentType } = require("@whiskeysockets/baileys");
const fs = require("fs");
const util = require("util");
const chalk = require("chalk");
const OpenAI = require("openai");
const sifat = "{ latar belakang : namamu adalah Fazriyan, seorang remaja pendiam  berusia 19 tahun }, jangan gunakan emote balas pesan tidak lebih dari 15-30 kata supaya terkesan natural. ";
let setting = require("./key.json")
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY;
const googleAI = new GoogleGenerativeAI(geminiApiKey);

// Object to store chat history for each number
const chatHistory = {};

module.exports = sansekai = async (client, m, chatUpdate) => {
  try {
    var body = m.mtype === "conversation" ? m.message.conversation :
      m.mtype == "imageMessage" ? m.message.imageMessage.caption :
        m.mtype == "videoMessage" ? m.message.videoMessage.caption :
          m.mtype == "extendedTextMessage" ? m.message.extendedTextMessage.text :
            m.mtype == "buttonsResponseMessage" ? m.message.buttonsResponseMessage.selectedButtonId :
              m.mtype == "listResponseMessage" ? m.message.listResponseMessage.singleSelectReply.selectedRowId :
                m.mtype == "templateButtonReplyMessage" ? m.message.templateButtonReplyMessage.selectedId :
                  m.mtype === "messageContextInfo" ? m.message.buttonsResponseMessage?.selectedButtonId ||
                    m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text :
                    "";
    if (m.mtype === "viewOnceMessageV2") return
    var budy = typeof m.text == "string" ? m.text : "";
    var prefix = /^[\\/!#.]/gi.test(body) ? body.match(/^[\\/!#.]/gi) : "";
    const isCmd2 = body.startsWith(prefix);
    const command = body.replace(prefix, "").trim().split(/ +/).shift().toLowerCase();
    const args = body.trim().split(/ +/).slice(1);
    const pushname = m.pushName || "No Name";
    const botNumber = await client.decodeJid(client.user.id);
    const itsMe = m.sender == botNumber ? true : false;
    let text = (q = args.join(" "));
    const arg = budy.trim().substring(budy.indexOf(" ") + 1);
    const arg1 = arg.trim().substring(arg.indexOf(" ") + 1);

    const from = m.chat;
    const reply = m.reply;
    const sender = m.sender;
    const mek = chatUpdate.messages[0];

    const color = (text, color) => {
      return !color ? chalk.green(text) : chalk.keyword(color)(text);
    };

    // Group
    const groupMetadata = m.isGroup ? await client.groupMetadata(m.chat).catch((e) => { }) : "";
    const groupName = m.isGroup ? groupMetadata.subject : "";

    // Push Message To Console
    let argsLog = budy.length > 30 ? `${q.substring(0, 30)}...` : budy;

    if (isCmd2 && !m.isGroup) {
      console.log(chalk.black(chalk.bgWhite("[ LOGS ]")), color(argsLog, "turquoise"), chalk.magenta("From"), chalk.green(pushname), chalk.yellow(`[ ${m.sender.replace("@s.whatsapp.net", "")} ]`));
    } else if (isCmd2 && m.isGroup) {
      console.log(
        chalk.black(chalk.bgWhite("[ LOGS ]")),
        color(argsLog, "turquoise"),
        chalk.magenta("From"),
        chalk.green(pushname),
        chalk.yellow(`[ ${m.sender.replace("@s.whatsapp.net", "")} ]`),
        chalk.blueBright("IN"),
        chalk.green(groupName)
      );
    }
    if (command === "image") {
      try {
        const prompt = args.join(" ");
        if (!prompt) return m.reply("Please provide a description for the image.");

        // Use a free image generation API (e.g., Unsplash API)
        const unsplashApiKey = process.env.UNSPLASH_API_KEY; // Add this to your .env file
        const unsplashUrl = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(prompt)}&client_id=${unsplashApiKey}`;

        const response = await fetch(unsplashUrl);
        const data = await response.json();
        const imageUrl = data.urls.regular;

        // Check if the message has already been sent
        if (!m.messageTimestamp) {
          // Send the image once
          await client.sendMessage(m.chat, { image: { url: imageUrl }}, { quoted: m });
          // Set a timestamp to indicate the message has been sent
          m.messageTimestamp = Date.now();
        }
      } catch (error) {
        console.error("Error fetching or sending image:", error);
        m.reply("An error occurred while generating the image. Please try again later.");
      }
    } else if (!m.isGroup && !itsMe) {
      try {
        if (setting.keyopenai === "ISI_APIKEY_OPENAI_DISINI") return reply("Apikey belum diisi\n\nSilahkan isi terlebih dahulu apikeynya di file key.json\n\nApikeynya bisa dibuat di website: https://beta.openai.com/account/api-keys");

        // Initialize chat history for this sender if it doesn't exist
        if (!chatHistory[sender]) {
          chatHistory[sender] = [];
        }

        // Add the current message to the chat history
        chatHistory[sender].push({ role: "user", content: budy });

        // Keep only the last 5 messages
        if (chatHistory[sender].length > 5) {
          chatHistory[sender] = chatHistory[sender].slice(-5);
        }

        //Konfigurasi Generasi
        const config = {
          temperature: 0.95,
          topP: 1,
          topK: 1,
          maxOutputTokens: 4096,
          presencePenalty: 0.95,
          frequencyPenalty: 0.95,
          systemInstruction: "Kamu adalah Fazriyan seorang remaja baik hati yang selalu ramah dan sopan.",
        };

        //model gemini           
        const model = googleAI.getGenerativeModel({ model: "gemini-1.5-pro", config, });

        const prompt = sifat + " pesanku : " + budy + "\n\nRiwayat chat sebelumnya:\n" + chatHistory[sender].map(msg => `${msg.role}: ${msg.content}`).join("\n");

        const result = await model.generateContent([prompt]);

        const response = result.response.text();

        // Add the AI's response to the chat history
        chatHistory[sender].push({ role: "assistant", content: response });

        await client.sendMessage(m.chat, { text: response });

      } catch (error) {
        if (error.response) {
          console.log(error.response.status);
          console.log(error.response.data);
        } else {
          console.log(error);
        }
      }
    }
  } catch (err) {
    m.reply(util.format(err));
  }
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
