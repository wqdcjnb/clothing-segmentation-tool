/**
 * POST /api/upload
 * 接收 base64 图片，保存到 data/uploads/，返回可访问 URL
 *
 * 说明：不在 public/ 下写入是因为 Next.js 生产模式不会服务运行时新增的文件。
 */
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

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
    const buffer = Buffer.from(pure, "base64");

    // 限制文件大小：最大 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "图片大小不能超过 5MB" },
        { status: 400 }
      );
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
