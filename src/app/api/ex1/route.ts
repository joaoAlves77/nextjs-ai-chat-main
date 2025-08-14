import { StreamingTextResponse, createStreamDataTransformer } from "ai";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const message = messages.at(-1).contect;

    const prompt = PromptTemplate.fromTemplate(" {message} ");

    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
      temperature: 0.8,
    });

    const parser = new HttpResponseOutputParser();
    const chain = prompt.pipe(model).pipe(parser);

    const steam = await chain.stream({ message })

    return new StreamingTextResponse(
      steam.pipeThrough(createStreamDataTransformer()),
    );
  } catch (e: any) {
    return Response.json({ erros: e.message }, { status: 500 });
  }
}