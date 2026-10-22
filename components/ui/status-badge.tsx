type LoanStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_DOCUMENTS"
  | "APPROVED"
  | "REJECTED"
  | "DISBURSED"
  | "PENDING";

const statusStyles: Record<LoanStatus, string> = {
  ACTIVE: "border-emerald-400/45 bg-emerald-300/30 text-emerald-900",
  INACTIVE: "border-rose-400/45 bg-rose-300/30 text-rose-900",
  DRAFT: "border-slate-400/45 bg-slate-300/35 text-slate-800",
  SUBMITTED: "border-sky-400/50 bg-sky-300/30 text-sky-900",
  UNDER_REVIEW: "border-amber-400/55 bg-amber-300/35 text-amber-950",
  NEEDS_DOCUMENTS: "border-orange-400/55 bg-orange-300/35 text-orange-950",
  APPROVED: "border-green-400/55 bg-green-300/35 text-green-950",
  REJECTED: "border-red-400/55 bg-red-300/35 text-red-950",
  DISBURSED: "border-violet-400/50 bg-violet-300/35 text-violet-950",
  PENDING: "border-yellow-400/55 bg-yellow-300/35 text-yellow-950",
};

const statusLabels: Record<LoanStatus, string> = {
  ACTIVE: "ใช้งานอยู่",
  INACTIVE: "ปิดใช้งาน",
  DRAFT: "ฉบับร่าง",
  SUBMITTED: "ส่งคำขอแล้ว",
  UNDER_REVIEW: "กำลังพิจารณา",
  NEEDS_DOCUMENTS: "รอเอกสารเพิ่มเติม",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  DISBURSED: "จ่ายเงินแล้ว",
  PENDING: "รอดำเนินการ",
};

export function StatusBadge({
  status,
  label,
}: {
  status: LoanStatus;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[9px] font-semibold shadow-[inset_0_1px_0_#ffffff80] backdrop-blur-md ${statusStyles[status]}`}
    >
      <i
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          status === "ACTIVE" || status === "APPROVED"
            ? "bg-emerald-500 shadow-[0_0_7px_#10b981]"
            : status === "INACTIVE" || status === "REJECTED"
              ? "bg-rose-500 shadow-[0_0_7px_#f43f5e]"
              : status === "UNDER_REVIEW" || status === "PENDING"
                ? "bg-amber-500 shadow-[0_0_7px_#f59e0b]"
                : status === "NEEDS_DOCUMENTS"
                  ? "bg-orange-500 shadow-[0_0_7px_#f97316]"
                  : status === "SUBMITTED"
                    ? "bg-sky-500 shadow-[0_0_7px_#0ea5e9]"
                    : status === "DISBURSED"
                      ? "bg-violet-500 shadow-[0_0_7px_#8b5cf6]"
                      : "bg-slate-500"
        }`}
      />
      {label ?? statusLabels[status]}
    </span>
  );
}
