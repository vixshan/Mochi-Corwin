const Discord = require('discord.js');
const axios = require('axios');

const Functions = require("../../database/models/functions");
const VoiceSchema = require("../../database/models/voiceChannels");

module.exports = async (client) => {
    //----------------------------------------------------------------//
    //                         Permissions                            //
    //----------------------------------------------------------------//
    // All bitfields to name
    client.bitfieldToName = function (bitfield) {
        const permissions = new Discord.PermissionsBitField(bitfield);
        return permissions.toArray();
    }

    // ... (other functions) ...

    client.generateActivity = function (id, name, channel, interaction) {
        const requestBody = {
            max_age: 86400,
            max_uses: 0,
            target_application_id: id,
            target_type: 2,
            temporary: false,
            validate: null
        };

        axios.post(`https://discord.com/api/v10/channels/${channel.id}/invites`, requestBody, {
            headers: {
                "Authorization": `Bot ${client.token}`,
                "Content-Type": "application/json"
            }
        })
        .then((response) => {
            const invite = response.data;

            if (invite.error || !invite.code) {
                return client.errNormal({
                    error: `Could not start **${name}**!`,
                    type: 'editreply'
                }, interaction);
            }

            const row = new Discord.ActionRowBuilder()
                .addComponents(
                    new Discord.ButtonBuilder()
                        .setLabel("Start activity")
                        .setURL(`https://discord.gg/${invite.code}`)
                        .setStyle(Discord.ButtonStyle.Link),
                );

            client.embed({
                title: `${client.emotes.normal.tv}・Activities`,
                desc: `Click on the **button** to start **${name}** in **${channel.name}**`,
                components: [row],
                type: 'editreply'
            }, interaction);
        })
        .catch((error) => {
            console.log(error);
            client.errNormal({
                error: `Could not start **${name}**!`,
                type: 'editreply'
            }, interaction);
        });
    }
}
