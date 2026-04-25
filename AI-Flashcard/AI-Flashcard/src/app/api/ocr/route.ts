export const runtime = "nodejs";
import { NextResponse } from "next/server";
import Tesseract from "tesseract.js";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;

    if (!image) {
      return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());

    const result = await Tesseract.recognize(buffer, "eng");

    return NextResponse.json({
      text: result.data.text,
    });

  } catch (error) {
    console.error("OCR ERROR:", error);
    return NextResponse.json(
      { error: "OCR failed" },
      { status: 500 }
    );
  }
}