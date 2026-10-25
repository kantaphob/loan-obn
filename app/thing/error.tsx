'use client'

export default function AssetError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl p-8 text-slate-700"><h1 className="mb-3 text-xl font-semibold">โหลดข้อมูลสินทรัพย์ไม่สำเร็จ</h1><p className="mb-5 text-sm">กรุณาลองอีกครั้ง หากยังไม่สำเร็จ ให้ตรวจสอบบัญชีผู้ใช้งานและไฟล์ข้อมูลสินทรัพย์บนเซิร์ฟเวอร์</p><button type="button" onClick={reset} className="rounded-lg bg-emerald-800 px-4 py-2 text-white">ลองอีกครั้ง</button></main>
}
