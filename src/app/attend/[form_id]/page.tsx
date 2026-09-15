import { StudentAttendanceForm } from '@/components/attendance/StudentAttendanceForm';
import { getAttendanceFormById } from '@/lib/sheets/attendance-forms';
import { ensureAttendanceFormsSheet } from '@/lib/sheets/initialize';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { form_id: string };
}

export default async function AttendPage({ params }: PageProps) {
  // Call the data layer directly — no internal HTTP fetch, no auth dependency.
  // An internal fetch to /api/attendance-forms/[id] would be intercepted by
  // middleware and return 401 because server-side fetches carry no cookie.
  await ensureAttendanceFormsSheet();
  const form = await getAttendanceFormById(params.form_id);

  if (!form) {
    return (
      <div className="w-full max-w-md space-y-3 rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">❌</div>
        <h1 className="text-xl font-semibold text-gray-900">Invalid Link</h1>
        <p className="text-sm text-gray-500">
          This attendance link is invalid or has been removed. Please contact your instructor.
        </p>
      </div>
    );
  }

  const now = new Date();
  const is_expired = new Date(form.expires_at) <= now;

  const formMeta = {
    id: form.id,
    session_label: form.session_label,
    date: form.date,
    is_active: form.is_active && !is_expired,
    is_expired,
  };

  return <StudentAttendanceForm formMeta={formMeta} />;
}
