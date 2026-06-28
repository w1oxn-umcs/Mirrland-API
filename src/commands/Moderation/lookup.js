import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

import { infoEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("lookup")
        .setDescription("Roblox user lookup with groups, friends, safety + paging")
        .addStringOption(option =>
            option.setName("userid")
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
                    "Invalid user id",
                    ErrorTypes.USER_INPUT,
                    "You must provide a valid Roblox user ID.",
                    { subtype: "invalid_roblox_id" }
                );
            }

            // USER
            const userRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
            if (!userRes.ok) throw new Error("User not found");
            const user = await userRes.json();

            // AVATAR
            const avatarRes = await fetch(
                `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`
            );
            const avatar = await avatarRes.json();
            const avatarUrl = avatar?.data?.[0]?.imageUrl;

            // GROUPS
            const groupsRes = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
            const groupsData = groupsRes.ok ? await groupsRes.json() : { data: [] };
            const groups = (groupsData.data || []).slice(0, 10);

            // FRIENDS (ALL FETCHED PAGE 1 ONLY SAFE)
            const friendsRes = await fetch(
                `https://friends.roblox.com/v1/users/${userId}/friends?limit=100`
            );
            const friendsData = friendsRes.ok ? await friendsRes.json() : { data: [] };
            const friends = friendsData.data || [];

            const friendsPerPage = 10;
            let page = 0;

            const getFriendsPage = (p) => {
                const start = p * friendsPerPage;
                return friends.slice(start, start + friendsPerPage);
            };

            const getFriendsEmbed = (p) => {
                const slice = getFriendsPage(p);

                return infoEmbed(
                    `👥 Friends (page ${p + 1}/${Math.ceil(friends.length / friendsPerPage) || 1})`,
                    slice.length
                        ? slice.map(f => `**${f.name}** (${f.displayName})`).join("\n")
                        : "no friends found"
                );
            };

            // SIMPLE SAFETY SCORE
            let score = 50;
            const accountAge = (Date.now() - new Date(user.created).getTime()) / 86400000;

            if (accountAge > 365) score += 20;
            if (accountAge < 30) score -= 25;
            if (user.isBanned) score -= 40;
            if (friends.length > 150) score += 10;
            if (friends.length < 10) score -= 10;

            score = Math.max(0, Math.min(100, score));

            const mainEmbed = infoEmbed(
                `👤 Roblox Lookup`,
                `**Username:** ${user.name}
**Display:** ${user.displayName}
**ID:** ${user.id}
**Created:** ${new Date(user.created).toLocaleString()}
**Friends:** ${friends.length}
**Banned:** ${user.isBanned ? "yes" : "no"}`
            ).setThumbnail(avatarUrl);

            const groupsEmbed = infoEmbed(
                `🏷 Groups`,
                groups.length
                    ? groups.map(g => `**${g.group.name}** — ${g.role.name}`).join("\n")
                    : "no groups found"
            );

            const safetyEmbed = infoEmbed(
                `🛡 Safety`,
                `**Score:** ${score}/100
Status: ${
                    score >= 70 ? "🟢 normal" :
                    score >= 40 ? "🟠 mixed" :
                    "🔴 risky"
                }`
            );

            const buildButtons = (p) => {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`friends_prev_${userId}`)
                        .setLabel("⬅ Prev")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(p === 0),

                    new ButtonBuilder()
                        .setCustomId(`friends_next_${userId}`)
                        .setLabel("Next ➡")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled((p + 1) * friendsPerPage >= friends.length)
                );
            };

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`lookup_${userId}`)
                    .setPlaceholder("select panel")
                    .addOptions([
                        { label: "profile", value: "main", emoji: "👤" },
                        { label: "groups", value: "groups", emoji: "🏷" },
                        { label: "friends", value: "friends", emoji: "👥" },
                        { label: "safety", value: "safety", emoji: "🛡" }
                    ])
            );

            let msg = await interaction.reply({
                embeds: [mainEmbed],
                components: [menu],
                fetchReply: true
            });

            const collector = msg.createMessageComponentCollector({
                time: 180000
            });

            collector.on("collect", async i => {
                if (i.user.id !== interaction.user.id) return;

                const val = i.customId;

                // DROPDOWN SWITCH
                if (i.isStringSelectMenu()) {
                    const v = i.values[0];

                    if (v === "main") return i.update({ embeds: [mainEmbed], components: [menu] });
                    if (v === "groups") return i.update({ embeds: [groupsEmbed], components: [menu] });
                    if (v === "safety") return i.update({ embeds: [safetyEmbed], components: [menu] });

                    if (v === "friends") {
                        page = 0;
                        return i.update({
                            embeds: [getFriendsEmbed(page)],
                            components: [menu, buildButtons(page)]
                        });
                    }
                }

                // FRIEND PAGINATION
                if (val?.startsWith("friends_prev")) {
                    page = Math.max(0, page - 1);
                    return i.update({
                        embeds: [getFriendsEmbed(page)],
                        components: [menu, buildButtons(page)]
                    });
                }

                if (val?.startsWith("friends_next")) {
                    page = page + 1;
                    return i.update({
                        embeds: [getFriendsEmbed(page)],
                        components: [menu, buildButtons(page)]
                    });
                }
            });

        } catch (err) {
            logger.error("lookup error:", err);
            await handleInteractionError(interaction, err, {
                subtype: "lookup_failed"
            });
        }
    }
};
