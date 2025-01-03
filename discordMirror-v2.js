const { Client, WebhookClient, MessageFlags, MessageEmbed, MessageActionRow, MessageButton} = require('discord.js-selfbot-v13');
const config = require('./config.json');

/*
* Return the token portion from a webhook url.
* URL: https://discord.com/api/webhooks/123/abcdef
*                                              ↳ TOKEN
*/
function parseWebhookToken(webhookUrl) {
    const index = webhookUrl.lastIndexOf('/');

    if (index == -1) {
        throw 'Invalid Webhook URL in config.json';
    }

    return webhookUrl.substring(index + 1, webhookUrl.length);
}

/*
* Return the id portion from a webhook url.
* URL: https://discord.com/api/webhooks/123/abcdef
*                                        ↳ ID
*/
function parseWebhookId(webhookUrl) {
    const indexEnd = webhookUrl.lastIndexOf('/');

    if (indexEnd == -1) {
        throw 'Invalid Webhook URL in config.json';
    }

    const indexStart = webhookUrl.lastIndexOf('/', indexEnd - 1);

    if (indexStart == -1) {
        throw 'Invalid Webhook URL in config.json';
    }

    return webhookUrl.substring(indexStart + 1, indexEnd);
}

/*
* Key = Channel id where when a message is sent, it is replicated to the webhooks.
* Value = Array of webhooks where the message is replicated.
*/
const channelWebhookMapping = {};

function loadConfigValues() {
    for (const mirror of config['mirrors']) {
        const webhooks = [];

        for (const webhookUrl of mirror['webhooks_urls']) {
            webhooks.push(new WebhookClient({
                token: parseWebhookToken(webhookUrl),
                id: parseWebhookId(webhookUrl)
            }));
        }

        for (const channelId of mirror['channel_ids']) {
            channelWebhookMapping[channelId] = webhooks;
        }
    }
}

loadConfigValues();

const client = new Client({ checkUpdate: false });

client.on('ready', async () => {
    console.log(`${client.user.username} is now mirroring >:)!`);
    client.user.setPresence({ status: config['status'] });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!config.mirrorAll && !config.users.includes(message.author.id)) return;
    if (!message.content.length && !message.embeds.length && !message.attachments.size) return;
    if (message.flags & MessageFlags.Ephemeral) return;

    const webhooks = channelWebhookMapping[message.channelId];

    if (!webhooks) return;

    const serverName = message.guild?.name || "Direct Message";
    const channelName = message.channel?.name || "DM";
    const channelLink = `https://discord.com/channels/${message.guild?.id || "@me"}/${message.channel.id}`;
    const additionalInfo = `\n\n**Server:** ${serverName}\n**Channel:** [#${channelName}](${channelLink})\n`;

    let content = message.content || '᲼';
    for (const attachment of message.attachments.values()) {
        content += `\n${attachment.url}`;
    }

    content += additionalInfo;

    // Send the message to the webhooks.
    for (const webhook of webhooks) {
        webhook.send({
          content: content,
          username: message.author.username,
          avatarURL: message.author.displayAvatarURL(),
          embeds: message.embeds,
        }).catch(console.error);
    }
});

client.login(config['token']);