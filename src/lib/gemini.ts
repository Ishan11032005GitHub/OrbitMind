import { env } from "@/lib/env";

export async function generateGeminiObject<T>(input: { system: string; prompt: string; schemaName: string }): Promise<T> {
  const config = env();
  if (config.ENABLE_EXTERNAL_AI !== "true") throw new Error("EXTERNAL_AI_DISABLED");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.AI_MODEL)}:generateContent?key=${encodeURIComponent(config.GEMINI_API_KEY)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: input.system }] }, contents: [{ role: "user", parts: [{ text: input.prompt }] }], generationConfig: { temperature: .35, responseMimeType: "application/json" } }), cache: "no-store" });
  if (!response.ok) throw new Error(`GEMINI_${response.status}`);
  const result = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return JSON.parse(text) as T;
}

