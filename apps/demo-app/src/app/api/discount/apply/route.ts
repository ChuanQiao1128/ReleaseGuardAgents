import { NextResponse } from "next/server";

type DiscountRequest = {
  code?: unknown;
};

export async function POST(request: Request) {
  let body: DiscountRequest;

  try {
    body = (await request.json()) as DiscountRequest;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

  if (code === "SAVE10") {
    return NextResponse.json(
      {
        code: "SAVE10",
        discountCents: 1000,
        message: "Discount applied.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { error: "Discount code is invalid." },
    { status: 400 },
  );
}
