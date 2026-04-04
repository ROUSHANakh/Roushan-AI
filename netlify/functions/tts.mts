export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const elevenLabsKey = Netlify.env.get("ELEVENLABS_API_KEY") || "";
  const voiceId = Netlify.env.get("ELEVENLABS_VOICE_ID") || "EXAVITQu4vr4xnSDxMaL";

  try {
    const body = await req.json();
    const text: string = body.text || "";

    if (!text.trim() || !elevenLabsKey) {
      return Response.json({ audio_base64: "" });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsKey,
          accept: "audio/mpeg",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!response.ok) {
      return Response.json({ audio_base64: "" });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return Response.json({ audio_base64: base64 });
  } catch {
    return Response.json({ audio_base64: "" });
  }
};

export const config = {
  path: "/api/tts",
  method: ["POST", "OPTIONS"],
};
