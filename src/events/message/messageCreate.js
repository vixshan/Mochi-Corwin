const Discord = require("discord.js");
const axios = require("axios");
const Functions = require("../../database/models/functions");
const afk = require("../../database/models/afk");
const chatBotSchema = require("../../database/models/chatbot-channel");
const messagesSchema = require("../../database/models/messages");
const messageSchema = require("../../database/models/levelMessages");
const messageRewards = require("../../database/models/messageRewards");
const Schema = require("../../database/models/stickymessages");
const levelRewards = require("../../database/models/levelRewards");
const levelLogs = require("../../database/models/levelChannels");
const Commands = require("../../database/models/customCommand");
const CommandsSchema = require("../../database/models/customCommandAdvanced");

/**
 * @param {Discord.Client} client
 * @param {Discord.Message} message
 * @returns
 */
module.exports = async (client, message) => {
  const dmlog = new Discord.WebhookClient({
    id: client.webhooks.dmLogs.id,
    token: client.webhooks.dmLogs.token,
  });

  if (message.author.bot) return;

  if (message.channel.type === "DM") {
    let embedLogs = new Discord.MessageEmbed()
      .setTitle("💬・New DM message!")
      .setDescription("Bot has received a new DM message!")
      .addFields(
        { name: "👤┆Send By", value: `${message.author} (${message.author.tag})`, inline: true },
        { name: "💬┆Message", value: `${message.content || "None"}`, inline: true }
      )
      .setColor(client.config.colors.normal)
      .setTimestamp();

    if (message.attachments.size > 0) {
      embedLogs.addFields(
        { name: "📃┆Attachments", value: `${message.attachments.first()?.url}`, inline: false }
      );
    }

    return dmlog.send({
      username: "Bot DM",
      embeds: [embedLogs],
    });
  }

  // Levels
  const data = await Functions.findOne({ Guild: message.guild.id });
  if (data && data.Levels) {
    const randomXP = Math.floor(Math.random() * 9) + 1;
    const hasLeveledUp = await client.addXP(message.author.id, message.guild.id, randomXP);

    if (hasLeveledUp) {
      const user = await client.fetchLevels(message.author.id, message.guild.id);
      const levelData = await levelLogs.findOne({ Guild: message.guild.id });
      const messageData = await messageSchema.findOne({ Guild: message.guild.id });

      if (messageData) {
        let levelMessage = messageData.Message;
        levelMessage = levelMessage.replace("{user:username}", message.author.username);
        levelMessage = levelMessage.replace("{user:discriminator}", message.author.discriminator);
        levelMessage = levelMessage.replace("{user:tag}", message.author.tag);
        levelMessage = levelMessage.replace("{user:mention}", message.author);
        levelMessage = levelMessage.replace("{user:level}", user.level);
        levelMessage = levelMessage.replace("{user:xp}", user.xp);

        try {
          if (levelData) {
            await client.channels.cache.get(levelData.Channel).send({ content: levelMessage });
          } else {
            await message.channel.send({ content: levelMessage });
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        try {
          if (levelData) {
            await client.channels.cache.get(levelData.Channel).send({
              content: `**GG** <@!${message.author.id}>, you are now level **${user.level}**`,
            });
          } else {
            message.channel.send({
              content: `**GG** <@!${message.author.id}>, you are now level **${user.level}**`,
            });
          }
        } catch (err) {
          console.error(err);
        }
      }

      levelRewards.findOne({ Guild: message.guild.id, Level: user.level }, async (err, data) => {
        if (data) {
          message.guild.members.cache.get(message.author.id).roles.add(data.Role).catch(console.error);
        }
      });
    }
  }

  // Message tracker system
  const userData = await messagesSchema.findOne({ Guild: message.guild.id, User: message.author.id });
  if (userData) {
    userData.Messages += 1;
    userData.save();

    const messageRewardData = await messageRewards.findOne({ Guild: message.guild.id, Messages: userData.Messages });
    if (messageRewardData) {
      try {
        message.guild.members.cache.get(message.author.id).roles.add(messageRewardData.Role);
      } catch (err) {
        console.error(err);
      }
    }
  } else {
    new messagesSchema({
      Guild: message.guild.id,
      User: message.author.id,
      Messages: 1,
    }).save();
  }

  // AFK system
  const afkData = await afk.findOne({ Guild: message.guild.id, User: message.author.id });
  if (afkData) {
    await afk.deleteOne({ Guild: message.guild.id, User: message.author.id });
    client.simpleEmbed({ desc: `${message.author} is no longer afk!` }, message.channel)
      .then(async (m) => {
        setTimeout(() => {
          m.delete();
        }, 5000);
      });

    if (message.member.displayName.startsWith("[AFK] ")) {
      const name = message.member.displayName.replace("[AFK] ", "");
      message.member.setNickname(name).catch(console.error);
    }
  }

  message.mentions.users.forEach(async (u) => {
    if (!message.content.includes("@here") && !message.content.includes("@everyone")) {
      const userAfkData = await afk.findOne({ Guild: message.guild.id, User: u.id });
      if (userAfkData) {
        client.simpleEmbed({ desc: `${u} is currently afk! **Reason:** ${userAfkData.Message}` }, message.channel);
      }
    }
  });

  // Chat bot
  const chatBotData = await chatBotSchema.findOne({ Guild: message.guild.id });
  if (chatBotData && message.channel.id === chatBotData.Channel) {
    if (process.env.OPENAI) {
      try {
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content: message.content,
            },
          ],
        }, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI}`,
          },
        });

        if (!response.data.error) {
          message.reply({ content: response.data.choices[0].message.content });
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        const input = message;
        try {
          const response = await axios.get(`https://api.coreware.nl/fun/chat?msg=${encodeURIComponent(input)}&uid=${message.author.id}`);
          if (response.data && response.data.response) {
            return message.reply({ content: response.data.response });
          }
        } catch (err) {
          console.error(err);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  // Sticky messages
  try {
    const stickyData = await Schema.findOne({ Guild: message.guild.id, Channel: message.channel.id });
    if (stickyData) {
      const lastStickyMessage = await message.channel.messages.fetch(stickyData.LastMessage).catch(console.error);
      if (lastStickyMessage) {
        await lastStickyMessage.delete({ timeout: 1000 });
      }
      const newMessage = await client.simpleEmbed({ desc: `${stickyData.Content}` }, message.channel);
      stickyData.LastMessage = newMessage.id;
      stickyData.save();
    }
  } catch (err) {
    console.error(err);
  }

  // Prefix
  let guildSettings = await Functions.findOne({ Guild: message.guild.id });
  if (!guildSettings) {
    new Functions({
      Guild: message.guild.id,
      Prefix: client.config.discord.prefix,
    }).save();
    guildSettings = await Functions.findOne({ Guild: message.guild.id });
  }

  if (!guildSettings || !guildSettings.Prefix) {
    Functions.findOne({ Guild: message.guild.id }, async (err, data) => {
      data.Prefix = client.config.discord.prefix;
      data.save();
    });
    guildSettings = await Functions.findOne({ Guild: message.guild.id });
  }

  if (!guildSettings || !guildSettings.Prefix) {
    var prefix = client.config.Discord.prefix;
  } else {
    var prefix = guildSettings.Prefix;
  }

  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefixRegex = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(prefix)})\\s*`);

  if (!prefixRegex.test(message.content.toLowerCase())) return;
  const [, matchedPrefix] = message.content.toLowerCase().match(prefixRegex);

  const args = message.content.slice(matchedPrefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if (message.mentions.users.first() && message.mentions.users.first().id == client.user.id && command.length === 0) {
    let row = new Discord.MessageActionRow()
      .addComponents(
        new Discord.MessageButton()
          .setLabel("Invite")
          .setURL(client.config.discord.botInvite)
          .setStyle("LINK"),
        new Discord.MessageButton()
          .setLabel("Support server")
          .setURL(client.config.discord.serverInvite)
          .setStyle("LINK")
      );

    client.embed(
      {
        title: "Hi, I'm Bot",
        desc: "Use with commands via Discord ✨ commands",
        fields: [
          {
            name: "📨┆Invite me",
            value: `Invite Bot in your own server! [Click here](${client.config.discord.botInvite})`,
          },
          {
            name: "❓┇I don't see any slash commands",
            value: "The bot may not have permissions for this. Open the invite link again and select your server. The bot then gets the correct permissions",
          },
          {
            name: "❓┆Need support?",
            value: `For questions, you can join our [support server](${client.config.discord.serverInvite})!`,
          },
          {
            name: "🐞┆Found a bug?",
            value: "Report all bugs via: `/report bug`!",
          },
        ],
        components: [row],
      },
      message.channel
    ).catch(console.error);
  }

  const cmd = await Commands.findOne({ Guild: message.guild.id, Name: command });
  if (cmd) {
    return message.channel.send({ content: cmd.Responce });
  }

  const cmdx = await CommandsSchema.findOne({ Guild: message.guild.id, Name: command });
  if (cmdx) {
    if (cmdx.Action == "Normal") {
      return message.channel.send({ content: cmdx.Responce });
    } else if (cmdx.Action == "Embed") {
      return client.simpleEmbed(
        {
          desc: `${cmdx.Responce}`,
        },
        message.channel
      );
    } else if (cmdx.Action == "DM") {
      return message.author.send({ content: cmdx.Responce }).catch((e) => {
        client.errNormal(
          {
            error: "I can't DM you, maybe you have DM turned off!",
          },
          message.channel
        );
      });
    }
  }
};
