import { NextResponse } from "next/server";

// This is the instruction we wrote ourselves that drives the AI feature.
const SYSTEM_PROMPT = `You are NoteWise, a study assistant for students.
You will be given raw lecture notes, which may be messy, incomplete, or informal.

Your job is to return ONLY valid JSON (no markdown, no code fences, no extra text) with this exact shape:

{
  "summary": ["bullet point 1", "bullet point 2", "..."],
  "quiz": [
    { "question": "...", "options": ["A", "B", "C", "D"], "answer": "the correct option text" }
  ]
}

Rules:
- "summary" should have 4-8 concise bullet points capturing the key ideas, in simple language.
- "quiz" should have exactly 5 multiple-choice questions that test understanding of the notes.
- Each question must have exactly 4 options, and "answer" must exactly match one of the options.
- Do not invent facts that aren't supported by the notes.
- If the notes are too short or empty to work with, still return valid JSON with an empty summary array and empty quiz array.
- Output must be strictly valid JSON. Do not wrap it in backticks or add any commentary.`;

export async function POST(req) {
  try {
    const { notes } = await req.json();

    if (!notes || typeof notes !== "string" || notes.trim().length < 10) {
      return NextResponse.json(
        { error: "Please paste or upload at least a few sentences of notes." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing GROQ_API_KEY." },
        { status: 500 }
      );
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Here are the lecture notes:\n\n${notes}` },
        ],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq API error:", errText);

      if (errText.includes("rate_limit_exceeded") || errText.includes("tokens per minute")) {
        return NextResponse.json(
          {
            error:
              "These notes are too long for the AI to process in one go. Please shorten them to under ~2,500 words, or split them into two separate notes.",
          },
          { status: 413 }
        );
      }

      return NextResponse.json(
        { error: "AI service failed. Please try again." },
        { status: 502 }
      );
    }

    const data = await groqRes.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      return NextResponse.json(
        { error: "AI returned an empty response." },
        { status: 502 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse AI JSON:", text);
      return NextResponse.json(
        { error: "AI response was not valid JSON." },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Server error:", err);
    return NextResponse.json(
      { error: "Something went wrong on the server." },
      { status: 500 }
    );
  }
}
