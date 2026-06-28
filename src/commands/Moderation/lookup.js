import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("lookup")
        .setDescription("Look up a Roblox user by User ID")
        .addStringOption((option) =>
            option
                .setName("userid")
                .setDescription("The Roblox User ID")
                .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

    category: "utility",

    async execute(interaction, config, client) {
        try {
            const userId = interaction.options.getString("userid");

            if (!userId || isNaN(userId)) {
                throw new TitanBotError(
                    'Invalid user id',
                    ErrorTypes.USER_INPUT,
                    'You must provide a valid Roblox user ID.',
                    { subtype: 'invalid_roblox_id' },
                );
            }

            // fetch roblox profile
            const userRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
            if (!userRes.ok) {
                throw new Error("Roblox user not found.");
            }
            const userData = await userRes.json();

            // fetch avatar headshot
            const avatarRes = await fetch(
                `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`
            );
            const avatarData = await avatarRes.json();
            const avatarUrl = avatarData?.data?.[0]?.imageUrl || null;

            // try creation date formatting
            const created = userData.created
                ? new Date(userData.created).toLocaleString()
                : "Unknown";

            await InteractionHelper.universalReply(interaction, {
                embeds: [
                    infoEmbed(
                        `👤 Roblox User Lookup`,
                        `**Username:** ${userData.name}
**Display Name:** ${userData.displayName}
**User ID:** ${userData.id}
**Description:** ${userData.description || "None"}
**Account Created:** ${created}
**Banned:** ${userData.isBanned ? "Yes" : "No"}`,
                    ).setThumbnail(avatarUrl),
                ],
            });

        } catch (error) {
            logger.error('Lookup command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'lookup_failed' });
        }
    },
};
