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
    RoleSelectMenuBuilder,
    REST, 
    Routes, 
    SlashCommandBuilder 
} = require('discord.js');
const express = require('express');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Servidor HTTP para manter o bot ativo na Render
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
    ROXO: '#8A2BE2',
    AZUL: '#00BFFF',
    VERDE: '#00FF7F',
    VERMELHO: '#FF4500'
};

const commands = [
    new SlashCommandBuilder()
        .setName('painel-ticket')
        .setDescription('Envia o painel principal de suporte e vendas')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('vitrine')
        .setDescription('Bloqueia o canal atual transformando-o em uma vitrine de exibição')
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
                { name: 'Dark Premium', value: CORES.PADRAO },
                { name: 'Roxo Elétrico', value: CORES.ROXO },
                { name: 'Azul Neon', value: CORES.AZUL },
                { name: 'Verde Sucesso', value: CORES.VERDE },
                { name: 'Vermelho Erro', value: CORES.VERMELHO }
            ))
        .addChannelOption(opt => opt.setName('canal').setDescription('Canal de destino (opcional)').addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('clientReady', async () => {
    console.log(`🤖 Bot online: ${client.user.tag}`);
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('✅ Comandos Slash registrados GLOBALMENTE!');
    } catch (err) {
        console.error('❌ Erro ao registrar comandos:', err);
    }
});

client.on('interactionCreate', async (interaction) => {

    // ==================== 1. COMANDOS SLASH ====================
    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;

        // /painel-ticket
        if (commandName === 'painel-ticket') {
            const embed = new EmbedBuilder()
                .setTitle('🎨 Central de Atendimento & Vendas')
                .setDescription('Seja bem-vindo(a) à nossa loja!\n\nPara iniciar o seu atendimento, selecione abaixo o departamento correspondente à sua solicitação.\n\n───\n\n📌 **Departamentos Disponíveis:**\n• ❓ **Dúvidas:** Tire suas dúvidas gerais antes de comprar.\n• 📦 **Receber Produto:** Resgate de encomendas ou pedidos concluídos.\n• 🎨 **Comprar Artes:** Orçamentos e pedidos de artes personalizadas.\n\n───')
                .setColor(CORES.ROXO)
                .setFooter({ text: `${interaction.guild.name} • Atendimento Privado`, iconURL: interaction.guild.iconURL() });

            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('✨ Clique aqui para escolher a categoria...')
                .addOptions([
                    { label: 'Dúvidas', description: 'Tire suas dúvidas gerais sobre a loja', value: 'duvidas', emoji: '❓' },
                    { label: 'Receber Produto', description: 'Resgate seus produtos e pedidos feitos', value: 'receber_produto', emoji: '📦' },
                    { label: 'Comprar Artes', description: 'Faça um orçamento de artes e designers', value: 'comprar_artes', emoji: '🎨' }
                ]);

            const row = new ActionRowBuilder().addComponents(menu);

            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ Painel de atendimento enviado com sucesso!', ephemeral: true });
        }

        // /vitrine
        if (commandName === 'vitrine') {
            try {
                await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
                    SendMessages: false,
                    SendMessagesInThreads: false,
                    CreatePublicThreads: false,
                    CreatePrivateThreads: false,
                    AttachFiles: false,
                    AddReactions: false
                });

                const embedVitrine = new EmbedBuilder()
                    .setTitle('📌 Canal Configurado como Vitrine')
                    .setDescription('Este canal foi trancado para mensagens e transformado numa **Vitrine Oficial**. Apenas membros autorizados podem publicar aqui.')
                    .setColor(CORES.AZUL)
                    .setTimestamp();

                await interaction.reply({ embeds: [embedVitrine] });
            } catch (err) {
                console.error('Erro ao configurar vitrine:', err);
                return interaction.reply({ content: '❌ Erro ao alterar as permissões do canal.', ephemeral: true });
            }
        }

        // /falar
        if (commandName === 'falar') {
            const msg = options.getString('mensagem').replace(/\\n/g, '\n');
            const canal = options.getChannel('canal') || interaction.channel;

            await canal.send({ content: msg });
            return interaction.reply({ content: `✅ Mensagem enviada em ${canal}`, ephemeral: true });
        }

        // /embed
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

    // ==================== 2. CRIAR TICKET ====================
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const tipo = interaction.values[0];
        const nomeCanal = `ticket-${tipo}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

        const jaExiste = interaction.guild.channels.cache.find(c => c.name === nomeCanal);
        if (jaExiste) {
            return interaction.reply({ content: `❌ Você já possui um ticket aberto em ${jaExiste}!`, ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
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
                    }
                ]
            });

            const titulos = {
                duvidas: '❓ Dúvidas & Suporte',
                receber_produto: '📦 Entrega de Produto',
                comprar_artes: '🎨 Orçamento de Artes'
            };

            const embedTicket = new EmbedBuilder()
                .setTitle(`🎫 ${titulos[tipo] || 'Atendimento'}`)
                .setDescription(`Olá ${interaction.user}, bem-vindo(a) ao seu ticket!\n\nPor favor, envie todas as informações sobre a sua solicitação abaixo.\n\n⚙️ **Aguarde a atribuição de um cargo responsável pela staff.**`)
                .setColor(CORES.ROXO)
                .setTimestamp();

            const btnFechar = new ButtonBuilder()
                .setCustomId('fechar_ticket')
                .setLabel('Fechar Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            // Select Menu para a Staff definir qual cargo vai atender o ticket
            const roleSelect = new RoleSelectMenuBuilder()
                .setCustomId('configurar_cargo_ticket')
                .setPlaceholder('⚙️ Staff: Selecione o cargo para dar acesso a este ticket...');

            const rowBtn = new ActionRowBuilder().addComponents(btnFechar);
            const rowRole = new ActionRowBuilder().addComponents(roleSelect);

            await canalTicket.send({ 
                content: `${interaction.user}`, 
                embeds: [embedTicket], 
                components: [rowBtn, rowRole] 
            });

            await interaction.editReply({ content: `✅ Ticket criado com sucesso: ${canalTicket}` });

        } catch (err) {
            console.error('Erro ao criar ticket:', err);
            await interaction.editReply({ content: '❌ Erro ao criar o canal do ticket. Verifique as permissões do bot.' });
        }
    }

    // ==================== 3. CONFIGURAR CARGO STAFF NO TICKET ====================
    if (interaction.isRoleSelectMenu() && interaction.customId === 'configurar_cargo_ticket') {
        const cargoId = interaction.values[0];
        const cargo = interaction.guild.roles.cache.get(cargoId);

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ Apenas membros da Staff podem definir o cargo de atendimento!', ephemeral: true });
        }

        try {
            await interaction.channel.permissionOverwrites.edit(cargoId, {
                ViewChannel: true,
                SendMessages: true,
                AttachFiles: true
            });

            await interaction.reply({ content: `✅ O cargo ${cargo} recebeu acesso a este ticket!`, ephemeral: false });
        } catch (err) {
            console.error('Erro ao adicionar cargo ao ticket:', err);
            await interaction.reply({ content: '❌ Erro ao conceder permissão ao cargo selecionado.', ephemeral: true });
        }
    }

    // ==================== 4. FECHAR TICKET ====================
    if (interaction.isButton() && interaction.customId === 'fechar_ticket') {
        await interaction.reply({ content: '🔒 Este ticket será encerrado e excluído em **5 segundos**...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

client.login(TOKEN);
