"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronLeft, LayoutDashboard, LogOut, Menu } from "lucide-react";
import { findActiveNavItem, NAV_GROUPS } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(true);
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  const [selectedHref, setSelectedHref] = useState("");

  useEffect(() => {
    const syncSelection = () => {
      setSelectedHref(findActiveNavItem(pathname, window.location.search)?.href ?? "");
    };
    syncSelection();
    window.addEventListener("popstate", syncSelection);
    return () => window.removeEventListener("popstate", syncSelection);
  }, [pathname]);

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <aside
      aria-label="เมนูหลัก"
      style={{ "--system-accent": "#343537" } as CSSProperties}
      className={`liquid-sidebar-panel sticky top-3 flex h-[calc(100dvh-24px)] shrink-0 flex-col overflow-hidden rounded-[26px] border border-white/50 text-[#222325] shadow-[0_20px_55px_#00000020] transition-[width] duration-300 max-[760px]:static max-[760px]:h-auto max-[760px]:w-full max-[760px]:rounded-[20px] ${collapsed ? "w-[64px]" : "w-[252px]"}`}
    >
      <div className={`relative z-10 flex min-h-[66px] items-center gap-3 border-b border-black/10 ${collapsed ? "justify-center px-2" : "px-3.5"}`}>
        {!collapsed && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-white/70 bg-white/40 text-[var(--system-accent)] shadow-[inset_0_1px_0_white,0_3px_10px_#0000000c]">
            <LayoutDashboard size={21} strokeWidth={2.2} aria-hidden="true" />
          </span>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-[#202124]">OBN Workspace</p>
            <p className="truncate text-[10px] text-[#6d6e70]">เมนูตามกลุ่มงาน</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
          title={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
          className={`grid shrink-0 place-items-center rounded-full border border-black/10 bg-white/55 text-[#343537] shadow-[0_2px_8px_#00000012] transition hover:bg-white/90 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#555659] max-[760px]:hidden ${collapsed ? "h-9 w-9" : "h-8 w-8"}`}
        >
          <ChevronLeft size={16} className={`transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
        {!collapsed && (
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label={mobileOpen ? "ซ่อนเมนู" : "แสดงเมนู"}
            aria-expanded={mobileOpen}
            className="hidden h-9 w-9 place-items-center rounded-xl border border-black/10 text-[#4b4c4e] max-[760px]:grid"
          >
            <Menu size={18} />
          </button>
        )}
      </div>

      <nav className={`relative z-10 min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin] [scrollbar-color:#7777_transparent] ${collapsed ? "max-[760px]:hidden" : ""} ${mobileOpen ? "max-[760px]:block" : "max-[760px]:hidden"}`}>
        {NAV_GROUPS.map((group) => {
          const groupKey = group.title;
          const isClosed = Boolean(closedGroups[groupKey]);
          return (
            <section key={groupKey} className="mb-3">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setClosedGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }))}
                  aria-expanded={!isClosed}
                  className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[.1em] text-[#737477] transition hover:text-[#202124] focus-visible:outline-2 focus-visible:outline-[#555659]"
                >
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--system-accent)]" />
                  <span className="flex-1">{group.title}</span>
                  <ChevronDown size={13} className={`transition-transform ${isClosed ? "-rotate-90" : ""}`} />
                </button>
              )}
              {(!isClosed || collapsed) && (
                <ul className={`space-y-1 ${collapsed ? "" : "ml-2 border-l border-black/10 pl-2"}`}>
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const currentHref = `${pathname}${typeof window === "undefined" ? "" : window.location.search}`;
                    const active = selectedHref ? selectedHref === href : currentHref === href || pathname === href.split("?")[0] && !href.includes("?");
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => {
                            setSelectedHref(href);
                            setMobileOpen(false);
                          }}
                          aria-current={active ? "page" : undefined}
                          aria-label={collapsed ? label : undefined}
                          title={collapsed ? label : undefined}
                          className={`flex min-h-10 items-center gap-2.5 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#555659] ${collapsed ? "justify-center px-0" : "px-3"} ${active ? "border border-white/80 bg-white/75 text-[#171819] shadow-[inset_0_1px_0_white,0_4px_14px_#00000012]" : "text-[#4c4d50] hover:bg-white/45 hover:text-[#171819]"}`}
                        >
                          <Icon size={17} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                          {!collapsed && <span className="truncate text-[11px] font-medium">{label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="relative z-10 m-3 mt-auto flex items-center gap-2.5 rounded-[17px] border border-white/60 bg-white/35 p-2.5 shadow-[inset_0_1px_0_#ffffff90,0_3px_12px_#0000000c] max-[760px]:hidden">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/70 bg-white/55 text-[10px] font-bold text-[#292a2c]">NP</span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[11px] font-semibold text-[#222325]">บัญชีผู้ใช้งาน</strong>
            <small className="text-[9px] text-[#707174]">Loan OBN</small>
          </div>
          <button type="button" onClick={() => void signOut()} title="ออกจากระบบ" aria-label="ออกจากระบบ" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-black/10 bg-white/50 text-[#56575a] transition hover:bg-white hover:text-[#bd4e59] focus-visible:outline-2 focus-visible:outline-[#555659]"><LogOut size={15} /></button>
        </div>
      )}
    </aside>
  );
}
