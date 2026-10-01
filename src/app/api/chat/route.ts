import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';

// Optional, but recommended: run on the edge runtime.
// See https://vercel.com/docs/concepts/functions/edge-functions
export const runtime = 'edge';

const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY!,
    baseURL: 'https://api.groq.com/openai/v1',
});

export async function POST(req: Request) {
    // Extract the `messages` from the body of the request
    const { messages } = await req.json();

    // Request the OpenAI API for the response based on the prompt
    const response = await openai.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        stream: true,
        messages: [
            {
                role: 'system',
                content: 'Você é um assistente prestativo, cordial e objetivo. Responda em português de forma clara, organizada e bem formatada em Markdown (usando tópicos, títulos e negritos de forma elegante). Evite introduções longas desnecessárias.',
            },
            ...messages,
        ],
    });

    // Convert the response into a friendly text-stream
    const stream = OpenAIStream(response);

    // Respond with the stream
    return new StreamingTextResponse(stream);
}