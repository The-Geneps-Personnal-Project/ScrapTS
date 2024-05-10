import { ChatInputCommandInteraction, CommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import { MangaInfo } from "../../types/types";
import { getSiteFromName, getMangaFromName, addManga, addSiteToManga } from "../../database/sqlite/database";
import { createSite } from "../../database/sqlite/seed";
import { Command } from "../classes/command";

async function site(interaction: CommandInteraction): Promise<void> {
    try {
        const url = interaction.options.get('url')?.value as string;
        const existingSite = await getSiteFromName(url.split("/")[2].split(".")[0]);
        if (existingSite.length > 0) throw new Error("Site already exists");

        await createSite(url);
        await interaction.editReply(`Added ${url.split("/")[2]} to the list.`);
    } catch (error) {
        await interaction.editReply((error as Error).message)
    }
}

async function manga(interaction: CommandInteraction): Promise<void> {
    try {
        const manga: MangaInfo = {
            anilist_id: interaction.options.get('anilist_id')?.value as number,
            chapter: interaction.options.get('chapter')?.value as string,
            name: interaction.options.get('name')?.value as string,
            sites: await getSiteFromName(interaction.options.get('site')?.value as string),
        };
        const existingManga = await getMangaFromName(manga.name);
        if (existingManga.length > 0) throw new Error("Manga already exists");

        await addManga(manga);
    } catch (error) {
        await interaction.editReply((error as Error).message);
    }
}

async function siteToManga(interaction: CommandInteraction): Promise<void> {
    try {
        const manga = interaction.options.get('manga')?.value as string;
        const site = interaction.options.get('site')?.value as string;
        const existingManga = await getMangaFromName(manga);
        if (existingManga.length === 0) throw new Error("Manga does not exist");
        const existingSite = await getSiteFromName(site);
        if (existingSite.length === 0) throw new Error("Site does not exist");

        await addSiteToManga(existingSite[0], existingManga[0]);
        await interaction.editReply(`Added ${site} to ${manga}.`);
    } catch (error) {
        await interaction.editReply((error as Error).message)
    }
}

export default new Command({
    builder: new SlashCommandBuilder()
        .setName('create')
        .setDescription('Create a manga or a site')
        .addSubcommand(subcommand => subcommand
            .setName('manga')
            .setDescription('Add a manga to the database')
            .addNumberOption(option => option.setName('anilist_id').setDescription('The Anilist ID').setRequired(true))
            .addStringOption(option => option.setName('chapter').setDescription('The last read chapter').setRequired(true))
            .addStringOption(option => option.setName('name').setDescription('THe name of the manga').setRequired(true))
            .addStringOption(option => option.setName('site').setDescription('The site of the manga').setRequired(true))
        )
        .addSubcommand(subcommand => subcommand
            .setName('site')
            .setDescription('Add a site to the database')
            .addStringOption(option => option.setName('url').setDescription('The url of the site').setRequired(true))
        )
        .addSubcommand(subcommand => subcommand
            .setName('site_to_manga')
            .setDescription('Add a site to a manga')
            .addStringOption(option => option.setName('manga').setDescription('The name of the manga').setRequired(true))
            .addStringOption(option => option.setName('site').setDescription('The name of the site').setRequired(true))
        ) as SlashCommandBuilder,
    run: async ({client, interaction }) => {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply().catch(console.error);
        }
        const subcommand = interaction.options.getSubcommand();
        const subcommands: { [key: string]: (interaction: CommandInteraction) => Promise<void> } = {
            manga: manga,
            site: site,
            site_to_manga: siteToManga,
        };

        try {
            await subcommands[subcommand](interaction);
        } catch (error) {
            if (!interaction.replied) {
                await interaction.followUp({ content: `Error: ${(error as Error).message}`, ephemeral: true }).catch(console.error);
            } else {
                await interaction.editReply(`Error: ${(error as Error).message}`).catch(console.error);
            }
        }
    }
})