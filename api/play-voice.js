import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function contentTypeForKey(key) {
  const ext = String(key).split(".").pop().toLowerCase();
  if (ext === "mp4" || ext === "m4a") return "audio/mp4";
  if (ext === "ogg" || ext === "oga") return "audio/ogg";
  if (ext === "wav") return "audio/wav";
  if (ext === "mpeg" || ext === "mp3") return "audio/mpeg";
  return "audio/webm";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = String(req.query?.key || "").trim();

  // Only expose objects created by the voice-upload flow.
  if (!key || !key.startsWith("voice/") || key.includes("..") || key.includes("\\") || key.length > 300) {
    return res.status(400).json({ error: "Invalid voice key" });
  }

  try {
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      })
    );

    res.setHeader("Content-Type", object.ContentType || contentTypeForKey(key));
    res.setHeader("Cache-Control", "private, max-age=300");
    if (object.ContentLength != null) {
      res.setHeader("Content-Length", String(object.ContentLength));
    }
    res.setHeader("Accept-Ranges", "bytes");

    if (!object.Body) {
      return res.status(404).json({ error: "Voice recording not found" });
    }

    if (typeof object.Body.pipe === "function") {
      object.Body.pipe(res);
      return;
    }

    const bytes = await object.Body.transformToByteArray();
    return res.status(200).end(Buffer.from(bytes));
  } catch (error) {
    console.error("Voice playback error:", error);
    return res.status(404).json({ error: "Voice recording not found" });
  }
}
