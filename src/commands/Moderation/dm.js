import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from 'discord.js';

import {
    successEmbed
} from '../../utils/embeds.js';

import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { sanitizeMarkdown } from '../../utils/validation.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

function extractUsers(guild, input) {
    const targets = new Set();

    if (!input) return [];

    // @everyone support
    if (input === "@everyone") {
        guild.members.cache.forEach(member => {
            if (!member.user.bot) targets.add(member.user);
        });
        return [...targets];
    }

    // split by comma or space
    const parts = input.split(/[, ]+/g);

    for (const part of parts) {
        if (!part) continue;

        // mention <@123>
        const mentionMatch = part.match(/^<@!?(\d+)>$/);
        let id = null;

        if (mentionMatch) {
            id = mentionMatch[1];
        } else if (/^\d{15,20}$/.test(part)) {
            id = part;
        }

        if (id) {
            const member = guild.members.cache.get(id);
            if (member && !member.user.bot) {
                targets.add(member.user);
            }
        }
    }

    return [...targets];
}

async function sendDM(user, message, interaction, anonymous) {
    const dm = await user.createDM();

    await dm.send({
        embeds: [
            successEmbed(
                anonymous ? "Message from the Staff Team" : `Message from ${interaction.user.tag}`,
                message
            ).setFooter({
                text: `you cannot reply to this message | log id: ${interaction.id}`
            })
        ]
    });
}

export default {
    data: new SlashCommandBuilder()
        .setName("dm")
        .setDescription("Send a DM to one or multiple users (Staff only)")
        .addStringOption(option =>
            option
                .setName("targets")
                .setDescription("user(s), ids, mentions, or @everyone")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("message to send")
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName("anonymous")
                .setDescription("send anonymously")
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),

    category: "moderation",

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) return;

        const targetsInput = interaction.options.getString("targets");
        const messageRaw = interaction.options.getString("message");
        const anonymous = interaction.options.getBoolean("anonymous") || false;

        if (messageRaw.length > 2000) {
            return InteractionHelper.safeEditReply(interaction, {
                content: "message too long (max 2000 chars)"
            });
        }

        const sanitized = sanitizeMarkdown(messageRaw);

        const users = extractUsers(interaction.guild, targetsInput);

        if (!users.length) {
            return InteractionHelper.safeEditReply(interaction, {
                content: "no valid users found"
            });
        }

        let success = 0;
        let failed = 0;

        for (const user of users) {
            try {
                await sendDM(user, sanitized, interaction, anonymous);
                success++;
            } catch (err) {
                failed++;

                if (err.code !== 50007) {
                    logger.error("DM failed", err);
                }
            }
        }

        await logEvent({
            client: interaction.client,
            guild: interaction.guild,
            event: {
                action: "Bulk DM Sent",
                executor: `${interaction.user.tag} (${interaction.user.id})`,
                metadata: {
                    success,
                    failed,
                    anonymous
                }
            }
        });

        return InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "DM completed",
                    `sent: ${success}\nfailed: ${failed}`
                )
            ]
        });
    }
};
