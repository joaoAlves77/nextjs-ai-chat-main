import OpenAI from 'openai';
import { OpenAIStream, StreamData, StreamingTextResponse, createStreamDataTransformer } from 'ai';
import {
    decodeUserContent,
    extractEmbeddedImages,
    parseDataUrl,
    wantsGeneratedImage,
} from '@/lib/chat-media';

export const runtime = 'edge';

const TEXT_SYSTEM = 'Você é um assistente prestativo, cordial e objetivo. Responda em português de forma clara, organizada e bem formatada em Markdown (usando tópicos, títulos e negritos de forma elegante). Evite introduções longas desnecessárias.';

const VISION_SYSTEM = `${TEXT_SYSTEM} Quando o usuário enviar imagens, observe o conteúdo visível e responda sobre ele. Não invente detalhes que não estejam na imagem.`;

const IMAGE_SYSTEM = `${TEXT_SYSTEM} Quando o usuário pedir uma imagem, inclua um único SVG completo dentro de um bloco de código, com formas simples e cores sólidas. A legenda deve ser curta e não pode mencionar SVG, código ou arquivo.`;

const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY!,
    baseURL: 'https://api.groq.com/openai/v1',
});

type IncomingMessage = {
    role: string;
    content?: string;
};

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export async function POST(req: Request) {
    const { messages } = await req.json() as { messages?: IncomingMessage[] };
    const history = Array.isArray(messages) ? messages : [];
    const conversation = history.filter((message) => message.role === 'user' || message.role === 'assistant');
    const latestUser = [...conversation].reverse().find((message) => message.role === 'user');
    const latest = decodeUserContent(latestUser?.content ?? '');
    const hasImages = conversation.some((message) => messageImages(message).length > 0);
    const shouldGenerate = wantsGeneratedImage(latest.text, latest.images.length > 0);

    if (shouldGenerate || hasImages) {
        return geminiResponse(conversation, shouldGenerate);
    }

    const response = await openai.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        stream: true,
        messages: [
            { role: 'system', content: TEXT_SYSTEM },
            ...conversation.map((message) => ({
                role: message.role as 'user' | 'assistant',
                content: decodeUserContent(message.content ?? '').text,
            })),
        ],
    });

    return new StreamingTextResponse(OpenAIStream(response));
}

function messageImages(message: IncomingMessage) {
    if (message.role !== 'user') return [];
    return decodeUserContent(message.content ?? '').images;
}

function toGeminiContents(messages: IncomingMessage[]) {
    const contents: { role: 'user' | 'model'; parts: GeminiPart[] }[] = [];

    for (const message of messages.slice(-12)) {
        const fromUser = message.role === 'user';
        const decoded = fromUser
            ? decodeUserContent(message.content ?? '')
            : { text: message.content ?? '', images: [] as string[] };
        const parts: GeminiPart[] = [];

        for (const url of decoded.images) {
            const parsed = parseDataUrl(url);
            if (parsed && parsed.mimeType !== 'image/svg+xml') parts.push({ inlineData: parsed });
        }

        const text = decoded.text.trim();
        if (text) parts.push({ text });
        else if (parts.length) parts.push({ text: 'Observe a imagem enviada.' });

        if (!parts.length) continue;
        contents.push({ role: fromUser ? 'user' : 'model', parts });
    }

    return contents;
}

async function geminiResponse(messages: IncomingMessage[], generateImage: boolean) {
    if (!process.env.GEMINI_API_KEY) {
        return textResponse('A chave GEMINI_API_KEY não está configurada, então não consigo ver nem gerar imagens.');
    }

    const contents = toGeminiContents(messages);
    if (!contents.length) {
        return textResponse('Envie uma mensagem ou uma imagem para continuar.');
    }

    const models = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
    let lastError = generateImage ? 'Não consegui gerar a imagem agora.' : 'Não consegui analisar a imagem agora.';

    for (const model of models) {
        const result = await geminiGenerate(
            model,
            contents,
            generateImage ? IMAGE_SYSTEM : VISION_SYSTEM,
            generateImage ? ['TEXT', 'IMAGE'] : undefined,
        );
        if (!result.ok) {
            lastError = friendlyGeminiError(result.status, result.message);
            if (result.status !== 503 && result.status !== 429) break;
            continue;
        }

        const visible = presentImages(result.text, result.images);
        if (generateImage && !visible.images.length) {
            lastError = visible.text || lastError;
            continue;
        }

        return textResponse(
            visible.text || (generateImage ? 'Imagem pronta.' : 'Não encontrei nada para descrever nessa imagem.'),
            visible.images,
        );
    }

    return textResponse(lastError);
}

function presentImages(text: string, images: string[]) {
    const embedded = extractEmbeddedImages(text);
    const all = [...images, ...embedded.images];
    const raster = all.filter((url) => !url.startsWith('data:image/svg+xml'));
    const svgs = all.filter((url) => url.startsWith('data:image/svg+xml'));
    return { text: embedded.text, images: raster.length ? raster : svgs };
}

async function geminiGenerate(
    model: string,
    contents: { role: 'user' | 'model'; parts: GeminiPart[] }[],
    system: string,
    modalities?: string[],
) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': process.env.GEMINI_API_KEY!,
            },
            signal: AbortSignal.timeout(55_000),
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents,
                generationConfig: modalities ? { responseModalities: modalities } : undefined,
            }),
        },
    );

    const json = await response.json().catch(() => null) as {
        error?: { message?: string };
        candidates?: { content?: { parts?: Record<string, unknown>[] } }[];
    } | null;

    if (!response.ok || !json) {
        return {
            ok: false as const,
            status: response.status,
            message: json?.error?.message || response.statusText,
        };
    }

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    let text = '';
    const images: string[] = [];

    for (const part of parts) {
        if (typeof part.text === 'string') text += part.text;
        const blob = (part.inlineData || part.inline_data) as { mimeType?: string; mime_type?: string; data?: string } | undefined;
        if (!blob?.data) continue;
        images.push(`data:${blob.mimeType || blob.mime_type || 'image/png'};base64,${blob.data}`);
    }

    return { ok: true as const, text: text.trim(), images };
}

function friendlyGeminiError(status: number, message: string) {
    if (status === 429 || /quota|rate limit/i.test(message)) {
        return 'A cota da Gemini para este pedido acabou. Tente de novo mais tarde.';
    }
    if (status === 503) {
        return 'O modelo está sobrecarregado agora. Tente de novo em instantes.';
    }
    return 'Não consegui processar a imagem. Tente novamente.';
}

function textResponse(text: string, images: string[] = []) {
    const data = new StreamData();
    if (images.length) {
        data.appendMessageAnnotation({ type: 'images', urls: images });
    }

    const encoder = new TextEncoder();
    const raw = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(text));
            controller.close();
        },
    });

    const stream = raw.pipeThrough(createStreamDataTransformer()).pipeThrough(new TransformStream({
        transform(chunk, controller) {
            controller.enqueue(chunk);
        },
        flush() {
            void data.close();
        },
    }));

    return new StreamingTextResponse(stream, {}, data);
}
