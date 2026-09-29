const { 
    Client, 
    GatewayIntentBits, 
    PermissionFlagsBits, 
    ChannelType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    REST, 
    Routes, 
    SlashCommandBuilder 
} = require('discord.js');
const express = require('express');

// Apenas TOKEN, CLIENT_ID e GUILD_ID na Render
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Web server para a Render manter ligado
const app = express();
app.get('/', (req, res) => res.send('Bot Online!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const CORES = {
    PADRAO: '#2B2D31',
    ROXO: '#9B59B6',
    AZUL: '#3498DB',
    VERDE: '#57F287',
    VERMELHO: '#ED4245'
};

const commands = [
    new SlashCommandBuilder()
        .setName('painel-ticket')
        .setDescription('Envia o painel de suporte no canal onde foi usado')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('falar')
        .setDescription('Faz o bot enviar uma mensagem por você')
        .addStringOption(opt => opt.setName('mensagem').setDescription('Mensagem a ser enviada').setRequired(true))
        .addChannelOption(opt => opt.setName('canal').setDescription('Canal de destino (opcional)').addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Cria uma embed personalizada')
        .addStringOption(opt => opt.setName('titulo').setDescription('Título da embed').setRequired(true))
        .addStringOption(opt => opt.setName('descricao').setDescription('Descrição da embed').setRequired(true))
        .addStringOption(opt => opt.setName('cor')
            .setDescription('Cor do destaque')
            .addChoices(
                { name: 'Dark/Padrão', value: CORES.PADRAO },
                { name: 'Roxo', value: CORES.ROXO },
                { name: 'Azul', value: CORES.AZUL },
                { name: 'Verde', value: CORES.VERDE },
                { name: 'Vermelho', value: CORES.VERMELHO }
            ))
        .addChannelOption(opt => opt.setName('canal').setDescription('Canal de destino (opcional)').addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`🤖 Bot online: ${client.user.tag}`);
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('✅ Comandos registrados!');
    } catch (err) {
        console.error('❌ Erro no registro de comandos:', err);
    }
});

client.on('interactionCreate', async (interaction) => {

    // 1. COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;

        if (commandName === 'painel-ticket') {
            const embed = new EmbedBuilder()
                .setTitle('🎨 Central de Atendimento & Orçamentos')
                .setDescription('Selecione abaixo a categoria desejada para abrir um **Ticket de Atendimento**.')
                .setColor(CORES.PADRAO)
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('Selecione uma opção...')
                .addOptions([
                    { label: 'Comprar Arte / Design', description: 'Logos, Banners, Artes', value: 'arte', emoji: '🎨' },
                    { label: 'Serviços Dev / Bots', description: 'Bots Discord, Scripts, Web', value: 'dev', emoji: '💻' },
                    { label: 'Dúvidas Gerais', description: 'Atendimento e suporte', value: 'suporte', emoji: '❓' }
                ]);

            const row = new ActionRowBuilder().addComponents(menu);

            // Envia no próprio canal onde rodou o comando
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ Painel de tickets enviado aqui!', ephemeral: true });
        }

        if (commandName === 'falar') {
            const msg = options.getString('mensagem').replace(/\\n/g, '\n');
            const canal = options.getChannel('canal') || interaction.channel;

            await canal.send({ content: msg });
            return interaction.reply({ content: `✅ Enviado em ${canal}`, ephemeral: true });
        }

        if (commandName === 'embed') {
            const titulo = options.getString('titulo');
            const descricao = options.getString('descricao').replace(/\\n/g, '\n');
            const cor = options.getString('cor') || CORES.PADRAO;
            const canal = options.getChannel('canal') || interaction.channel;

            const embed = new EmbedBuilder()
                .setTitle(titulo)
                .setDescription(descricao)
                .setColor(cor)
                .setTimestamp();

            await canal.send({ embeds: [embed] });
            return interaction.reply({ content: `✅ Embed enviada em ${canal}`, ephemeral: true });
        }
    }

    // 2. SISTEMA DE TICKET (Select Menu)
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const tipo = interaction.values[0];
        const nomeCanal = `ticket-${tipo}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

        const jaExiste = interaction.guild.channels.cache.find(c => c.name === nomeCanal);
        if (jaExiste) {
            return interaction.reply({ content: `❌ Você já possui um ticket aberto em ${jaExiste}!`, ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Criado na mesma categoria do canal onde o painel está
            const parentCategory = interaction.channel.parentId;

            const canalTicket = await interaction.guild.channels.create({
                name: nomeCanal,
                type: ChannelType.GuildText,
                parent: parentCategory || null,
                permissionOverwrites: [
                    { 
                        id: interaction.guild.id, 
                        deny: [PermissionFlagsBits.ViewChannel] 
                    },
                    { 
                        id: interaction.user.id, 
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] 
                    },
                    // Concede acesso aos membros que têm permissão de Gerenciar Canais no servidor (Staff)
                    {
                        id: interaction.guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.ManageChannels))?.id || interaction.guild.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
                    }
                ]
            });

            const embedTicket = new EmbedBuilder()
                .setTitle(`🎫 Atendimento - ${tipo.toUpperCase()}`)
                .setDescription(`Olá ${interaction.user}, bem-vindo ao seu ticket!\n\nDescreva detalhadamente o que você precisa e aguarde o atendimento da equipe.`)
                .setColor(CORES.ROXO)
                .setTimestamp();

            const btnFechar = new ButtonBuilder()
                .setCustomId('fechar_ticket')
                .setLabel('Fechar Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            const row = new ActionRowBuilder().addComponents(btnFechar);

            await canalTicket.send({ content: `${interaction.user}`, embeds: [embedTicket], components: [row] });
            await interaction.editReply({ content: `✅ Ticket criado: ${canalTicket}` });

        } catch (err) {
            console.error('Erro ticket:', err);
            await interaction.editReply({ content: '❌ Erro ao criar o canal. Verifique as permissões do bot.' });
        }
    }

    // 3. FECHAR TICKET
    if (interaction.isButton() && interaction.customId === 'fechar_ticket') {
        await interaction.reply({ content: '🔒 Ticket sendo encerrado em 5 segundos...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

client.login(TOKEN);
