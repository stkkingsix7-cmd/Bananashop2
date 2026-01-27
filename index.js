require("dotenv").config();
const express = require("express");
const app = express();

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  Routes,
  REST,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const sharp = require("sharp");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const PREFIX = ",";
const OWNER_ID = "1415079602770153523";
const SERVER_ID = "1457192506977419398";

const PAYPAL_EMAIL = "chillcompp@outlook.com";
const LTC_ADDRESS = "ltc1qsn68dqsmc7atckumkz9nlercuunv95q4zf5vzr";
const BTC_ADDRESS = "bc1qyfraecnx3dctnajfcwxkgh0j84e0yrhlkykn5c";

const renameCooldown = new Map();

// ---- PUERTO PARA RENDER ----
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("BananaShop Bot Online"));
app.listen(PORT, () => console.log("🌐 Web server activo en puerto " + PORT));

// --- SLASH COMMANDS ---
const commands = [
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banea a un usuario")
    .addUserOption(opt =>
      opt.setName("usuario").setDescription("Usuario a banear").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("razon").setDescription("Razón del baneo").setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Muestra todos los comandos del bot")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
  console.log(`✅ Conectado como ${client.user.tag}`);
  client.user.setActivity("BananaShop", { type: 3 });

  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, SERVER_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registrados");
  } catch (err) {
    console.error("❌ Error registrando slash commands:", err);
  }
});

// --- MENSAJES ---
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  const owner = await client.users.fetch(OWNER_ID).catch(() => null);
  const ownerAvatar = owner?.displayAvatarURL({ dynamic: true });

  const baseEmbed = new EmbedBuilder()
    .setColor("#0d0d0d")
    .setFooter({ text: "Banana Shop", iconURL: ownerAvatar })
    .setTimestamp();

  if (command === "paypal") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("copy_paypal").setLabel("Copiar").setStyle(ButtonStyle.Secondary)
    );

    const embed = baseEmbed
      .setTitle("Método de Pago - PayPal")
      .setDescription(PAYPAL_EMAIL)
      .setThumbnail(ownerAvatar);

    return message.reply({ embeds: [embed], components: [row] });
  }

  if (command === "ltc") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("copy_ltc").setLabel("Copiar").setStyle(ButtonStyle.Secondary)
    );

    const embed = baseEmbed
      .setTitle("Método de Pago - Litecoin")
      .setDescription(LTC_ADDRESS)
      .setThumbnail(ownerAvatar);

    return message.reply({ embeds: [embed], components: [row] });
  }

  if (command === "btc") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("copy_btc").setLabel("Copiar").setStyle(ButtonStyle.Secondary)
    );

    const embed = baseEmbed
      .setTitle("Método de Pago - Bitcoin")
      .setDescription(BTC_ADDRESS)
      .setThumbnail(ownerAvatar);

    return message.reply({ embeds: [embed], components: [row] });
  }

  if (command === "paymentmethods") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("copy_paypal").setLabel("PayPal").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("copy_ltc").setLabel("LTC").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("copy_btc").setLabel("BTC").setStyle(ButtonStyle.Secondary)
    );

    const embed = baseEmbed
      .setTitle("Métodos de Pago Disponibles")
      .setDescription(`PayPal:\n${PAYPAL_EMAIL}\n\nLTC:\n${LTC_ADDRESS}\n\nBTC:\n${BTC_ADDRESS}`)
      .setThumbnail(ownerAvatar);

    return message.reply({ embeds: [embed], components: [row] });
  }

  if (command === "rename") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("❌ No tienes permisos para renombrar canales.");
    }

    const newName = args.join(" ");
    if (!newName) return message.reply("❌ Usa: `,rename <nuevo-nombre>`");

    const now = Date.now();
    const last = renameCooldown.get(message.channel.id) || 0;

    if (now - last < 1500) {
      return message.reply("⏳ Espera 2s antes de renombrar otra vez.");
    }

    renameCooldown.set(message.channel.id, now);

    try {
      await message.channel.edit({ name: newName });
      await message.delete().catch(() => {});
    } catch (err) {
      console.error("Rename error:", err);
      renameCooldown.delete(message.channel.id);
      return message.reply("❌ Discord bloqueó el rename. Intenta en unos segundos.");
    }

    return;
  }

  if (command === "addemoji") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
      return message.reply("❌ No tienes permisos para añadir emojis.");
    }

    const input = args[0];
    const name = args[1] || `emoji_${Date.now()}`;

    if (!input) {
      return message.reply("❌ Usa: `,addemoji <emoji|id|url> [nombre]`");
    }

    let url = null;

    const match = input.match(/<(a?):\w+:(\d+)>/);
    if (match) {
      const animated = match[1] === "a";
      const id = match[2];
      url = `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`;
    }

    if (!url && /^\d{10,20}$/.test(input)) {
      url = `https://cdn.discordapp.com/emojis/${input}.png`;
    }

    if (!url && input.startsWith("http")) {
      url = input;
    }

    if (!url) {
      return message.reply("❌ Emoji inválido.");
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);

      let buffer = Buffer.from(await res.arrayBuffer());

      if (url.endsWith(".webp")) {
        buffer = await sharp(buffer).png().toBuffer();
      }

      const emoji = await message.guild.emojis.create({
        attachment: buffer,
        name
      });

      message.reply(`✅ Emoji añadido: ${emoji}`);
    } catch (err) {
      console.error("AddEmoji error:", err);
      message.reply("❌ No se pudo añadir el emoji.");
    }

    return;
  }
});

// --- INTERACCIONES ---
client.on("interactionCreate", async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId === "copy_paypal") {
      return interaction.reply({ content: PAYPAL_EMAIL, ephemeral: true });
    }
    if (interaction.customId === "copy_ltc") {
      return interaction.reply({ content: LTC_ADDRESS, ephemeral: true });
    }
    if (interaction.customId === "copy_btc") {
      return interaction.reply({ content: BTC_ADDRESS, ephemeral: true });
    }
  }

  if (!interaction.isChatInputCommand()) return;

  const owner = await client.users.fetch(OWNER_ID).catch(() => null);
  const ownerAvatar = owner?.displayAvatarURL({ dynamic: true });

  if (interaction.commandName === "ban") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "❌ No tienes permisos.", ephemeral: true });
    }

    const user = interaction.options.getUser("usuario");
    const reason = interaction.options.getString("razon") || "Sin razón";

    try {
      await interaction.guild.members.ban(user.id, { reason });

      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Usuario baneado")
        .setDescription(`Usuario: ${user.tag}\nRazón: ${reason}`)
        .setFooter({ text: "Banana Shop", iconURL: ownerAvatar })
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      interaction.reply({ content: "❌ Error al banear.", ephemeral: true });
    }
  }

  if (interaction.commandName === "help") {
    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("Banana Shop - Comandos")
      .setDescription(`
Comandos con prefijo (,):
• ,paypal  
• ,ltc  
• ,btc  
• ,paymentmethods  
• ,rename <nuevo-nombre>  
• ,addemoji <emoji|id|url> [nombre]  

Slash Commands:
• /ban  
• /help  
`)
      .setThumbnail(ownerAvatar)
      .setFooter({ text: "Banana Shop", iconURL: ownerAvatar })
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
