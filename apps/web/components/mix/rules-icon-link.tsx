import Link from "next/link";

export function RulesIconLink() {
  return (
    <Link
      href="/rules"
      aria-label="Rules"
      className="grid size-[38px] place-items-center rounded-full bg-s2 text-tx"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="size-[18px]"
      >
        <path d="M7 5h10M7 10h10M7 15h10M2 5h2M2 10h2M2 15h2" />
      </svg>
    </Link>
  );
}
