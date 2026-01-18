import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { initialMessages } from "@/lib/chatdata";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { message: "Prompt is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: "API key is not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const systemPrompt = initialMessages[0].content;
    const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating content:", errorMessage);
    return NextResponse.json(
      { message: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}