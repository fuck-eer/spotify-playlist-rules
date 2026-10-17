"use client";

import { useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ANDROID_APK } from "@/components/sign-in";

/** Header account menu (next to RulesIconLink); holds Sign out. */
export function AccountMenu() {
  // The form lives outside the menu: the menu content unmounts on select, before a submit
  // from inside it could run.
  const form = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={form} action="/api/auth/logout" method="post" hidden />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account"
          className="grid size-[38px] place-items-center rounded-full bg-s2 text-tx"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="size-[18px]"
          >
            <circle cx="10" cy="7" r="3.2" />
            <path d="M3.5 17c1.2-3 3.6-4.5 6.5-4.5s5.3 1.5 6.5 4.5" />
          </svg>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={ANDROID_APK} download>
              Get the Android app
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => form.current?.requestSubmit()}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
