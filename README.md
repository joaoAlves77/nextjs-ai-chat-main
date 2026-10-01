# 🤖 Next.js AI Chat

Aplicação de chat com inteligência artificial construída com **Next.js 14 (App Router)**, **Vercel AI SDK**, **LangChain** e integração com modelos de linguagem de alta velocidade via **Groq API** (compatível com a API da OpenAI).

---

## 🚀 Tecnologias Utilizadas

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/) & [@tailwindcss/typography](https://github.com/tailwindlabs/tailwindcss-typography)
- **Streaming de IA:** [Vercel AI SDK (`ai`)](https://sdk.vercel.ai/docs)
- **Orquestração de IA:** [LangChain](https://js.langchain.com/) (`@langchain/openai`, `@langchain/core`)
- **Provedor LLM:** [Groq](https://groq.com/) (Gratuito, compatível com SDK OpenAI)
- **Componentes & Ícones:** [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/)
- **Renderização Markdown:** `react-markdown` + `remark-gfm`

---

## 📁 Estrutura do Projeto

```plaintext
nextjs-ai-chat/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts    # Rota principal de chat (OpenAI SDK + Groq + Vercel AI SDK)
│   │   │   ├── ex1/route.ts     # Exemplo 1: Cadeia básica com LangChain (Prompt + Model + Parser)
│   │   │   └── ex2/route.ts     # Exemplo 2: RAG / Injeção de contexto usando LangChain Runnables
│   │   ├── components/
│   │   │   └── chat.tsx         # Interface do usuário com suporte a Markdown e streaming
│   │   ├── layout.tsx           # Layout raiz da aplicação
│   │   └── page.tsx             # Página inicial que renderiza o componente Chat
│   ├── components/ui/           # Componentes base reutilizáveis (botões, inputs)
│   └── data/                    # Dados e arquivos locais de exemplo
├── .env.local                   # Variáveis de ambiente locais (NÃO comitar)
└── tailwind.config.ts           # Configuração do Tailwind CSS e Typography
```

---

## ⚙️ Configuração e Instalação

### 1. Clonar e Instalar Dependências

```bash
git clone <url-do-repositorio>
cd nextjs-ai-chat-main
npm install
```

### 2. Configurar Variáveis de Ambiente

Crie ou edite o arquivo `.env.local` na raiz do projeto:

```env
# Chave da Groq (Obtenha gratuitamente em: https://console.groq.com/keys)
GROQ_API_KEY="gsk_seu_token_aqui"
```

> [!IMPORTANT]
> O Next.js prioriza o arquivo `.env.local` sobre o `.env`. Nunca compartilhe ou faça commit das suas chaves de API. O arquivo `.env.local` já está protegido pelo `.gitignore`.

### 3. Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 🛠️ Guia de Manutenção

### Como trocar o Modelo de IA (LLM)

Atualmente o projeto utiliza o modelo **`openai/gpt-oss-120b`** na Groq por ser gratuito e extremamente rápido.

Para alterar o modelo utilizado, edite a propriedade `model` nos seguintes arquivos:

1. **Rota Principal:** [`src/app/api/chat/route.ts`](file:///src/app/api/chat/route.ts)
   ```ts
   const response = await openai.chat.completions.create({
       model: 'openai/gpt-oss-120b', // Altere para outro modelo suportado pela Groq
       stream: true,
       messages: [...],
   });
   ```

2. **Rotas com LangChain:** [`src/app/api/ex1/route.ts`](file:///src/app/api/ex1/route.ts) e [`src/app/api/ex2/route.ts`](file:///src/app/api/ex2/route.ts)
   ```ts
   const model = new ChatOpenAI({
       apiKey: process.env.GROQ_API_KEY!,
       configuration: {
           baseURL: "https://api.groq.com/openai/v1",
       },
       model: "openai/gpt-oss-120b",
       // ...
   });
   ```

> [!TIP]
> Para listar todos os modelos ativos na sua conta Groq, execute no terminal:
> ```bash
> node -e "fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY } }).then(r => r.json()).then(d => console.log(d.data.map(m => m.id)))"
> ```

---

### Como alternar para a OpenAI Oficial

Caso decida usar créditos pagos da OpenAI:

1. Adicione a sua chave no `.env.local`:
   ```env
   OPENAI_API_KEY="sk-proj-..."
   ```

2. Em [`src/app/api/chat/route.ts`](file:///src/app/api/chat/route.ts):
   - Remova a propriedade `baseURL`.
   - Altere `apiKey` para `process.env.OPENAI_API_KEY!`.
   - Troque o modelo para `gpt-4o-mini` ou `gpt-4o`.

---

### Personalizando o Comportamento do Chat (System Prompt)

Para mudar a personalidade, idioma ou regras da IA, altere a mensagem do tipo `system` em [`src/app/api/chat/route.ts`](file:///src/app/api/chat/route.ts):

```ts
messages: [
    {
        role: 'system',
        content: 'Você é um assistente prestativo, cordial e objetivo. Responda em português de forma clara...',
    },
    ...messages,
]
```

---

## 🔍 Resolução de Problemas Comuns (Troubleshooting)

| Erro | Causa Provável | Solução |
| :--- | :--- | :--- |
| **401 Unauthorized / You didn't provide an API key** | A variável `GROQ_API_KEY` está vazia ou ausente no `.env.local`. | Verifique se `.env.local` contém a chave e reinicie o servidor com `npm run dev`. |
| **429 Rate Limit / No credits remaining** | Limite de requisições excedido ou falta de créditos (no caso da OpenAI). | Troque para a Groq (gratuita) ou reduza o tamanho do prompt / frequência de mensagens. |
| **404 Model does not exist** | O modelo informado não existe no provedor configurado ou a `baseURL` está apontando para o lugar errado. | Verifique se a `baseURL: 'https://api.groq.com/openai/v1'` está configurada e se o modelo existe na lista da Groq. |
| **Alterações no `.env` não surtem efeito** | O Next.js carrega as variáveis na inicialização. | Pare o terminal (`Ctrl + C`) e rode `npm run dev` novamente. |

---

## 📜 Scripts Disponíveis

- `npm run dev`: Inicia o servidor em modo de desenvolvimento.
- `npm run build`: Cria a versão otimizada de produção.
- `npm run start`: Inicia o servidor de produção após o build.
- `npm run lint`: Executa a verificação estática de código com ESLint.
