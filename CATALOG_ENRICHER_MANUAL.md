# Manual de Utilizador - Odoo Universal Importer: Catalog Enricher

**Versão 2.0** | *Atualizado em Dezembro 2025*

O **Catalog Enricher** é um sistema avançado de inteligência artificial desenhado para automatizar a criação de catálogos de produtos. Em vez de introduzir dados manualmente, o sistema "lê" o site dos seus fornecedores e constrói o seu catálogo automaticamente.

---

## 1. Visão Geral do Processo

O processo de criação de um catálogo divide-se em 4 grandes passos:

1.  **Ensinar (Dossier):** Criar um perfil para a marca (ex: Sanitana) e definir como o site funciona.
2.  **Mapear (Structure):** O sistema faz um "Scan" ao site para descobrir todas as categorias e produtos disponíveis.
3.  **Extrair (Crawler):** O robô visita cada produto e retira as informações (fotos, fichas técnicas, descrições).
4.  **Aprovar (Commit):** O utilizador revê o trabalho do robô e aprova a transferência para o catálogo final.

---

## 2. Iniciar: O Dashboard

Ao entrar no módulo **Catalog Enricher**, encontra o painel principal com três áreas:

*   **My Dossiers:** Onde gere as marcas e fornecedores.
*   **Web Catalog:** O seu catálogo local (a "base de dados limpa").
*   **Universal Robot:** Acesso direto à ferramenta de extração automática.

---

## 3. Criar um Dossier de Marca

Um **Dossier** é como uma "pasta" para cada fornecedor. Tudo o que faz para a marca "Sanitana" fica guardado no dossier "Sanitana".

1.  Vá a **Brand Dossiers** e clique em **New Dossier**.
2.  Dê um nome à marca (ex: `Bette`).
3.  Opcional: Defina cores ou notas para organização.

Dentro do Dossier, tem acesso às ferramentas principais: **Teacher** (para ensinar) e **Catalog** (para ver resultados).

---

## 4. O Robô Universal (Universal Crawler)

Esta é a ferramenta mais poderosa do sistema. Permite extrair milhares de produtos automaticamente.

### Passo A: Mapear o Site (Site Structure)
Antes de extrair, o robô precisa de saber o que existe.

1.  Abra o dossier da marca e vá à aba **Site Structure**.
2.  Insira o URL de uma categoria principal (ex: `https://www.bette.com/en/products`).
3.  Clique em **Scan Structure**.
4.  O sistema (usando IA) vai desenhar a árvore de categorias do site.
    *   *Nota:* Isto pode demorar 1-2 minutos dependendo do tamanho do site.

### Passo B: Selecionar o que quer
Não precisa de importar o site todo. Na árvore que apareceu:

*   Selecione as categorias que lhe interessam (ex: apenas "Baths" e "Washbasins").
*   O sistema calcula quantos produtos estão dentro dessas categorias.

### Passo C: Iniciar Extração (Bulk Crawl)
1.  Clique no botão **Bulk Extract** no topo.
2.  Escolha o método de extração:
    *   **Universal (AI):** O sistema tenta adivinhar tudo sozinho (bom para a maioria dos casos).
    *   **Receita Personalizada:** Se já tiver criado uma "Recipe" específica para este site.
3.  Clique em **Start Job**.

---

## 5. Monitorização e Staging (Novo na v2.0)

Quando o robô começa a trabalhar, o sistema utiliza uma metodologia segura chamada **"Staging Area"**.

### O Widget de Monitorização
Assim que inicia um trabalho, aparece um **Widget Flutuante** no canto inferior direito do ecrã.
*   Este widget acompanha-o em todas as páginas. Pode sair do dossier e ir fazer outra coisa enquanto o robô trabalha.
*   Mostra o progresso (ex: "Enriching product 45/200").
*   Botões de Controlo: **Pausa** e **Parar**.

### O Conceito de Staging (Área de Preparação)
O robô **NÃO** guarda os dados diretamente no seu catálogo final. Ele guarda numa área temporária (Staging).
*   **Porquê?** Se o robô extrair lixo ou se o site bloquear a meio, o seu catálogo principal não fica "sujo" com dados incompletos.
*   Esta área é segura e persistente. Se fechar o computador a meio, o trabalho fica guardado até onde foi feito.

---

## 6. Aprovação Final (Commit)

Quando a extração termina (chega aos 100%):

1.  O Widget muda de azul para **Verde**.
2.  Ganha um botão novo: **Commit to Catalog**.
3.  Esta é a sua "assinatura". Ao clicar em Commit:
    *   O sistema move os produtos da Área de Preparação para o **Catálogo Oficial**.
    *   Limpa a área temporária para o próximo trabalho.

> **Importante:** Se não clicar em "Commit", os produtos ficam em espera e não aparecem nas exportações finais.

---

## 7. Gerir e Exportar (Web Catalog)

Depois de fazer o "Commit", os seus produtos estão seguros no **Web Catalog**.

1.  Vá a **Web Catalog** no menu principal.
2.  Aqui pode pesquisar, filtrar e validar os dados (ver se as imagens vieram corretas, se as referências estão certas).
3.  **Exportação:**
    *   Use o botão de exportação para gerar um ficheiro CSV/Excel limpo, pronto para importar no Odoo ERP.
    *   A exportação inclui URLs das imagens, descrições e códigos.

---

## 8. Resolução de Problemas Comuns

*   **O Robô parou ou o ecrã ficou preto:**
    *   Atualize a página (F5). O sistema é resiliente e recupera o estado.
    *   Verifique se o servidor backend está a correr.
*   **O "Commit" não funciona:**
    *   Certifique-se de que a extração chegou mesmo aos 100%. O sistema protege contra commits de trabalhos a meio.
*   **Produtos Duplicados:**
    *   O sistema tem mecanismos anti-duplicação baseados no URL do produto. Se importar a mesma categoria duas vezes, ele atualiza a existente em vez de duplicar.

---

*Para suporte técnico adicional, contacte a equipa de desenvolvimento.*
