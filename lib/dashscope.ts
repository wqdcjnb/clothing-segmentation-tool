/**
 * 阿里云 DashScope API 客户端
 * 服饰分割：aitryon-parsing-v1
 */

const BASE_URL = "https://dashscope.aliyuncs.com/api/v1/services";

function apiKey() {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error("未配置 DASHSCOPE_API_KEY 环境变量");
  return key;
}

/** 服饰分割参数 */
export interface ClothingSegmentParams {
  /** 公网可访问的模特图 URL */
  imageUrl: string;
  /** 分割类型，默认 ["upper"] */
  clothesType?: ("upper" | "lower" | "dress")[];
}

/** 服饰分割结果 */
export interface ClothingSegmentResult {
  /** RGBA 可视化分割图 URL 列表 */
  parsingImgUrls: (string | null)[];
  /** RGB 裁剪服饰图 URL 列表 */
  cropImgUrls: (string | null)[];
  /** 边界框坐标 [x1,y1,x2,y2] 列表 */
  bbox: ([number, number, number, number] | null)[];
}

/**
 * 调用 AI 试衣-图片分割 API
 * 文档：https://help.aliyun.com/zh/model-studio/aitryon-parsing-api
 */
export async function segmentClothing(
  params: ClothingSegmentParams
): Promise<ClothingSegmentResult> {
  const { imageUrl, clothesType = ["upper"] } = params;

  const res = await fetch(`${BASE_URL}/vision/image-process/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "aitryon-parsing-v1",
      input: {
        image_url: imageUrl,
      },
      parameters: {
        clothes_type: clothesType,
      },
    }),
  });

  const data = await res.json();

  // 错误处理
  if (data.code && data.message) {
    throw new Error(`[${data.code}] ${data.message}`);
  }

  const output = data.output || {};

  return {
    parsingImgUrls: output.parsing_img_url || [],
    cropImgUrls: output.crop_img_url || [],
    bbox: output.bbox || [],
  };
}
