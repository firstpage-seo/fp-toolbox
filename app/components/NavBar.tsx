"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";

interface MeResponse {
  loggedIn: boolean;
  username: string | null;
  isAdmin: boolean;
}

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/toolbox", label: "Toolbox" },
  { href: "/gateway", label: "Gateway" },
  { href: "/leads", label: "Leads", adminOnly: true },
];

/** Avatar initials: first two first-letters of the username (local part), uppercased. */
function initials(name: string): string {
  const base = name.split("@")[0];
  const parts = base.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return letters.toUpperCase() || "?";
}

export default function NavBar() {
  const [mounted, setMounted] = useState(false);
  const [me, setMe] = useState<MeResponse>({ loggedIn: false, username: null, isAdmin: false });
  const pathname = usePathname();

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MeResponse | null) => {
        if (!cancelled && data) setMe(data);
      })
      .catch(() => {
        // Leave the placeholder state — auth degrades to logged-out.
      });
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const isLoggedIn = me.loggedIn;
  const visibleLinks = NAV_LINKS.filter((l) => !l.adminOnly || me.isAdmin);

  const linkClass = (href: string) =>
    `px-3.5 py-2 rounded-lg text-[13.5px] font-semibold transition-colors ${
      pathname === href
        ? "bg-fp-500/10 text-fp-600"
        : "text-navy hover:bg-surface"
    }`;

  if (!mounted) {
    return <nav className="flex items-center gap-1 ml-auto" aria-hidden="true" />;
  }

  return (
    <nav className="flex items-center gap-1 ml-auto">
      {isLoggedIn ? (
        <>
          {visibleLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
          {me.username ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="ml-2 inline-flex items-center gap-1 rounded-full py-1 pl-1 pr-2 hover:bg-surface cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-fp-500"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-fp-100 text-[12px] font-bold text-fp-700">
                    {initials(me.username)}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-3">
                <PopoverHeader>
                  <PopoverTitle className="truncate text-[13.5px] font-bold text-navy">
                    {me.username}
                  </PopoverTitle>
                  <PopoverDescription className="text-[12px] text-muted">Signed in</PopoverDescription>
                </PopoverHeader>
                <button
                  onClick={async () => {
                    await fetch("/api/logout", { method: "POST" });
                    window.location.href = "/toolbox";
                  }}
                  className="mt-3 w-full px-4 py-2 rounded-lg text-[13.5px] font-bold text-white bg-grad-cta shadow-sm hover:brightness-105 cursor-pointer transition-all"
                >
                  Logout
                </button>
              </PopoverContent>
            </Popover>
          ) : null}
        </>
      ) : (
        <>
          <Link href="/toolbox" className={linkClass("/toolbox")}>
            Toolbox
          </Link>
          <Link
            href="/login"
            className="ml-2 px-4 py-2 rounded-lg text-[13.5px] font-bold text-white bg-grad-cta shadow-sm hover:brightness-105 transition-all"
          >
            Login
          </Link>
        </>
      )}
    </nav>
  );
}