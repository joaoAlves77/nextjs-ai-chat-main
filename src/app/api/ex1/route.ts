import { StreamingTextResponse, createStreamDataTransformer } from "ai";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const message = messages.at(-1).content;

    const prompt = PromptTemplate.fromTemplate(" {message} ");

    const model = new ChatOpenAI({
      apiKey: process.env.GROQ_API_KEY!,
      configuration: {
        baseURL: "https://api.groq.com/openai/v1",
      },
      model: "openai/gpt-oss-120b",
      temperature: 0.8,
    });

    const parser = new HttpResponseOutputParser();
    const chain = prompt.pipe(model).pipe(parser);

    const stream = await chain.stream({ message })

    return new StreamingTextResponse(
      stream.pipeThrough(createStreamDataTransformer()),
    );
  } catch (e: any) {
    return Response.json({ erros: e.message }, { status: 500 });
  }
}