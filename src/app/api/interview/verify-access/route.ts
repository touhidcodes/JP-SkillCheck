import { NextResponse } from "next/server";
import { z } from "zod";
import { getCreatedInterviewFromSheets } from "@/lib/sheets/created-interviews";

export const runtime = "nodejs";

const requestSchema = z.object({
  interviewId: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ allowed: false, message: "Enter a valid email address." }, { status: 400 });
    }

    const interview = await getCreatedInterviewFromSheets(parsed.data.interviewId);
    if (!interview) {
      return NextResponse.json({ allowed: false, message: "Interview not found." }, { status: 404 });
    }

    const email = parsed.data.email.toLowerCase();
    const allowed =
      interview.allowedEmails.length === 0 ||
      interview.allowedEmails.some((candidateEmail) => candidateEmail.toLowerCase() === email);

    return NextResponse.json({
      allowed,
      message: allowed ? undefined : "This email is not authorized for the interview.",
    });
  } catch (error) {
    console.error("Interview access verification failed:", error);
    return NextResponse.json(
      { allowed: false, message: "Could not verify interview access." },
      { status: 500 },
    );
  }
}
