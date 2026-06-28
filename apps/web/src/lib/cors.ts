import { NextResponse } from "next/server";

export function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export function corsOptions() {
  return withCors(new NextResponse(null, { status: 204 }));
}
