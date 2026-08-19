import type { Response } from "express";

export function isApiRequestPath(originalUrl: string) {
  const pathname = originalUrl.split("?", 1)[0] || "/";
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function sendApiNotFound(res: Response) {
  return res.status(404).json({
    error: {
      code: "API_NOT_FOUND",
      message: "请求的 API 路径不存在",
    },
  });
}
