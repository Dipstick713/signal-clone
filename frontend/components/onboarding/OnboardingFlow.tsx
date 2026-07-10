"use client";

/**
 * Signal-style onboarding: a three-step flow on a single screen.
 *
 *   1. username  — enter a handle; backend reports new vs. returning
 *   2. otp       — enter the (mocked, fixed) verification code
 *   3. profile   — new users pick a display name + avatar colour
 *
 * Returning users skip step 3 and log straight in after the OTP.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { api, ApiError } from "@/lib/api";
import { AVATAR_COLORS } from "@/lib/constants";
import { useAuth } from "@/lib/store";

type Step = "username" | "otp" | "profile";

export function OnboardingFlow() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);

  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [otpHint, setOtpHint] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function fail(e: unknown) {
    setError(e instanceof ApiError ? e.message : "Something went wrong");
  }

  async function completeSession(payload: {
    username: string;
    otp: string;
    display_name?: string;
    avatar_color?: string;
  }) {
    const res = await api.authVerify(payload);
    setSession(res.access_token, res.user);
    router.replace("/");
  }

  async function submitUsername(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.authStart(username.trim());
      setIsNewUser(res.is_new_user);
      setOtpHint(res.otp_hint);
      setOtp(res.otp_hint); // prefill the mocked code for a smooth demo
      setStep("otp");
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isNewUser) {
        setStep("profile"); // collect profile before creating the account
      } else {
        await completeSession({ username: username.trim(), otp });
      }
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await completeSession({
        username: username.trim(),
        otp,
        display_name: displayName.trim(),
        avatar_color: avatarColor,
      });
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-signal text-3xl">
          💬
        </div>
        <h1 className="text-2xl font-semibold">Signal</h1>
        <p className="mt-1 text-sm text-secondary">
          Speak freely — a privacy-focused messenger.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-500">
          {error}
        </div>
      )}

      {step === "username" && (
        <form onSubmit={submitUsername} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Username</span>
            <div className="flex items-center rounded-lg border border-border bg-elevated px-3 focus-within:border-signal">
              <span className="text-secondary">@</span>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="yourname"
                className="w-full bg-transparent py-2.5 pl-1 outline-none"
                pattern="[a-zA-Z0-9_]{3,32}"
                title="3–32 characters: letters, numbers, or underscores"
                required
              />
            </div>
            <span className="text-xs text-secondary">
              3–32 characters. Letters, numbers, and underscores.
            </span>
          </label>
          <SubmitButton loading={loading}>Continue</SubmitButton>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={submitOtp} className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-primary">@{username}</span>.
          </p>
          <input
            autoFocus
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            className="w-full rounded-lg border border-border bg-elevated py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-signal"
            required
          />
          <p className="rounded-lg bg-signal/10 px-3 py-2 text-xs text-signal">
            Demo mode: use code <span className="font-semibold">{otpHint}</span>.
          </p>
          <SubmitButton loading={loading}>
            {isNewUser ? "Continue" : "Verify & sign in"}
          </SubmitButton>
          <BackButton onClick={() => setStep("username")} />
        </form>
      )}

      {step === "profile" && (
        <form onSubmit={submitProfile} className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3">
            <Avatar name={displayName || username} color={avatarColor} size={72} />
            <div className="flex flex-wrap justify-center gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  aria-label={`Avatar colour ${c}`}
                  className={`h-7 w-7 rounded-full transition ${
                    avatarColor === c ? "ring-2 ring-offset-2 ring-signal ring-offset-app" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Display name</span>
            <input
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={64}
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2.5 outline-none focus:border-signal"
              required
            />
          </label>
          <SubmitButton loading={loading}>Create account</SubmitButton>
          <BackButton onClick={() => setStep("otp")} />
        </form>
      )}
    </div>
  );
}

function SubmitButton({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center justify-center rounded-full bg-signal py-2.5 font-medium text-on-accent transition hover:bg-signal-hover disabled:opacity-60"
    >
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : (
        children
      )}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-secondary transition hover:text-primary"
    >
      ← Back
    </button>
  );
}
