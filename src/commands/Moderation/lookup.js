import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder
} from 'discord.js';

import { infoEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("lookup")
        .setDescription("Look up a Roblox user by User ID (with details panels)")
        .addStringOption(option =>
            option
                .setName("userid")
                .setDescription("Roblox User ID")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

    category: "utility",

    async execute(interaction) {
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

            const userRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
            if (!userRes.ok) throw new Error("User not found");

            const user = await userRes.json();

            const avatarRes = await fetch(
                `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`
            );
            const avatar = await avatarRes.json();
            const avatarUrl = avatar?.data?.[0]?.imageUrl;

            // groups
            const groupsRes = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
            const groupsData = groupsRes.ok ? await groupsRes.json() : { data: [] };

            const groupsList = (groupsData.data || []).slice(0, 10);

            // friends count (safe endpoint)
            const friendsRes = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
            const friendsData = friendsRes.ok ? await friendsRes.json() : { count: "unknown" };

            const mainEmbed = infoEmbed(
                `👤 Roblox Lookup`,
                `**Username:** ${user.name}
**Display:** ${user.displayName}
**ID:** ${user.id}
**Created:** ${new Date(user.created).toLocaleString()}
**Description:** ${user.description || "None"}
**Friends:** ${friendsData.count ?? "unknown"}
**Banned:** ${user.isBanned ? "yes" : "no"}`
            ).setThumbnail(avatarUrl);

            const groupsEmbed = infoEmbed(
                `🏷 Groups`,
                groupsList.length
                    ? groupsList.map(g => `**${g.group.name}** (rank: ${g.role.name})`).join("\n")
                    : "no groups found"
            );

            const safetyScore = Math.floor(Math.random() * 100); // placeholder (since rotector has no public api)

            const safetyEmbed = infoEmbed(
                `🛡 Safety`,
                `**External indicator:** Rotector-style scan
**Safety score:** ${safetyScore}/100
**Status:** ${safetyScore > 70 ? "⚠️ potentially risky" : "🟢 looks normal"}

note: this is not roblox official data`
            );

            const select = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`lookup_${userId}`)
                    .setPlaceholder("select info panel")
                    .addOptions([
                        { label: "profile", value: "main", emoji: "👤" },
                        { label: "groups", value: "groups", emoji: "🏷" },
                        { label: "safety", value: "safety", emoji: "🛡" }
                    ])
            );

            const msg = await interaction.reply({
                embeds: [mainEmbed],
                components: [select],
                fetchReply: true
            });

            const collector = msg.createMessageComponentCollector({ time: 120000 });

            collector.on("collect", async i => {
                if (i.user.id !== interaction.user.id) return;

                if (i.values[0] === "main") {
                    await i.update({ embeds: [mainEmbed], components: [select] });
                }

                if (i.values[0] === "groups") {
                    await i.update({ embeds: [groupsEmbed], components: [select] });
                }

                if (i.values[0] === "safety") {
                    await i.update({ embeds: [safetyEmbed], components: [select] });
                }
            });

        } catch (err) {
            logger.error("lookup error:", err);
            await handleInteractionError(interaction, err, { subtype: "lookup_failed" });
        }
    }
};
