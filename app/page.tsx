"use client";

import { useState, useCallback, useRef, type DragEvent } from "react";

// ============================================================
// 类型定义
// ============================================================

type ClothesType = "upper" | "lower" | "dress";

interface SegmentResult {
  type: ClothesType;
  label: string;
  parsingImgUrl: string | null;
  cropImgUrl: string | null;
  bbox: [number, number, number, number] | null;
}

const CLOTHES_OPTIONS: { value: ClothesType; label: string }[] = [
  { value: "upper", label: "上装" },
  { value: "lower", label: "下装" },
  { value: "dress", label: "连衣裙/连体衣" },
];

// ============================================================
// 主页面
// ============================================================

export default function HomePage() {
  // 图片状态
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // 本地预览
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null); // 公网 URL
  const [uploading, setUploading] = useState(false);

  // 分割状态
  const [clothesTypes, setClothesTypes] = useState<Set<ClothesType>>(
    new Set(["upper"])
  );
  const [segmenting, setSegmenting] = useState(false);
  const [results, setResults] = useState<SegmentResult[] | null>(null);

  // 错误
  const [error, setError] = useState<string | null>(null);

  // 文件输入
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // ============================================================
  // 上传图片 → 获取公网 URL
  // ============================================================

  const uploadImage = useCallback(async (file: File) => {
    // 验证
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("图片大小不能超过 10MB");
      return;
    }

    setError(null);
    setResults(null);
    setUploading(true);

    try {
      // 读取为 base64 用于本地预览
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;
      setPreviewUrl(base64);

      // 上传到服务端获取公网 URL
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.message);
      }
      setUploadedUrl(uploadData.url);
    } catch (err: any) {
      setError(err.message || "上传失败");
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }, []);

  // ============================================================
  // 分割服装
  // ============================================================

  const handleSegment = async () => {
    if (!uploadedUrl) {
      setError("请先上传模特图");
      return;
    }
    if (clothesTypes.size === 0) {
      setError("请至少选择一种分割类型");
      return;
    }

    setError(null);
    setSegmenting(true);

    try {
      const res = await fetch("/api/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: uploadedUrl,
          clothesType: Array.from(clothesTypes),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message);
      }

      // 组装结果
      const typeList = Array.from(clothesTypes);
      const segResults: SegmentResult[] = typeList.map((t, i) => ({
        type: t,
        label: CLOTHES_OPTIONS.find((o) => o.value === t)?.label || t,
        parsingImgUrl: data.parsingImgUrls?.[i] ?? null,
        cropImgUrl: data.cropImgUrls?.[i] ?? null,
        bbox: data.bbox?.[i] ?? null,
      }));

      setResults(segResults);
    } catch (err: any) {
      setError(err.message || "分割失败");
    } finally {
      setSegmenting(false);
    }
  };

  // ============================================================
  // 下载图片
  // ============================================================

  const downloadImage = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // 跨域时直接打开新标签
      window.open(url, "_blank");
    }
  };

  // ============================================================
  // 拖拽事件
  // ============================================================

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadImage(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    e.target.value = "";
  };

  const toggleType = (t: ClothesType) => {
    setClothesTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size > 1) next.delete(t);
      } else {
        next.add(t);
      }
      return next;
    });
  };

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* 标题 */}
      <header className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
          AI 服饰分割
        </h1>
        <p className="mt-3 text-gray-500 text-lg">
          上传模特图，AI 自动识别并分割服装，生成透明背景商品图
        </p>
      </header>

      {/* 上传区域 */}
      <section className="mb-8">
        {/* 没有预览图时显示上传区 */}
        {!previewUrl ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
              transition-all duration-200
              ${
                dragging
                  ? "border-blue-500 bg-blue-50 scale-[1.01]"
                  : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              }
              ${uploading ? "pointer-events-none opacity-60" : ""}
            `}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin" />
                <p className="text-gray-500">上传中...</p>
              </div>
            ) : (
              <>
                <div className="text-5xl mb-4">📤</div>
                <p className="text-lg font-medium text-gray-700">
                  {dragging ? "松开鼠标上传" : "点击上传或拖拽图片到此处"}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  支持 PNG / JPG / WebP，最大 10MB，请确保图片中只有一位模特
                </p>
              </>
            )}
          </div>
        ) : (
          /* 有预览图 */
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-100 w-full sm:w-64 aspect-[3/4] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="模特图预览"
                className="w-full h-full object-cover"
              />
              {/* 重新选择 */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                >
                  更换图片
                </button>
                <button
                  onClick={() => {
                    setPreviewUrl(null);
                    setUploadedUrl(null);
                    setResults(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/80 text-sm font-medium text-red-500 hover:bg-white transition"
                >
                  移除
                </button>
              </div>
            </div>

            {/* 上传成功后的信息 */}
            <div className="flex-1 space-y-2">
              <p className="text-sm text-green-600 flex items-center gap-1">
                ✅ 图片已上传
              </p>
              <p className="text-xs text-gray-400 break-all">
                公网 URL: {uploadedUrl}
              </p>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </section>

      {/* 分割类型选择 */}
      {previewUrl && (
        <section className="mb-8 p-5 bg-white rounded-xl border border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            选择要分割的服装类型：
          </h2>
          <div className="flex flex-wrap gap-3">
            {CLOTHES_OPTIONS.map((opt) => {
              const checked = clothesTypes.has(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2
                    cursor-pointer transition-all select-none text-sm font-medium
                    ${
                      checked
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleType(opt.value)}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
                      checked ? "border-blue-500 bg-blue-500" : "border-gray-300"
                    }`}
                  >
                    {checked && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </span>
                  {opt.label}
                </label>
              );
            })}
          </div>

          {/* 分割按钮 */}
          <button
            onClick={handleSegment}
            disabled={segmenting}
            className={`
              mt-5 w-full py-3 rounded-xl text-white font-semibold text-base
              transition-all
              ${
                segmenting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-[0.99]"
              }
            `}
          >
            {segmenting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                AI 正在分析分割中...
              </span>
            ) : (
              "🔍 开始分割"
            )}
          </button>
        </section>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mb-8 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <span className="shrink-0 mt-0.5">❌</span>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* 结果展示 */}
      {results && results.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-5">
            分割结果
            <span className="text-sm font-normal text-gray-400 ml-2">
              （图片 URL 有效期 24 小时，请及时下载）
            </span>
          </h2>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* 类型标签 */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-semibold text-gray-800">
                    {r.label}
                  </span>
                  {r.parsingImgUrl ? (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      已识别
                    </span>
                  ) : (
                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                      未检测到
                    </span>
                  )}
                </div>

                {/* 图片预览 */}
                <div className="p-4 space-y-3">
                  {/* RGBA 分割图 */}
                  {r.parsingImgUrl && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        RGBA 透明底分割图
                      </p>
                      <div className="relative rounded-lg overflow-hidden border border-gray-100 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4T2NkYPj/n4EBCMDAwADELAMGBgZGuAYAycwDQn3BAOAAAAAASUVORK5CYII=')]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.parsingImgUrl}
                          alt={`${r.label} RGBA 分割图`}
                          className="w-full object-contain max-h-48"
                        />
                      </div>
                      <button
                        onClick={() =>
                          downloadImage(
                            r.parsingImgUrl!,
                            `${r.label}_rgba_${Date.now()}.png`
                          )
                        }
                        className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        📥 下载 RGBA 图
                      </button>
                    </div>
                  )}

                  {/* RGB 商品图 */}
                  {r.cropImgUrl && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        RGB 服饰商品图
                      </p>
                      <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.cropImgUrl}
                          alt={`${r.label} 商品裁剪图`}
                          className="w-full object-contain max-h-48"
                        />
                      </div>
                      <button
                        onClick={() =>
                          downloadImage(
                            r.cropImgUrl!,
                            `${r.label}_商品图_${Date.now()}.jpg`
                          )
                        }
                        className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        📥 下载商品图
                      </button>
                    </div>
                  )}

                  {/* 坐标信息 */}
                  {r.bbox && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 font-mono">
                      📐 边界框: [{r.bbox.join(", ")}]
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 底部说明 */}
      <footer className="mt-16 pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
        <p>
          基于阿里云 DashScope AI 试衣-图片分割模型（aitryon-parsing-v1）
        </p>
        <p className="mt-1">
          每张图片费用 ¥0.004，新用户免费额度 400 张
        </p>
      </footer>
    </div>
  );
}
