import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

const FLASK_URL = "http://127.0.0.1:5000";

async function isFlaskAlive(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`${FLASK_URL}/`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.status < 500;
  } catch {
    return false;
  }
}

async function handleProxy(req: NextRequest, { params }: { params: { path: string[] } }) {

  const subPath = params.path ? params.path.join("/") : "";
  let targetPath = subPath;

  // Map proxy subpaths if needed:
  // /api/picture-automation/parse_file -> http://127.0.0.1:5000/api/parse_file
  // /api/picture-automation/scrape -> http://127.0.0.1:5000/api/scrape
  // /api/picture-automation/stream_logs/123 -> http://127.0.0.1:5000/api/stream_logs/123
  // /api/picture-automation/get_images -> http://127.0.0.1:5000/api/get_images
  // /api/picture-automation/downloads/... -> http://127.0.0.1:5000/downloads/...
  // /api/picture-automation/zip -> http://127.0.0.1:5000/api/zip
  // /api/picture-automation/download_zip/... -> http://127.0.0.1:5000/api/download_zip/...

  if (!targetPath.startsWith("api/") && !targetPath.startsWith("downloads/")) {
    targetPath = "api/" + targetPath;
  }

  const targetUrl = new URL(targetPath, FLASK_URL + "/");
  targetUrl.search = req.nextUrl.search;

  const method = req.method;
  const headers = new Headers();
  
  // Forward essential headers
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  let body: any = undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  try {
    const res = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
    });

    const responseHeaders = new Headers();
    const resContentType = res.headers.get("content-type");
    if (resContentType) responseHeaders.set("content-type", resContentType);
    
    const disposition = res.headers.get("content-disposition");
    if (disposition) responseHeaders.set("content-disposition", disposition);

    if (resContentType?.includes("text/event-stream")) {
      responseHeaders.set("Content-Type", "text/event-stream");
      responseHeaders.set("Cache-Control", "no-cache, no-transform");
      responseHeaders.set("Connection", "keep-alive");
      responseHeaders.set("X-Accel-Buffering", "no");

      return new NextResponse(res.body, {
        status: res.status,
        headers: responseHeaders,
      });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to connect to Picture Automation service: ${err.message}` },
      { status: 502 }
    );
  }
}

export { handleProxy as GET, handleProxy as POST, handleProxy as PUT, handleProxy as DELETE };
