/**
 * POST /api/upload
 * 接收 base64 图片，校验尺寸（DashScope 要求：短边 > 400，长边 < 7000），
 * 必要时自动缩放，保存到 data/uploads/，返回可访问 URL
 *
 * 说明：不在 public/ 下写入是因为 Next.js 生产模式不会服务运行时新增的文件。
 */
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

/** DashScope 图片尺寸限制 */
const MIN_SIDE = 400;
const MAX_SIDE = 7000;

export async function POST(request: Request) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { success: false, message: "请提供图片数据" },
        { status: 400 }
      );
    }

    // 解析 base64 data URL
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { success: false, message: "图片格式错误，需要 base64 data URL" },
        { status: 400 }
      );
    }

    const mime = matches[1]; // image/png, image/jpeg, etc.
    const pure = matches[2];
    const ext = mime.split("/")[1] || "png";
    let buffer = Buffer.from(pure, "base64");

    // 限制文件大小：最大 10MB（放宽一些，因为可能高分辨率）
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "图片大小不能超过 10MB" },
        { status: 400 }
      );
    }

    // ---- 尺寸校验 + 自动缩放 ----
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const longSide = Math.max(width, height);
    const shortSide = Math.min(width, height);

    let needsResize = false;
    let resizeWidth = width;
    let resizeHeight = height;

    // 短边太小 → 等比放大
    if (shortSide < MIN_SIDE) {
      const scale = MIN_SIDE / shortSide;
      resizeWidth = Math.round(width * scale);
      resizeHeight = Math.round(height * scale);
      needsResize = true;
    }

    // 长边太大 → 等比缩小
    if (longSide > MAX_SIDE) {
      const scale = MAX_SIDE / longSide;
      resizeWidth = Math.round(resizeWidth * scale);
      resizeHeight = Math.round(resizeHeight * scale);
      needsResize = true;
    }

    if (needsResize) {
      console.log(
        `[upload] 图片尺寸调整: ${width}x${height} → ${resizeWidth}x${resizeHeight}`
      );
      const resized = await sharp(Uint8Array.from(buffer))
        .resize(resizeWidth, resizeHeight, { fit: "inside" })
        .toFormat(ext === "jpg" ? "jpeg" : (ext as "png" | "jpeg" | "webp"))
        .toBuffer();
      buffer = Buffer.from(resized);
    }

    // 生成唯一文件名
    const filename = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;

    // 确保目录存在
    await mkdir(UPLOADS_DIR, { recursive: true });

    // 写入文件
    await writeFile(path.join(UPLOADS_DIR, filename), buffer);

    // 构建公网 URL（通过 /api/uploads/ 路由提供服务）
    const host = request.headers.get("host") || "localhost:3000";
    // 优先用 nginx 转发的协议头，其次看是否 localhost，默认 http
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const protocol = forwardedProto
      || (host.startsWith("localhost") ? "http" : "https");
    const url = `${protocol}://${host}/api/uploads/${filename}`;
    console.log("[upload] 图片上传完成，URL:", url);

    return NextResponse.json({ success: true, url, filename });
  } catch (err: any) {
    console.error("上传失败:", err);
    return NextResponse.json(
      { success: false, message: err.message || "上传失败" },
      { status: 500 }
    );
  }
}
