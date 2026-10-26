import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { decodeUserContent } from '@/lib/chat-media';

export const runtime = 'edge';

const TEXT_MODEL = 'openai/gpt-oss-120b';
const VISION_MODEL = 'qwen/qwen3.8-27b';
const MAX_VISION_IMAGES = 3;

const TEXT_SYSTEM = 'Você é um consultor de visagismo, cordial e objetivo. Responda em português, em Markdown claro. Se a pessoa pedir uma avaliação pessoal e não houver foto, peça uma imagem nítida do rosto, de frente e com boa luz. Sem foto, explique o conceito e as opções, sem inventar o formato do rosto dela.';

const VISAGISMO_SYSTEM = `Você é um consultor de visagismo. O usuário envia uma foto do próprio rosto junto com um pedido em texto. Avalie somente o que estiver visível na foto e responda em português, em Markdown, com tópicos e negrito.

Analise, quando a foto permitir:
- formato do rosto
- proporções da testa, das maçãs, da mandíbula e do queixo
- olhos, sobrancelhas, nariz, lábios e cabelo visível
- recomendações de corte, franja, barba ou bigode quando fizer sentido, maquiagem, armação de óculos e cores que harmonizam
- o que evitar

Siga o pedido escrito pelo usuário quando ele pedir só uma parte dessa análise. Não invente detalhes que a foto não mostra. Se o rosto não estiver nítido ou de frente, diga isso antes de sugerir. Não faça diagnóstico médico e não determine idade, etnia ou saúde. Seja respeitoso e direto.`;

const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY!,
    baseURL: 'https://api.groq.com/openai/v1',
});

type IncomingMessage = {
    role: string;
    content?: string;
};

type OutgoingMessage = OpenAI.Chat.ChatCompletionMessageParam;

export async function POST(req: Request) {
    const { messages } = await req.json() as { messages?: IncomingMessage[] };
    const history = Array.isArray(messages) ? messages : [];
    const conversation = history.filter((message) => message.role === 'user' || message.role === 'assistant');
    const hasImages = conversation.some((message) => message.role === 'user' && decodeUserContent(message.content ?? '').images.length > 0);

    const response = await openai.chat.completions.create({
        model: hasImages ? VISION_MODEL : TEXT_MODEL,
        stream: true,
        max_tokens: hasImages ? 1800 : 1200,
        messages: hasImages
            ? [{ role: 'system', content: VISAGISMO_SYSTEM }, ...toVisionMessages(conversation)]
            : [
                { role: 'system', content: TEXT_SYSTEM },
                ...conversation.map((message) => ({
                    role: message.role as 'user' | 'assistant',
                    content: message.role === 'user'
                        ? decodeUserContent(message.content ?? '').text
                        : message.content ?? '',
                })),
            ],
    });

    return new StreamingTextResponse(OpenAIStream(response));
}

function toVisionMessages(messages: IncomingMessage[]): OutgoingMessage[] {
    const decoded = messages.map((message) => {
        if (message.role !== 'user') {
            return { role: message.role, text: message.content ?? '', images: [] as string[] };
        }
        return { role: message.role, ...decodeUserContent(message.content ?? '') };
    });

    const selected = decoded.map(() => [] as string[]);
    let remaining = MAX_VISION_IMAGES;
    for (let index = decoded.length - 1; index >= 0 && remaining > 0; index -= 1) {
        const images = decoded[index].images.slice(0, remaining);
        selected[index] = images;
        remaining -= images.length;
    }

    return decoded.flatMap((message, index): OutgoingMessage[] => {
        const images = selected[index];
        if (message.role === 'user' && images.length) {
            const text = message.text.trim() || 'Avalie esta foto conforme o visagismo.';
            return [{
                role: 'user',
                content: [
                    { type: 'text', text },
                    ...images.map((url) => ({
                        type: 'image_url' as const,
                        image_url: { url, detail: 'high' as const },
                    })),
                ],
            }];
        }

        const text = message.text.trim();
        if (!text) return [];
        return [{ role: message.role as 'user' | 'assistant', content: text }];
    });
}
