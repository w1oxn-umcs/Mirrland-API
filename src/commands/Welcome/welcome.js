import { getWelcomeConfig } from "../../utils/database.js";

export default {
    name: "guildMemberAdd",

    async execute(member, client) {
        try {
            const config = await getWelcomeConfig(client, member.guild.id);

            if (!config?.enabled || !config.channelId) return;

            const channel = member.guild.channels.cache.get(config.channelId);
            if (!channel) return;

            const content = config.welcomePing
                ? `<@${member.id}>`
                : null;

            const msg = await channel.send({
                content: content || config.welcomeMessage?.replace("{user}", member.user.username)
            });

            // if ping mode → delete instantly
            if (config.welcomePing) {
                setImmediate(() => {
                    msg.delete().catch(() => {});
                });
            }

        } catch (err) {
            console.error("[Welcome] error:", err);
        }
    }
};
