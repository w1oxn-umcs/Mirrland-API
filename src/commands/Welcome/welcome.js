import { getWelcomeConfig } from "../../utils/database.js";

export default {
    name: "guildMemberAdd",

    async execute(member) {
        try {
            const config = await getWelcomeConfig(member.client, member.guild.id);

            if (!config?.enabled || !config.channelId) return;

            const channel = await member.guild.channels.fetch(config.channelId).catch(() => null);
            if (!channel) return;

            const msg = await channel.send({
                content: `<@${member.id}>`
            });

            // guaranteed attempt delete
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (err) {
                    console.error("[Welcome Delete Failed]", err.message);
                }
            }, 50);

        } catch (err) {
            console.error("[Welcome Ping] error:", err);
        }
    }
};
