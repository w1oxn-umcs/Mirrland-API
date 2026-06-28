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
        .setDescription("Roblox user lookup (profile, groups, friends)")
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
                    "Invalid user id",
                    ErrorTypes.USER_INPUT,
                    "You must provide a valid Roblox user ID.",
                    { subtype: "invalid_roblox_id" }
                );
            }

            // USER INFO
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

            // -----------------------
            // FRIENDS (CURSOR BASED)
            // -----------------------
            let friendsCache = [];
            let cursor = "";
            let page = 0;

            const fetchFriendsPage = async (c = "") => {
                const url = new URL(`https://friends.roblox.com/v1/users/${userId}/friends`);
                url.searchParams.set("limit", "50");
                if (c) url.searchParams.set("cursor", c);

                const res = await fetch(url.toString());
                if (!res.ok) return { data: [], nextPageCursor: null };

                return await res.json();
            };

            const loadPage = async (pageIndex) => {
                let c = "";
                let data = null;

                for (let i = 0; i <= pageIndex; i++) {
                    data = await fetchFriendsPage(c);
                    c = data.nextPageCursor;
                    if (!c && i < pageIndex) break;
                }

                cursor = c;
                friendsCache = data.data || [];

                return data;
            };

            const buildFriendsEmbed = () => {
                return infoEmbed(
                    `👥 Friends (page ${page + 1})`,
                    friendsCache.length
                        ? friendsCache.map(f => `**${f.name}** (${f.displayName})`).join("\n")
                        : "no friends found"
                );
            };

            // INITIAL LOAD
            await loadPage(0);

            const mainEmbed = infoEmbed(
                `👤 Roblox Lookup`,
                `**Username:** ${user.name}
**Display:** ${user.displayName}
**ID:** ${user.id}
**Created:** ${new Date(user.created).toLocaleString()}
**Friends loaded:** ${friendsCache.length}`
            ).setThumbnail(avatarUrl);

            const groupsEmbed = infoEmbed(
                `🏷 Groups`,
                groups.length
                    ? groups.map(g => `**${g.group.name}** — ${g.role.name}`).join("\n")
                    : "no groups found"
            );

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`lookup_${userId}`)
                    .setPlaceholder("select panel")
                    .addOptions([
                        { label: "profile", value: "main", emoji: "👤" },
                        { label: "groups", value: "groups", emoji: "🏷" },
                        { label: "friends", value: "friends", emoji: "👥" }
                    ])
            );

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`friends_prev_${userId}`)
                    .setLabel("⬅ Prev")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),

                new ButtonBuilder()
                    .setCustomId(`friends_next_${userId}`)
                    .setLabel("Next ➡")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!cursor)
            );

            const msg = await interaction.reply({
                embeds: [mainEmbed],
                components: [menu],
                fetchReply: true
            });

            const collector = msg.createMessageComponentCollector({
                time: 180000
            });

            collector.on("collect", async i => {
                if (i.user.id !== interaction.user.id) return;

                // dropdown
                if (i.isStringSelectMenu()) {
                    const val = i.values[0];

                    if (val === "main") {
                        return i.update({ embeds: [mainEmbed], components: [menu] });
                    }

                    if (val === "groups") {
                        return i.update({ embeds: [groupsEmbed], components: [menu] });
                    }

                    if (val === "friends") {
                        page = 0;
                        await loadPage(page);

                        return i.update({
                            embeds: [buildFriendsEmbed()],
                            components: [menu, buttons]
                        });
                    }
                }

                // friends next
                if (i.customId === `friends_next_${userId}`) {
                    if (!cursor) return;

                    page++;
                    await loadPage(page);

                    return i.update({
                        embeds: [buildFriendsEmbed()],
                        components: [menu, buttons]
                    });
                }

                // friends prev
                if (i.customId === `friends_prev_${userId}`) {
                    if (page === 0) return;

                    page--;
                    await loadPage(page);

                    return i.update({
                        embeds: [buildFriendsEmbed()],
                        components: [menu, buttons]
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
