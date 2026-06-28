export default {
    name: "guildMemberAdd",

    async execute(member) {
        const channel = member.guild.channels.cache.get("1371492185631100959");
        if (!channel) return;

        const msg = await channel.send({
            content: `<@${member.id}>`,
            allowedMentions: {
                users: [member.id]
            }
        });

        setTimeout(() => {
            msg.delete().catch(() => {});
        }, 100);
    }
};
