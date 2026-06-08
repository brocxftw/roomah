"use client";

import { useState } from "react";

export function ForgotPasswordLink() {
  const [showWarning, setShowWarning] = useState(false);

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => setShowWarning(true)}
        className="text-sm font-medium text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Forgot password?
      </button>
      {showWarning ? (
        <p role="alert" className="text-xs font-medium text-amber-600">
          Feature unavailable.
        </p>
      ) : null}
    </div>
  );
}
