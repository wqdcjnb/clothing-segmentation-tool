/**
 * POST /api/segment
 * 调用 DashScope AI 试衣-图片分割 API
 */
import { NextResponse } from "next/server";
import { segmentClothing } from "@/lib/dashscope";

export async function POST(request: Request) {
  try {
    const { imageUrl, clothesType } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, message: "请提供图片地址 imageUrl" },
        { status: 400 }
      );
    }

    // 验证 clothesType
    const validTypes = ["upper", "lower", "dress"];
    if (clothesType) {
      const invalid = clothesType.filter(
        (t: string) => !validTypes.includes(t)
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `无效的分割类型: ${invalid.join(", ")}。可选值: ${validTypes.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    const result = await segmentClothing({
      imageUrl,
      clothesType: clothesType || ["upper"],
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("分割失败:", err);
    return NextResponse.json(
      { success: false, message: err.message || "服饰分割失败，请重试" },
      { status: 500 }
    );
  }
}
