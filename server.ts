import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const RIG_COORDINATE_SPEC = `
You are an expert Mine-imator 3D Minecraft character director & technical animator.
You are choreographing one or more 12-bone bendable Minecraft humanoid rigs on a voxel stage (1 block = 1.0 unit, character height = 2.0 blocks).
In a character's UNROTATED local frame (baseYaw = 0), the character FACES +Z, +Y is UP, +X is Character's LEFT, -X is Character's RIGHT.
(If baseYaw = 180, the character faces -Z; if baseYaw = 90, +X; if baseYaw = -90, -X.)

EXACT RIGHT-HAND-RULE JOINT CONVENTIONS (Euler DEGREES [rx, ry, rz], rotation order 'YXZ'):
1. rootOffset ([dx, dy, dz] in WORLD blocks relative to character's basePosition):
   - dy < 0 lowers hips during crouches/stances (e.g., -0.06 for athletic stance, -0.25 for deep squat).
   - dy > 0 lifts character into the air for jumps/flips (e.g., +0.65 at jump apex).
   - dx / dz move character across the floor during lunges, steps, dashes, or knockbacks in WORLD coordinates!
2. rootYawOffset (degrees added to baseYaw): turns the whole character left (+) or right (-).
3. pelvis (root hip tilt at y=0.75):
   - rx > 0 tilts whole body forward; rx < 0 tilts backward (e.g., rx: -360 for backflip, +360 for frontflip).
   - rz tilts sideways.
4. torso (lower waist) & spineBend (upper chest bend at waist):
   - rx > 0 bends torso/chest FORWARD; rx < 0 arches BACKWARD.
   - ry > 0 twists chest LEFT (driving RIGHT shoulder forward); ry < 0 twists RIGHT (driving LEFT shoulder forward).
   - Split bends naturally across torso + spineBend (e.g. torso: [8, 12, 0], spineBend: [12, 18, 0]).
5. head (on neck at top of chest):
   - rx > 0 nods DOWN; rx < 0 looks UP.
   - ry > 0 looks LEFT; ry < 0 looks RIGHT.
   - Counter-rotate head rx/ry so eyes stay locked on the target or camera during torso leans & twists!
6. rightArm & leftArm (shoulders, hanging DOWNWARD):
   - rx < 0 swings upper arm FORWARD / UPWARD (-90 = straight forward, -155 = raised high overhead).
   - rx > 0 swings upper arm BACKWARD (+40 = pulled behind back).
   - rightArm.rz < 0 raises right arm OUTWARD to right side; rightArm.rz > 0 brings inward across chest.
   - leftArm.rz > 0 raises left arm OUTWARD to left side; leftArm.rz < 0 brings inward across chest.
7. rightElbow & leftElbow (forearm bend at elbow):
   - CRITICAL: rx <= 0 ONLY (range -135 to 0)! Negative rx bends the forearm FORWARD/UPWARD naturally toward chest/face (e.g. -95 for boxer guard, -15 for near-straight punch extension, -70 for sprint arm swing). NEVER bend elbows backward (+rx)!
8. rightLeg & leftLeg (hips, hanging DOWNWARD):
   - rx < 0 swings/kicks thigh FORWARD (-45 stride, -95 high kick).
   - rx > 0 extends thigh BACKWARD (+40 trailing leg).
   - rightLeg.rz < 0 widens right stance; leftLeg.rz > 0 widens left stance.
9. rightKnee & leftKnee (shin bend at knee):
   - CRITICAL: rx >= 0 ONLY (range 0 to +135)! Positive rx bends the lower leg BACKWARD naturally (e.g. +24 athletic knee bend, +75 sprint tuck, +95 jump tuck). NEVER bend knees forward (-rx)!

HIGH-EFFORT ANIMATION QUALITY RULES:
1. Generate 6 to 10 expressive keyframes per character spanning t=0 to t=duration.
2. Always use classic animation principles:
   - Anticipation (coil, crouch, weight shift before strike/jump).
   - Explosive Peak (use easing: "snap", full hip/spine/elbow/knee coordination, subtle rootOffset lunge).
   - Overshoot & Follow-through (head/arms lag slightly behind torso, bounce settle on landing).
3. MULTI-CHARACTER CHOREOGRAPHY:
   - You MUST return a track for EVERY character provided in the scene cast (matching exact characterId).
   - Synchronize timestamps so characters react to each other accurately! For example, if Character A strikes at t=0.38s, Character B braces or reacts at t=0.38s-0.55s and stumbles back in the exact world direction away from Character A!
   - If the prompt focuses on a single character (e.g. "punch"), keep other characters in reactive idle/guard poses or have them participate naturally!
`;

const keyframeSchema = {
  type: Type.OBJECT,
  properties: {
    time: { type: Type.NUMBER, description: 'Timestamp in seconds.' },
    label: { type: Type.STRING, description: 'Short phase label e.g. Guard, Windup, Impact, Recoil.' },
    easing: {
      type: Type.STRING,
      description: 'One of: linear, easeInOut, snap, bounce',
    },
    rootOffset: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: '[dx, dy, dz] world translation offset in blocks.',
    },
    rootYawOffset: {
      type: Type.NUMBER,
      description: 'Yaw angle offset in degrees relative to baseYaw.',
    },
    bones: {
      type: Type.OBJECT,
      properties: {
        pelvis: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        torso: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        spineBend: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        head: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        rightArm: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        rightElbow: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        leftArm: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        leftElbow: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        rightLeg: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        rightKnee: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        leftLeg: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        leftKnee: { type: Type.ARRAY, items: { type: Type.NUMBER } },
      },
      required: [
        'pelvis',
        'torso',
        'spineBend',
        'head',
        'rightArm',
        'rightElbow',
        'leftArm',
        'leftElbow',
        'rightLeg',
        'rightKnee',
        'leftLeg',
        'leftKnee',
      ],
    },
  },
  required: ['time', 'label', 'easing', 'rootOffset', 'rootYawOffset', 'bones'],
};

const animationResponseSchema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: 'Short, punchy title for the scene animation (2-5 words).',
    },
    duration: {
      type: Type.NUMBER,
      description: 'Total duration in seconds (between 0.7 and 5.5).',
    },
    loop: {
      type: Type.BOOLEAN,
      description: 'Whether the animation should loop seamlessly.',
    },
    motionNotes: {
      type: Type.STRING,
      description: 'Concise 1-2 sentence biomechanical & choreography breakdown.',
    },
    tracks: {
      type: Type.ARRAY,
      description: 'One synchronized animation track per character in the scene.',
      items: {
        type: Type.OBJECT,
        properties: {
          characterId: { type: Type.STRING },
          characterName: { type: Type.STRING },
          keyframes: {
            type: Type.ARRAY,
            items: keyframeSchema,
          },
        },
        required: ['characterId', 'characterName', 'keyframes'],
      },
    },
  },
  required: ['name', 'duration', 'loop', 'motionNotes', 'tracks'],
};

function sanitizeVec3(val: unknown, fallback: [number, number, number] = [0, 0, 0]): [number, number, number] {
  if (!Array.isArray(val) || val.length < 3) return fallback;
  return [
    Number.isFinite(Number(val[0])) ? Number(val[0]) : fallback[0],
    Number.isFinite(Number(val[1])) ? Number(val[1]) : fallback[1],
    Number.isFinite(Number(val[2])) ? Number(val[2]) : fallback[2],
  ];
}

interface CastMemberInput {
  id: string;
  name: string;
  basePosition: [number, number, number];
  baseYaw: number;
  heldProp?: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.post('/api/animate', async (req: Request, res: Response) => {
    try {
      const prompt = String(req.body?.prompt ?? '').trim();
      const loopRequested = req.body?.loop !== undefined ? Boolean(req.body.loop) : true;
      const mapName = String(req.body?.mapName ?? 'Flat Baseplate');

      const rawCast = Array.isArray(req.body?.characters) ? req.body.characters : [];
      const cast: CastMemberInput[] =
        rawCast.length > 0
          ? rawCast.map((c: Record<string, unknown>, i: number) => ({
              id: String(c.id || `char-${i + 1}`),
              name: String(c.name || `Character ${i + 1}`),
              basePosition: sanitizeVec3(c.basePosition, [0, 0, 0]),
              baseYaw: Number.isFinite(Number(c.baseYaw)) ? Number(c.baseYaw) : 0,
              heldProp: typeof c.heldProp === 'string' ? c.heldProp : 'none',
            }))
          : [
              {
                id: 'char-1',
                name: 'Steve',
                basePosition: [0, 0, 0],
                baseYaw: 0,
                heldProp: 'none',
              },
            ];

      if (!prompt || prompt.length < 2) {
        return res.status(400).json({ error: 'Please describe an animation to generate.' });
      }

      const ai = getAiClient();

      // Step 1: Grounded Reference Research via Google Search
      let referenceSummary = '';
      const sources: Array<{ title: string; uri: string }> = [];

      try {
        const searchResponse = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Search for real-world biomechanics, keyframe animation reference poses, Mine-imator / 3D character animation principles, anticipation, elbow/knee arcs, and follow-through for this action: "${prompt}". Summarize the key poses, timing ratios, weight shifts, and reactions.`,
          config: {
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });

        referenceSummary = searchResponse.text ?? '';
        const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const seenUris = new Set<string>();
        for (const chunk of chunks) {
          const web = chunk.web;
          if (web?.uri && !seenUris.has(web.uri)) {
            seenUris.add(web.uri);
            sources.push({
              title: web.title || new URL(web.uri).hostname,
              uri: web.uri,
            });
          }
          if (sources.length >= 5) break;
        }
      } catch (searchErr) {
        console.warn('Reference search grounding skipped/failed:', searchErr);
      }

      // Step 2: Multi-Character Bendable Keyframe Choreography
      const castDescription = cast
        .map(
          (c) =>
            `- characterId: "${c.id}", name: "${c.name}", basePosition: [${c.basePosition.join(', ')}], baseYaw: ${c.baseYaw}deg, heldProp: "${c.heldProp}"`,
        )
        .join('\n');

      const synthesisPrompt = `
User Animation Request: "${prompt}"
Scene Map: "${mapName}"
Preferred Loop Mode: ${loopRequested ? 'looping cycle (loop: true)' : 'one-shot action (loop: false)'}

Scene Cast (${cast.length} character${cast.length > 1 ? 's' : ''}):
${castDescription}

Grounded Motion Reference Notes:
${referenceSummary || 'Use rich human biomechanics with clear anticipation, bendable elbow/knee arcs, spine twist, world rootOffset step/lunge, and smooth follow-through.'}

Generate synchronized tracks for EVERY character in the Scene Cast above.
`;

      const animResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: synthesisPrompt,
        config: {
          systemInstruction: RIG_COORDINATE_SPEC,
          responseMimeType: 'application/json',
          responseSchema: animationResponseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        },
      });

      const rawText = (animResponse.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);

      const duration = Math.max(0.6, Math.min(6.5, Number(parsed.duration) || 1.5));
      const rawTracks = Array.isArray(parsed.tracks) ? parsed.tracks : [];
      const validEasings = new Set(['linear', 'easeInOut', 'snap', 'bounce']);

      const tracksMap: Record<string, { characterId: string; characterName: string; keyframes: unknown[] }> = {};

      for (let tIdx = 0; tIdx < rawTracks.length; tIdx++) {
        const rawTrack = rawTracks[tIdx] as Record<string, unknown>;
        const matchedCast =
          cast.find((c) => c.id === rawTrack.characterId) ||
          cast[tIdx] ||
          cast[0];
        const rawKfs = Array.isArray(rawTrack.keyframes) ? rawTrack.keyframes : [];
        if (rawKfs.length < 2) continue;

        const keyframes = rawKfs
          .map((kf: Record<string, unknown>, idx: number) => {
            const b = (kf.bones ?? {}) as Record<string, unknown>;
            const rawTime = Number(kf.time);
            const fallbackTime = (idx / Math.max(1, rawKfs.length - 1)) * duration;
            return {
              time: Math.max(0, Math.min(duration, Number.isFinite(rawTime) ? rawTime : fallbackTime)),
              label: typeof kf.label === 'string' && kf.label.trim() ? kf.label.trim() : `Pose ${idx + 1}`,
              easing: validEasings.has(String(kf.easing)) ? String(kf.easing) : 'easeInOut',
              rootOffset: sanitizeVec3(kf.rootOffset, [0, 0, 0]),
              rootYawOffset: Number.isFinite(Number(kf.rootYawOffset)) ? Number(kf.rootYawOffset) : 0,
              bones: {
                pelvis: sanitizeVec3(b.pelvis),
                torso: sanitizeVec3(b.torso),
                spineBend: sanitizeVec3(b.spineBend),
                head: sanitizeVec3(b.head),
                rightArm: sanitizeVec3(b.rightArm),
                rightElbow: sanitizeVec3(b.rightElbow),
                leftArm: sanitizeVec3(b.leftArm),
                leftElbow: sanitizeVec3(b.leftElbow),
                rightLeg: sanitizeVec3(b.rightLeg),
                rightKnee: sanitizeVec3(b.rightKnee),
                leftLeg: sanitizeVec3(b.leftLeg),
                leftKnee: sanitizeVec3(b.leftKnee),
              },
            };
          })
          .sort((a: { time: number }, b: { time: number }) => a.time - b.time);

        keyframes[0].time = 0;
        keyframes[keyframes.length - 1].time = duration;

        tracksMap[matchedCast.id] = {
          characterId: matchedCast.id,
          characterName: matchedCast.name,
          keyframes,
        };
      }

      if (Object.keys(tracksMap).length === 0) {
        return res.status(502).json({ error: 'Generated animation had no valid character tracks. Please try again.' });
      }

      // Ensure every cast member has a track (fallback to first track if needed)
      const firstTrack = Object.values(tracksMap)[0];
      for (const member of cast) {
        if (!tracksMap[member.id]) {
          tracksMap[member.id] = {
            characterId: member.id,
            characterName: member.name,
            keyframes: firstTrack.keyframes,
          };
        }
      }

      return res.json({
        id: `ai-${Date.now()}`,
        name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : prompt.slice(0, 36),
        prompt,
        duration,
        loop: typeof parsed.loop === 'boolean' ? parsed.loop : loopRequested,
        motionNotes: typeof parsed.motionNotes === 'string' ? parsed.motionNotes : '',
        sources,
        tracks: tracksMap,
      });
    } catch (err: unknown) {
      console.error('Animation synthesis error:', err);
      const message = err instanceof Error ? err.message : 'Failed to synthesize animation.';
      return res.status(500).json({ error: message });
    }
  });

  // Minecraft Java username skin proxy
  app.get('/api/skin/:username', async (req: Request, res: Response) => {
    try {
      const username = String(req.params.username ?? '').replace(/[^a-zA-Z0-9_]/g, '');
      if (!username || username.length > 16) {
        return res.status(400).json({ error: 'Invalid Minecraft username.' });
      }

      const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
      if (!profileRes.ok) {
        return res.status(404).json({ error: `Player "${username}" not found on Mojang.` });
      }
      const profile = (await profileRes.json()) as { id: string; name: string };

      const sessionRes = await fetch(
        `https://sessionserver.mojang.com/session/minecraft/profile/${profile.id}`,
      );
      if (!sessionRes.ok) {
        return res.status(404).json({ error: 'Could not load player skin session.' });
      }
      const sessionData = (await sessionRes.json()) as {
        properties?: Array<{ name: string; value: string }>;
      };
      const texProp = sessionData.properties?.find((p) => p.name === 'textures');
      if (!texProp) {
        return res.status(404).json({ error: 'No skin texture found for this player.' });
      }

      const decoded = JSON.parse(Buffer.from(texProp.value, 'base64').toString('utf8')) as {
        textures?: { SKIN?: { url: string; metadata?: { model?: string } } };
      };
      const skinUrl = decoded.textures?.SKIN?.url;
      if (!skinUrl) {
        return res.status(404).json({ error: 'Player uses a default skin.' });
      }

      const imgRes = await fetch(skinUrl);
      if (!imgRes.ok) {
        return res.status(502).json({ error: 'Failed to download skin PNG.' });
      }
      const arrayBuf = await imgRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuf).toString('base64');
      const modelType = decoded.textures?.SKIN?.metadata?.model === 'slim' ? 'slim' : 'classic';

      return res.json({
        username: profile.name,
        modelType,
        dataUrl: `data:image/png;base64,${base64}`,
      });
    } catch (err) {
      console.error('Skin lookup error:', err);
      return res.status(500).json({
        error: 'Unable to reach Mojang skin servers right now. Try uploading a .png skin directly.',
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BlockRig Studio server running at http://localhost:${PORT}`);
  });
}

startServer();
