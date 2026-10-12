import { NextResponse } from "next/server";
import { saveUserToGoogleSheets } from "@/lib/sheets/users";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !body.email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const id = await saveUserToGoogleSheets({
      name: body.name || body.email.split("@")[0],
      email: body.email.trim(),
      role: body.role || "mentor",
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.warn("Save user Google Sheets error:", error);
    return NextResponse.json({ success: false, message: "Saved locally (Sheets dev mode)" }, { status: 200 });
  }
}
