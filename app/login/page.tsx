"use client";

import { useState, type FormEvent } from "react";

function SunMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" fill="none" className="h-10 w-10">
      <circle cx="24" cy="24" r="10" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1 6" strokeLinecap="round" />
      <circle cx="24" cy="4" r="1.1" fill="currentColor" />
      <circle cx="24" cy="44" r="1.1" fill="currentColor" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-[19px] w-[19px]">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9.9 5.3A10.8 10.8 0 0112 5c5.2 0 8.7 5.3 9 6-.2.4-1.5 2.6-3.8 4.2M6.2 7.2C4.2 8.6 3.2 10.5 3 11c.3.7 3.8 6 9 6 1 0 1.9-.2 2.8-.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-[19px] w-[19px]">
      <path d="M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acccode: formData.get("acccode"), password: formData.get("password"), rememberMe }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message || "เข้าสู่ระบบไม่สำเร็จ");
      window.location.assign("/dashboard");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 font-sans text-white sm:px-6">
      <div aria-hidden="true" className="login-backdrop pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <span className="login-orb login-orb-one" />
        <span className="login-orb login-orb-two" />
        <span className="login-orb login-orb-three" />
      </div>

      <section className="liquid-glass login-glass login-card w-full max-w-[534px] rounded-[26px] px-7 py-8 shadow-[0_28px_90px_rgba(7,9,30,.36)] sm:px-[66px] sm:py-[34px]">
        <div className="liquid-glass-content">
          <header className="mb-[26px] text-center">
            <div className="login-mark mx-auto mb-3 flex h-10 w-10 items-center justify-center text-[#3299f2]">
              <SunMark />
            </div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.28em] text-white/65">LOAN OBN</p>
            <h1 className="m-0 text-[35px] font-light leading-tight tracking-[-1.5px] text-white sm:text-[42px]">
              ยินดีต้อนรับ<span className="font-normal text-[#45a4f5]">กลับมา</span>
            </h1>
            <p className="mx-auto mt-2 max-w-[350px] text-[12px] leading-[1.7] text-white/70">
              เข้าสู่ระบบเพื่อจัดการบัญชีและติดตามคำขอสินเชื่อของคุณ
            </p>
          </header>

          <form onSubmit={handleSubmit} className="login-form space-y-[17px]">
            <label className="block">
              <span className="mb-[7px] block text-[10px] font-medium text-white/65">อีเมลหรือรหัสผู้ใช้</span>
              <input
                type="text"
                name="acccode"
                autoComplete="username"
                placeholder="กรอกอีเมลหรือรหัสผู้ใช้"
                required
                className="h-[51px] w-full rounded-[15px] border border-white/[.07] bg-white/[.065] px-4 text-[13px] text-white outline-none transition placeholder:text-white/45 focus:border-[#3299f2] focus:bg-white/[.09] focus:ring-2 focus:ring-[#3299f2]/20"
              />
            </label>

            <label className="block">
              <span className="mb-[7px] block text-[10px] font-medium text-white/65">รหัสผ่าน</span>
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="กรอกรหัสผ่าน"
                  required
                  className="h-[51px] w-full rounded-[15px] border border-white/[.07] bg-white/[.065] px-4 pr-12 text-[13px] text-white outline-none transition placeholder:text-white/45 focus:border-[#3299f2] focus:bg-white/[.09] focus:ring-2 focus:ring-[#3299f2]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[15px] text-white/60 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3299f2]"
                >
                  <EyeIcon hidden={showPassword} />
                </button>
              </span>
            </label>

            <div className="flex items-center gap-4 pt-[1px] text-[11px]">
              <label className="flex cursor-pointer items-center gap-[9px] text-white/85">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-[17px] w-[17px] cursor-pointer accent-[#3299f2]"
                />
                จดจำฉันไว้
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-[3px] h-[51px] w-full rounded-full bg-[#168de8] text-[13px] font-semibold text-white shadow-[0_5px_18px_rgba(14,89,150,.2)] transition hover:bg-[#2d9cf0] hover:shadow-[0_8px_24px_rgba(14,89,150,.32)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#80c5ff] active:scale-[.99] disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
            {notice && <p role="alert" className="-mt-2 text-center text-[11px] text-[#ffb9bf]">{notice}</p>}
          </form>

        </div>
      </section>
    </main>
  );
}
