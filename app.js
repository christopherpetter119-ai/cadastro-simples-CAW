
// ==========================================
// CADASTRO SIMPLES
// AUTENTICAÇÃO E GERENCIAMENTO DE CONTATOS
// ==========================================

// Conexão com Supabase
const { createClient } = window.supabase;

// Armazenamento temporário da sessão.
// A sessão não será mantida após recarregar a página.
const memoria = {
    dados: {},

    getItem(chave) {
        return this.dados[chave] ?? null;
    },

    setItem(chave, valor) {
        this.dados[chave] = valor;
    },

    removeItem(chave) {
        delete this.dados[chave];
    }
};

const banco = createClient(
    window.APP_CONFIG.url,
    window.APP_CONFIG.key,
    {
        auth: {
            storage: memoria,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    }
);


// ==========================================
// ELEMENTOS DA PÁGINA
// ==========================================

const telaLogin = document.getElementById("tela-login");
const telaSistema = document.getElementById("tela-sistema");

const formLogin = document.getElementById("form-login");
const formContato = document.getElementById("form-contato");

const loginEmail = document.getElementById("login-email");
const loginSenha = document.getElementById("login-senha");

const nome = document.getElementById("nome");
const email = document.getElementById("email");
const telefone = document.getElementById("telefone");
const contatoId = document.getElementById("contato-id");

const listaContatos = document.getElementById("lista-contatos");
const listaRelatorio = document.getElementById("lista-relatorio");

const pesquisa = document.getElementById("pesquisa");

const mensagemLogin = document.getElementById("mensagem-login");
const mensagemContato = document.getElementById("mensagem-contato");
const mensagemLista = document.getElementById("mensagem-lista");

const totalContatos = document.getElementById("total-contatos");


// ==========================================
// VARIÁVEIS DO SISTEMA
// ==========================================

let contatos = [];
let usuarioAtual = null;


// ==========================================
// MENSAGENS
// ==========================================

function mostrarMensagem(elemento, texto, tipo = "") {
    elemento.textContent = texto;
    elemento.className = "mensagem";

    if (tipo) {
        elemento.classList.add(tipo);
    }
}


// ==========================================
// AUTENTICAÇÃO
// ==========================================

// Entrar no sistema
formLogin.addEventListener("submit", async function(evento) {

    evento.preventDefault();

    mostrarMensagem(mensagemLogin, "Verificando acesso...");

    const { data, error } = await banco.auth.signInWithPassword({
        email: loginEmail.value.trim(),
        password: loginSenha.value
    });

    if (error) {
        mostrarMensagem(
            mensagemLogin,
            "E-mail ou senha incorretos. Tente novamente.",
            "erro"
        );

        return;
    }

    usuarioAtual = data.user;

    loginSenha.value = "";

    abrirSistema();

});


// Abrir painel
function abrirSistema() {

    telaLogin.hidden = true;
    telaSistema.hidden = false;

    document.getElementById("usuario-email").textContent =
        usuarioAtual.email;

    document.querySelector(".avatar").textContent =
        usuarioAtual.email.charAt(0).toUpperCase();

    carregarContatos();

}


// Sair do sistema
document.getElementById("btn-sair").addEventListener("click", async function() {

    const { error } = await banco.auth.signOut();

    if (error) {
        alert("Não foi possível sair da conta: " + error.message);
        return;
    }

    usuarioAtual = null;
    contatos = [];

    telaSistema.hidden = true;
    telaLogin.hidden = false;

    formLogin.reset();
    limparFormulario();

    listaContatos.replaceChildren();
    listaRelatorio.replaceChildren();

    totalContatos.textContent = "0";

});


// ==========================================
// CADASTRAR E ALTERAR CONTATOS
// ==========================================

formContato.addEventListener("submit", async function(evento) {

    evento.preventDefault();

    if (!usuarioAtual) {
        mostrarMensagem(
            mensagemContato,
            "Faça login novamente para continuar.",
            "erro"
        );
        return;
    }

    const dados = {
        nome: nome.value.trim(),
        email: email.value.trim(),
        telefone: telefone.value.trim()
    };

    if (!dados.nome || !dados.email || !dados.telefone) {
        mostrarMensagem(
            mensagemContato,
            "Preencha todos os campos.",
            "erro"
        );
        return;
    }

    const id = contatoId.value;

    let resultado;

    if (id) {

        // ALTERAR CONTATO
        resultado = await banco
            .from("contatos")
            .update({
                nome: dados.nome,
                email: dados.email,
                telefone: dados.telefone,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select();

    } else {

        // CADASTRAR CONTATO
        resultado = await banco
            .from("contatos")
            .insert({
                user_id: usuarioAtual.id,
                nome: dados.nome,
                email: dados.email,
                telefone: dados.telefone
            })
            .select();

    }

    if (resultado.error) {

        mostrarMensagem(
            mensagemContato,
            "Erro ao salvar: " + resultado.error.message,
            "erro"
        );

        return;
    }

    if (!resultado.data || resultado.data.length === 0) {

        mostrarMensagem(
            mensagemContato,
            "Não foi possível confirmar a operação. Verifique suas permissões.",
            "erro"
        );

        return;
    }

    mostrarMensagem(
        mensagemContato,
        id ? "Contato alterado com sucesso!" : "Contato cadastrado com sucesso!",
        "sucesso"
    );

    limparFormulario();

    await carregarContatos();

});


// ==========================================
// LIMPAR FORMULÁRIO
// ==========================================

function limparFormulario() {

    formContato.reset();
    contatoId.value = "";

    document.getElementById("btn-salvar").textContent =
        "Salvar contato";

    mostrarMensagem(mensagemContato, "");

}


// Botão limpar/cancelar
document.getElementById("btn-cancelar").addEventListener("click", function() {

    limparFormulario();

});


// ==========================================
// CONSULTAR CONTATOS
// ==========================================

async function carregarContatos() {

    mostrarMensagem(mensagemLista, "Carregando contatos...");

    const { data, error } = await banco
        .from("contatos")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {

        mostrarMensagem(
            mensagemLista,
            "Erro ao consultar contatos: " + error.message,
            "erro"
        );

        return;
    }

    contatos = data || [];

    atualizarTela();

    mostrarMensagem(mensagemLista, "");

}


// ==========================================
// PESQUISAR E FILTRAR
// ==========================================

function obterContatosFiltrados() {

    const termo = pesquisa.value.trim().toLowerCase();

    return contatos.filter(function(contato) {

        return (
            contato.nome.toLowerCase().includes(termo) ||
            contato.email.toLowerCase().includes(termo) ||
            contato.telefone.toLowerCase().includes(termo)
        );

    });

}


// Pesquisa automática
pesquisa.addEventListener("input", function() {

    atualizarTela();

});


// Botão pesquisar
document.getElementById("btn-pesquisar").addEventListener("click", function() {

    atualizarTela();

});


// ==========================================
// ATUALIZAR TABELAS E CONTADORES
// ==========================================

function atualizarTela() {

    const filtrados = obterContatosFiltrados();

    renderizarContatos(filtrados);

    renderizarRelatorio(filtrados);

    totalContatos.textContent = contatos.length;

}


// ==========================================
// EXIBIR CONTATOS NA TABELA
// ==========================================

function renderizarContatos(registros) {

    listaContatos.replaceChildren();

    if (registros.length === 0) {

        const linha = document.createElement("tr");
        const celula = document.createElement("td");

        celula.colSpan = 4;
        celula.textContent = "Nenhum contato encontrado.";

        linha.appendChild(celula);
        listaContatos.appendChild(linha);

        return;
    }

    registros.forEach(function(contato) {

        const linha = document.createElement("tr");

        const celulas = [
            contato.nome,
            contato.email,
            contato.telefone
        ];

        celulas.forEach(function(valor) {

            const celula = document.createElement("td");

            celula.textContent = valor;

            linha.appendChild(celula);

        });

        const celulaAcoes = document.createElement("td");

        const botaoEditar = document.createElement("button");

        botaoEditar.textContent = "Editar";
        botaoEditar.className = "btn-editar";

        botaoEditar.addEventListener("click", function() {

            editarContato(contato.id);

        });

        celulaAcoes.appendChild(botaoEditar);

        linha.appendChild(celulaAcoes);

        listaContatos.appendChild(linha);

    });

}


// ==========================================
// EDITAR CONTATO
// ==========================================

function editarContato(id) {

    const contato = contatos.find(function(item) {

        return String(item.id) === String(id);

    });

    if (!contato) {
        return;
    }

    contatoId.value = contato.id;

    nome.value = contato.nome;
    email.value = contato.email;
    telefone.value = contato.telefone;

    document.getElementById("btn-salvar").textContent =
        "Salvar alterações";

    mostrarMensagem(
        mensagemContato,
        "Editando contato: " + contato.nome,
        "sucesso"
    );

    document.getElementById("cadastro").scrollIntoView({
        behavior: "smooth"
    });

}


// ==========================================
// RELATÓRIO
// ==========================================

function renderizarRelatorio(registros) {

    listaRelatorio.replaceChildren();

    document.getElementById("total-relatorio").textContent =
        "Total de registros: " + registros.length;

    document.getElementById("data-relatorio").textContent =
        "Data de emissão: " +
        new Date().toLocaleString("pt-BR");

    if (registros.length === 0) {

        const linha = document.createElement("tr");
        const celula = document.createElement("td");

        celula.colSpan = 3;
        celula.textContent = "Nenhum registro encontrado.";

        linha.appendChild(celula);
        listaRelatorio.appendChild(linha);

        return;
    }

    registros.forEach(function(contato) {

        const linha = document.createElement("tr");

        [contato.nome, contato.email, contato.telefone]
            .forEach(function(valor) {

                const celula = document.createElement("td");

                celula.textContent = valor;

                linha.appendChild(celula);

            });

        listaRelatorio.appendChild(linha);

    });

}


// ==========================================
// IMPRIMIR OU SALVAR COMO PDF
// ==========================================

document.getElementById("btn-imprimir").addEventListener("click", function() {

    window.print();

});


// ==========================================
// NAVEGAÇÃO DO MENU
// ==========================================

document.querySelectorAll(".sidebar nav a").forEach(function(link) {

    link.addEventListener("click", function() {

        document.querySelectorAll(".sidebar nav a")
            .forEach(function(item) {

                item.classList.remove("menu-ativo");

            });

        this.classList.add("menu-ativo");

    });

});


// ==========================================
// VERIFICAR SESSÃO AO INICIAR
// ==========================================

async function iniciarSistema() {

    const { data, error } = await banco.auth.getSession();

    if (error) {

        mostrarMensagem(
            mensagemLogin,
            "Erro ao verificar sessão. Faça login novamente.",
            "erro"
        );

        return;
    }

    if (data.session) {

        usuarioAtual = data.session.user;

        abrirSistema();

    } else {

        telaLogin.hidden = false;
        telaSistema.hidden = true;

    }

}


// Iniciar aplicação
iniciarSistema();
