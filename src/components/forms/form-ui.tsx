'use client';

import { useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';

type FormActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  redirectTo?: string | null;
  fieldErrors?: Record<string, string | undefined>;
};

export function FieldError({ error }: { error?: string }) {
  if (!error) return null;

  return (
    <div className="fieldError" role="alert">
      {error}
    </div>
  );
}

export function FormFeedback({ state }: { state: FormActionState }) {
  if (!state.message || state.redirectTo) return null;

  return (
    <div className={state.status === 'error' ? 'errorBanner' : 'successBanner'} role="status">
      {state.message}
    </div>
  );
}

export function SubmitButton({
  idleLabel,
  pendingLabel,
  className = 'primaryButton'
}: {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

export function FormRedirectEffect({ state }: { state: FormActionState }) {
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success' && state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [router, state]);

  return null;
}
