/**
 * POST /api/upload
 * 接收 base64 图片，保存到 public/uploads/，返回公网 URL
 */
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

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
    const uploadsDir = path.join(process.cwd(), "public", "uploads");

    // 确保目录存在
    await mkdir(uploadsDir, { recursive: true });

    // 写入文件
    const filePath = path.join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    // 构建公网 URL
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const url = `${protocol}://${host}/uploads/${filename}`;

    return NextResponse.json({ success: true, url, filename });
  } catch (err: any) {
    console.error("上传失败:", err);
    return NextResponse.json(
      { success: false, message: err.message || "上传失败" },
      { status: 500 }
    );
  }
}
