import {
  S3Client,
  PutObjectCommand,
  } from "@aws-sdk/client-s3";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["audio/webm", "webm"],
  ["audio/ogg", "ogg"],
  ["audio/opus", "ogg"],
  ["audio/mp4", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/wav", "wav"],
  ["audio/wave", "wav"],
  ["audio/mpeg", "mp3"],
]);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function getAudioBuffer(req) {
  // Vercel may expose the request body through req.body. For
  // application/octet-stream/audio uploads this is a Buffer.
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (req.body instanceof Uint8Array) {
    return Buffer.from(req.body);
  }

  if (typeof req.body === "string") {
    return Buffer.from(req.body, "binary");
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;

    req.on("data", chunk => {
      totalSize += chunk.length;
      if (totalSize > MAX_SIZE) {
        reject(Object.assign(new Error("Voice recording is too large"), { code: "TOO_LARGE" }));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const contentType = String(req.headers["content-type"] || "audio/webm")
      .split(";")[0]
      .trim()
      .toLowerCase();

    const extension = ALLOWED_TYPES.get(contentType);
    if (!extension) {
      return res.status(400).json({
        error: "Unsupported audio format. Use WebM, OGG, M4A, WAV or MP3."
      });
    }

    const declaredLength = Number(req.headers["content-length"] || 0);
    if (declaredLength > MAX_SIZE) {
      return res.status(413).json({ error: "Voice recording is too large" });
    }

    const audioBuffer = await getAudioBuffer(req);

    if (!audioBuffer || !audioBuffer.length) {
      return res.status(400).json({ error: "No audio received" });
    }

    if (audioBuffer.length > MAX_SIZE) {
      return res.status(413).json({ error: "Voice recording is too large" });
    }

    const key = `voice/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: audioBuffer,
        ContentType: contentType,
      })
    );

    // Never return a bearer/signed R2 URL. The app stores only this opaque key
    // and plays it through the same-origin /api/play-voice endpoint.
    return res.status(200).json({
      success: true,
      voiceKey: key,
      key,
      voiceUrl: "/api/play-voice?key=" + encodeURIComponent(key),
    });
  } catch (error) {
    console.error("R2 voice upload error:", error);

    if (error && error.code === "TOO_LARGE") {
      return res.status(413).json({ error: "Voice recording is too large" });
    }

    const message = error && error.message ? String(error.message) : "Voice upload failed";
    return res.status(500).json({
      error: `Voice upload failed: ${message}`,
    });
  }
}
