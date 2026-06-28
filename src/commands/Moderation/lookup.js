import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("lookup")
        .setDescription("Look up a moderation case or user history")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("User to look up")
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("case")
                .setDescription("Case ID to look up")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    category: "moderation",

    async execute(interaction, config, client) {
        try {

            // ✅ FIX: prevents "thinking forever"
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser("user");
            const caseId = interaction.options.getString("case");

            let result;

            // 🔎 CASE LOOKUP
            if (caseId) {
                result = await ModerationService.getCase(caseId);
            }

            // 👤 USER LOOKUP
            else if (user) {
                result = await ModerationService.getUserCases(user.id, interaction.guild.id);
            }

            else {
                return interaction.editReply({
                    embeds: [
                        createEmbed(
                            "❌ Missing Input",
                            "You must provide either a **user** or a **case ID**.",
                            "error"
                        )
                    ]
                });
            }

            if (!result) {
                return interaction.editReply({
                    embeds: [
                        createEmbed(
                            "🔍 No Results",
                            "No moderation data found.",
                            "warning"
                        )
                    ]
                });
            }

            // 📦 CASE RESULT
            if (caseId) {
                return interaction.editReply({
                    embeds: [
                        createEmbed(
                            `📄 Case #${caseId}`,
                            `**Action:** ${result.action}\n**User:** <@${result.userId}>\n**Moderator:** <@${result.moderatorId}>\n**Reason:** ${result.reason}\n**Date:** ${result.date}`,
                            "info"
                        )
                    ]
                });
            }

            // 👤 USER RESULT
            const casesText = result
                .slice(0, 10)
                .map(c =>
                    `**#${c.caseId}** | ${c.action} | ${c.reason}`
                )
                .join("\n");

            return interaction.editReply({
                embeds: [
                    createEmbed(
                        `🔎 User Lookup: ${user.tag}`,
                        casesText || "No moderation history found.",
                        "info"
                    )
                ]
            });

        } catch (error) {
            logger.error('Lookup command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'lookup_failed' });
        }
    },
};
