import { NextResponse } from "next/server";
import { saveCreatedInterviewToGoogleSheets } from "@/lib/sheets/created-interviews";
import { saveStudentToGoogleSheets } from "@/lib/sheets/students";
import type { CustomInterviewSession } from "@/lib/interviews/custom-session";

export async function POST(req: Request) {
  try {
    const session = (await req.json()) as CustomInterviewSession;
    if (!session || !session.id) {
      return NextResponse.json({ error: "Invalid session payload" }, { status: 400 });
    }

    // Save session to created_interviews tab
    await saveCreatedInterviewToGoogleSheets(session);

    // Save allowed student emails to students tab
    if (session.allowedEmails && Array.isArray(session.allowedEmails)) {
      for (const email of session.allowedEmails) {
        await saveStudentToGoogleSheets({
          batch: session.batch || "Default Batch",
          email: email.trim(),
          status: "whitelisted",
        });
      }
    }

    return NextResponse.json({ success: true, id: session.id });
  } catch (error) {
    console.warn("Save session Google Sheets error:", error);
    return NextResponse.json({ success: false, message: "Saved locally (Sheets dev mode)" }, { status: 200 });
  }
}
