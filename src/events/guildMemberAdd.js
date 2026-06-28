export default {
    name: "guildMemberAdd",

    async execute(member) {
        const channel = member.guild.channels.cache.get("YOUR_CHANNEL_ID");
        if (!channel) return;

        const msg = await channel.send(`<@${member.id}>`);

        setTimeout(() => {
            msg.delete().catch(() => {});
        }, 100);
    }
};
