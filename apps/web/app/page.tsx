"use client";

import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";

export default function Page() {
  const reduce = useReducedMotion();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg text-tx">
      <h1 className="font-mono text-3xl font-bold tracking-tight">rulemix</h1>
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Button>Sign in with Spotify</Button>
      </motion.div>
    </main>
  );
}
