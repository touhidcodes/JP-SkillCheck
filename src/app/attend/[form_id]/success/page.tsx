export default function SuccessPage() {
  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
      {/* CSS-only checkmark animation — no JS dependency */}
      <div
        className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center"
        style={{ animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
      >
        <svg
          className="w-8 h-8 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">You&apos;re all set!</h1>
        <p className="text-gray-500 text-sm">
          Your attendance has been recorded successfully.
        </p>
      </div>

      <p className="text-xs text-gray-400">You may close this tab.</p>

      <style>{`
        @keyframes popIn {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
