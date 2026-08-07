"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  FIELD_FORGOT_PIN_HINT,
  fieldLocationNotReadyMessage
} from "@/lib/field-messages";
import { isBrowserOffline } from "@/lib/offline";

type FieldLoginPanelProps = {
  readonly pinLoginReady: boolean;
  readonly companyName?: string | null;
  readonly locationName?: string | null;
};

export function FieldLoginPanel({
  pinLoginReady,
  companyName,
  locationName
}: FieldLoginPanelProps) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSignIn() {
    setErrorMessage(null);

    if (!pinLoginReady) {
      setErrorMessage(fieldLocationNotReadyMessage());
      return;
    }

    if (!/^\d{6}$/u.test(pin)) {
      setErrorMessage("Enter a 6-digit PIN.");
      return;
    }

    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Connect to sign in.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch("/api/field/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        redirectTo?: string;
      };

      setIsBusy(false);

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Unable to sign in.");
        return;
      }

      router.push(payload.redirectTo ?? "/field/home");
      router.refresh();
    } catch {
      setIsBusy(false);
      setErrorMessage("Network error while signing in.");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500 text-sm font-bold text-white">
          LL
        </div>
        <div>
          {companyName ? (
            <p className="text-lg font-semibold text-slate-900">{companyName}</p>
          ) : null}
          {locationName ? (
            <p className="text-sm text-slate-500">{locationName}</p>
          ) : null}
        </div>
      </div>

      {!pinLoginReady ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {fieldLocationNotReadyMessage()}
        </p>
      ) : null}

      <div className={companyName || locationName || !pinLoginReady ? "mt-6" : "mt-2"}>
        <label className="block text-sm font-medium text-slate-700" htmlFor="field-login-pin">
          Enter your PIN
        </label>
        <input
          id="field-login-pin"
          inputMode="numeric"
          pattern="\d*"
          maxLength={6}
          placeholder="• • • • • •"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && pin.length === 6 && pinLoginReady && !isBusy) {
              void handleSignIn();
            }
          }}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-4 text-center text-lg font-medium tracking-[0.45em] text-slate-900 outline-none transition-colors placeholder:text-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          disabled={isBusy || !pinLoginReady}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => void handleSignIn()}
          disabled={isBusy || !pinLoginReady || pin.length !== 6}
          className="mt-4 w-full rounded-xl bg-brand-600 px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-700 active:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isBusy ? "Signing in…" : "Sign in"}
        </button>
      </div>

      {errorMessage ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <p className="mt-4 text-center text-sm text-slate-400">{FIELD_FORGOT_PIN_HINT}</p>
    </div>
  );
}
