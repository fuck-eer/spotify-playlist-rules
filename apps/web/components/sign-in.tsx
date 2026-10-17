"use client";

import { motion, useReducedMotion } from "motion/react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const ANDROID_APK = "/android/rulemix.apk";

export function SignIn({ error }: { error: string | null }) {
  const reduce = useReducedMotion();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg p-8 text-center text-tx">
      <motion.div
        className="flex flex-col items-center"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Logo />
        <p className="mb-10 mt-3.5 max-w-[260px] text-base text-mut">
          Your playlist, your order. Spotify just plays it.
        </p>
        {error ? (
          <p role="alert" className="mb-4 text-sm text-err">
            Sign-in didn&apos;t finish. Try again.
          </p>
        ) : null}
        <Button asChild size="lg" className="w-full max-w-[280px]">
          <a href="/api/auth/login">Continue with Spotify</a>
        </Button>
        <a
          href={ANDROID_APK}
          download
          className="mt-4 text-sm text-mut underline-offset-4 hover:text-tx hover:underline"
        >
          Get the Android app
        </a>
        <p className="mt-[18px] max-w-[260px] font-mono text-[11px] text-dim">
          Dev mode: access is limited to the owner and 4 friends.
        </p>
      </motion.div>
    </main>
  );
}
