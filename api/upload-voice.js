import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_SIZE = 5 * 1024 * 1024;

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

    if (!contentType.startsWith("audio/")) {
      return res.status(400).json({ error: "Only audio files are allowed" });
    }

    const audioBuffer = await getAudioBuffer(req);

    if (!audioBuffer || !audioBuffer.length) {
      return res.status(400).json({ error: "No audio received" });
    }

    if (audioBuffer.length > MAX_SIZE) {
      return res.status(413).json({ error: "Voice recording is too large" });
    }

    const extension = contentType.includes("mp4")
      ? "mp4"
      : contentType.includes("ogg")
      ? "ogg"
      : "webm";

    const key = `voice/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: audioBuffer,
        ContentType: contentType,
      })
    );

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      }),
      { expiresIn: 604800 }
    );

    return res.status(200).json({
      success: true,
      voiceUrl: url,
      key,
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
