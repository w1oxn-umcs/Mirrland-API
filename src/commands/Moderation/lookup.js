import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("lookup")
        .setDescription("Look up a Roblox user by ID")
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("Roblox user ID")
                .setRequired(true)
        ),

    category: "utility",

    async execute(interaction) {
        try {
            const id = interaction.options.getString("id");

            if (!/^\d+$/.test(id)) {
                throw new TitanBotError(
                    "Invalid ID",
                    ErrorTypes.USER_INPUT,
                    "Roblox ID must be a number."
                );
            }

            const res = await fetch(`https://users.roblox.com/v1/users/${id}`);

            if (!res.ok) {
                throw new TitanBotError(
                    "User not found",
                    ErrorTypes.NOT_FOUND,
                    "No Roblox user exists with that ID."
                );
            }

            const data = await res.json();

            const profileUrl = `https://www.roblox.com/users/${data.id}/profile`;
            const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${data.id}&size=420x420&format=Png&isCircular=false`;

            const embed = createEmbed(
                `🧑 Roblox Lookup`,
                [
                    `**Username:** ${data.name}`,
                    `**Display Name:** ${data.displayName}`,
                    `**User ID:** ${data.id}`,
                    `**Created:** ${new Date(data.created).toLocaleDateString()}`,
                    `**Description:** ${data.description ? data.description.slice(0, 200) : "None"}`,
                    ``,
                    `🔗 **Links:**`,
                    `[Profile](${profileUrl})`,
                    `[Avatar](${avatarUrl})`,
                    `[Inventory](https://www.roblox.com/users/${data.id}/inventory)`,
                    `[Friends](https://www.roblox.com/users/${data.id}/friends)`,
                    `[Groups](https://www.roblox.com/users/${data.id}/groups)`,
                    `[Followers](https://www.roblox.com/users/${data.id}/friends#!/followers)`,
                ].join("\n"),
                "info"
            );

            await InteractionHelper.universalReply(interaction, {
                embeds: [embed],
            });

        } catch (error) {
            logger.error("Lookup command error:", error);
            await handleInteractionError(interaction, error, { subtype: "lookup_failed" });
        }
    },
};
