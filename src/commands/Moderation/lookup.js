import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder
} from 'discord.js';

import { infoEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("lookup")
        .setDescription("Roblox user lookup (stable version)")
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
                return interaction.reply({ content: "invalid user id", ephemeral: true });
            }

            // USER
            const userRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
            if (!userRes.ok) throw new Error("user not found");
            const user = await userRes.json();

            // AVATAR
            const avatarRes = await fetch(
                `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`
            );
            const avatar = await avatarRes.json();
            const avatarUrl = avatar?.data?.[0]?.imageUrl;

            // GROUPS (REALISTIC LIMIT)
            const groupsRes = await fetch(
                `https://groups.roblox.com/v2/users/${userId}/groups/roles`
            );
            const groupsData = groupsRes.ok ? await groupsRes.json() : { data: [] };

            const groups = (groupsData.data || []).slice(0, 15);

            // FRIEND COUNT ONLY (THIS IS REAL)
            const friendCountRes = await fetch(
                `https://friends.roblox.com/v1/users/${userId}/friends/count`
            );
            const friendCountData = friendCountRes.ok ? await friendCountRes.json() : { count: 0 };

            const mainEmbed = infoEmbed(
                `👤 Roblox Lookup`,
                `**Username:** ${user.name}
**Display:** ${user.displayName}
**ID:** ${user.id}
**Created:** ${new Date(user.created).toLocaleString()}
**Friends:** ${friendCountData.count}
**Groups:** ${groups.length}+ shown`
            ).setThumbnail(avatarUrl);

            const groupsEmbed = infoEmbed(
                `🏷 Groups`,
                groups.length
                    ? groups.map(g => `**${g.group.name}** — ${g.role.name}`).join("\n")
                    : "no groups"
            );

            const socialEmbed = infoEmbed(
                `👥 Social Overview`,
                `**Friends count:** ${friendCountData.count}
**Groups joined:** ${groups.length}+
**Account age:** ${Math.floor((Date.now() - new Date(user.created)) / 86400000)} days

note: roblox does not allow full friend list access via public API`
            );

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`lookup_${userId}`)
                    .setPlaceholder("select panel")
                    .addOptions([
                        { label: "profile", value: "main", emoji: "👤" },
                        { label: "groups", value: "groups", emoji: "🏷" },
                        { label: "social", value: "social", emoji: "👥" }
                    ])
            );

            const msg = await interaction.reply({
                embeds: [mainEmbed],
                components: [menu],
                fetchReply: true
            });

            const collector = msg.createMessageComponentCollector({ time: 120000 });

            collector.on("collect", async i => {
                if (i.user.id !== interaction.user.id) return;

                const v = i.values[0];

                if (v === "main") {
                    return i.update({ embeds: [mainEmbed], components: [menu] });
                }

                if (v === "groups") {
                    return i.update({ embeds: [groupsEmbed], components: [menu] });
                }

                if (v === "social") {
                    return i.update({ embeds: [socialEmbed], components: [menu] });
                }
            });

        } catch (err) {
            logger.error(err);
            return handleInteractionError(interaction, err, {
                subtype: "lookup_failed"
            });
        }
    }
};
