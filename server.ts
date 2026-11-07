import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared Gemini client utility
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Multi-turn Chatbot with Google Search Grounding
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, useSearch = true, systemInstruction } = req.body;
    if (!ai) {
      return res.status(200).json({
        text: "I am Gideon Global Task Assistant. (Note: GEMINI_API_KEY is not configured in this environment, but you can explore task tips, drafting suggestions, and guidelines directly!).",
        sources: []
      });
    }

    const contents = (messages || []).map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content || m.text || '' }]
    }));

    const config: any = {
      systemInstruction: systemInstruction || "You are Gideon Global Taskmaster & AI Co-Pilot. You help global workers succeed on market research surveys, AI data annotation, data entry, copywriting, meme creation, and micro tasks. Provide concise, clear, and highly practical assistance."
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config
    });

    const text = response.text || "No response generated.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: { title: string; uri: string }[] = [];

    if (Array.isArray(chunks)) {
      chunks.forEach((c: any) => {
        if (c.web?.uri) {
          sources.push({ title: c.web.title || c.web.uri, uri: c.web.uri });
        }
      });
    }

    res.json({ text, sources });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Chat generation failed' });
  }
});

// 2. Google Maps Grounding & Local Field Tasks
app.post('/api/maps-grounding', async (req, res) => {
  try {
    const { query, latitude, longitude } = req.body;
    if (!ai) {
      return res.status(200).json({
        text: "Global field tasks available in major metropolitan hubs: store compliance audits, street signage verification, and venue photography.",
        mapsLinks: []
      });
    }

    const config: any = {
      tools: [{ googleMaps: {} }]
    };

    if (latitude && longitude) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: Number(latitude),
            longitude: Number(longitude)
          }
        }
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: query || "Find nearby businesses, grocery markets, or retail points for mystery shopper tasks",
      config
    });

    const text = response.text || "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const mapsLinks: { title: string; uri: string }[] = [];

    if (Array.isArray(chunks)) {
      chunks.forEach((c: any) => {
        if (c.maps?.uri) {
          mapsLinks.push({ title: c.maps.title || 'View on Google Maps', uri: c.maps.uri });
        }
      });
    }

    res.json({ text, mapsLinks });
  } catch (error: any) {
    console.error('Maps error:', error);
    res.status(500).json({ error: error.message || 'Maps query failed' });
  }
});

// 3. Audio Transcription (gemini-3.5-transcribe)
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Missing audioBase64 data' });
    }

    if (!ai) {
      return res.status(200).json({
        text: "Transcription simulation: 'Audio quality verified. Voice response captured accurately.'"
      });
    }

    const audioPart = {
      inlineData: {
        mimeType,
        data: audioBase64
      }
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          audioPart,
          { text: "Transcribe this audio verbatim with correct punctuation and casing." }
        ]
      }
    });

    res.json({ text: response.text || '' });
  } catch (error: any) {
    console.error('Transcribe error:', error);
    res.status(500).json({ error: error.message || 'Audio transcription failed' });
  }
});

// 4. Image Generation & Editing (gemini-nano-banana-2.1)
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio = '1:1', imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!ai) {
      return res.status(200).json({
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
        message: "Demo image placeholder"
      });
    }

    let contentsParts: any[] = [];
    if (imageBase64) {
      contentsParts.push({
        inlineData: {
          data: imageBase64,
          mimeType
        }
      });
    }
    contentsParts.push({ text: prompt || 'A futuristic vibrant digital worker logo' });

    const response = await ai.models.generateContent({
      model: 'gemini-nano-banana-2.1',
      contents: { parts: contentsParts },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize: '1K'
        }
      }
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    res.json({ imageUrl, text: response.text || '' });
  } catch (error: any) {
    console.error('Image generation error:', error);
    // Fallback to flash-lite if nano banana unavailable
    try {
      if (ai) {
        const response2 = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: { parts: [{ text: req.body.prompt || 'Modern digital task abstract art' }] }
        });
        let imageUrl = '';
        for (const part of response2.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType ?? 'image/png';
            imageUrl = `data:${mime};base64,${part.inlineData.data}`;
            break;
          }
        }
        return res.json({ imageUrl, text: response2.text || '' });
      }
    } catch (e2) {
      console.error('Fallback image failed', e2);
    }
    res.status(500).json({ error: error.message || 'Image generation failed' });
  }
});

// 5. Video Generation & Image Animation (gemini-omni-1.2-flash via Interactions API)
app.post('/api/generate-video', async (req, res) => {
  try {
    const { prompt, imageBase64, mimeType = 'image/jpeg', aspectRatio = '16:9' } = req.body;
    if (!ai) {
      return res.status(200).json({
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        status: 'completed'
      });
    }

    // Call interactions API
    const interactionParams: any = {
      model: 'gemini-omni-1.2-flash',
      input: {
        prompt: prompt || 'Cinematic slow motion camera glide through modern creative studio',
      },
      config: {
        aspectRatio
      }
    };

    if (imageBase64) {
      interactionParams.input.image = {
        data: imageBase64,
        mimeType
      };
    }

    if ((ai as any).interactions?.create) {
      const interaction = await (ai as any).interactions.create(interactionParams);
      return res.json({ interaction, status: 'processing' });
    }

    res.json({
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      status: 'simulated'
    });
  } catch (error: any) {
    console.error('Video error:', error);
    res.status(500).json({ error: error.message || 'Video generation failed' });
  }
});

// 6. Music Generation (lyria-3-clip-preview)
app.post('/api/generate-music', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!ai) {
      return res.status(200).json({
        audioDataUrl: '',
        lyrics: 'Cinematic upbeat background music for creators.',
        demo: true
      });
    }

    const response = await ai.models.generateContentStream({
      model: 'lyria-3-clip-preview',
      contents: prompt || '30-second upbeat lofi study and work beat with chill vinyl warmth.'
    });

    const audioChunks: Buffer[] = [];
    let lyrics = '';
    let mimeType = 'audio/mpeg';

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (audioChunks.length === 0 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
        }
        if (part.text) {
          lyrics += part.text;
        }
      }
    }

    const audioBase64 = Buffer.concat(audioChunks).toString('base64');
    const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;

    res.json({ audioDataUrl, lyrics });
  } catch (error: any) {
    console.error('Music generation error:', error);
    res.status(500).json({ error: error.message || 'Music generation failed' });
  }
});

// Vite middleware in dev
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gideon Global Tasks server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
