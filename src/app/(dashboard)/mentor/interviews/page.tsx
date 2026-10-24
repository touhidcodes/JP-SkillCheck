import { CreatedInterviewsView } from "@/components/interview/created-interviews-view";
import { getCreatedInterviewsFromSheets } from "@/lib/sheets/created-interviews";

export const dynamic = "force-dynamic";

export default async function MentorCreatedInterviewsPage() {
  const sessions = await getCreatedInterviewsFromSheets();
  return <CreatedInterviewsView sessions={sessions} />;
}
