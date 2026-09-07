"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { getBookings, getBookingDisplayStatus, type Booking, type BookingStatus } from "@/lib/db";
import { useHirenaSync, HIRENA_SYNC_CHANNEL } from "@/lib/sync";

type Mode = "customer" | "admin";

export default function BookingCalendar({
  mode = "customer",
  onSelectDate,
}: {
  mode?: Mode;
  onSelectDate?: (dateStr: string, booking?: Booking) => void;
}) {
  const [current, setCurrent] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const touchStartX = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getBookings();
      setBookings(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // realtime via BroadcastChannel + storage + polling 10s using helper + manual interval
  useHirenaSync("bookings", load, 10000);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("hirena:bookings-updated", handler);
    window.addEventListener("hirena:update", handler);
    window.addEventListener("storage", handler);
    const iv = window.setInterval(() => load(), 10000);
    return () => {
      window.removeEventListener("hirena:bookings-updated", handler);
      window.removeEventListener("hirena:update", handler);
      window.removeEventListener("storage", handler);
      window.clearInterval(iv);
    };
  }, [load]);

  void HIRENA_SYNC_CHANNEL;

  const bookingMap = useMemo(() => {
    const m = new Map<string, Booking>();
    for (const b of bookings) m.set(b.date, b);
    return m;
  }, [bookings]);

  const monthLabel = current.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const days = useMemo(() => {
    const y = current.getFullYear();
    const m = current.getMonth();
    const firstDay = new Date(y, m, 1).getDay(); // 0 Sun
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrev = new Date(y, m, 0).getDate();
    const cells: { dateStr: string; day: number; isCurrent: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrev - i;
      const d = new Date(y, m - 1, day);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      cells.push({ dateStr: ds, day, isCurrent: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ dateStr: ds, day: d, isCurrent: true });
    }
    const need = cells.length <= 35 ? 35 - cells.length : 42 - cells.length;
    for (let i = 1; i <= need; i++) {
      const d = new Date(y, m + 1, i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      cells.push({ dateStr: ds, day: i, isCurrent: false });
    }
    return cells;
  }, [current]);

  function nav(dir: number) {
    setCurrent((prev) => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));
    setSelected(null);
  }

  function handleSelect(dateStr: string) {
    setSelected(dateStr);
    if (mode === "admin" && onSelectDate) {
      onSelectDate(dateStr, bookingMap.get(dateStr));
    }
  }

  const selectedBooking = selected ? bookingMap.get(selected) : undefined;
  const selectedStatus: BookingStatus = selectedBooking ? getBookingDisplayStatus(selectedBooking, todayStr) : "available";

  // WA button logic
  const waDisabled = selectedStatus === "booked" || selectedStatus === "completed" || selectedStatus === "blocked";
  const waLabel =
    selectedStatus === "booked"
      ? "Sudah Terisi"
      : selectedStatus === "completed"
        ? "Selesai"
        : selectedStatus === "blocked"
          ? "Tidak Tersedia"
          : selectedStatus === "cancelled"
            ? "Tanya via WA"
            : "Tanya via WA";

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 48) {
      if (dx < 0) nav(1);
      else nav(-1);
    }
    touchStartX.current = null;
  }

  return (
    <div
      className="bg-[#FFFCFA] rounded-[24px] border border-[#EDE3DA] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* header */}
      <div className="flex items-center justify-between px-5 md:px-8 py-5 md:py-7 border-b border-[#EDE3DA] bg-[#FFFCFA]">
        <div>
          <div className="sans text-[10px] tracking-[0.18em] uppercase text-[#C9A96E] font-medium">Kalender Booking</div>
          <h3 className="serif text-[22px] md:text-[26px] capitalize mt-1">{monthLabel}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav(-1)}
            aria-label="prev"
            className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-[#EDE3DA] bg-white hover:bg-[#F6F1EB] flex items-center justify-center text-[#1A1A1A] transition"
          >
            <span className="text-[16px] leading-none">‹</span>
          </button>
          <button
            onClick={() => setCurrent(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            className="hidden md:inline-flex sans text-[11px] tracking-[0.12em] uppercase border border-[#EDE3DA] bg-white px-4 h-10 items-center hover:bg-[#F6F1EB] transition rounded-full"
          >
            Hari ini
          </button>
          <button
            onClick={() => nav(1)}
            aria-label="next"
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#1A1A1A] text-white hover:bg-black flex items-center justify-center transition"
          >
            <span className="text-[16px] leading-none">›</span>
          </button>
        </div>
      </div>

      {/* legend */}
      <div className="px-5 md:px-8 py-4 flex flex-wrap items-center gap-4 md:gap-6 sans text-[11px] border-b border-[#EDE3DA]/60 bg-[#F6F1EB]/40 text-[#1A1A1A]">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-white border border-[#EDE3DA] shadow-sm" /> Tersedia
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-white border border-[#C9A96E] shadow-sm relative flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96E]" />
          </span>{" "}
          Terisi
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#EDE3DA] border border-[#EDE3DA]" /> Blocked
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </span>{" "}
          Batal
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </span>{" "}
          Selesai
        </span>
        <span className="ml-auto hidden md:inline-flex text-[10px] tracking-[0.12em] uppercase text-[#1A1A1A]/40">Klik tanggal untuk detail</span>
      </div>

      {/* weekday header */}
      <div className="sticky top-0 z-10 bg-[#FFFCFA] border-b border-[#EDE3DA]/50 grid grid-cols-7 px-2 md:px-4 py-2 md:py-3">
        {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
          <div key={d} className="text-center sans text-[10px] md:text-[11px] tracking-[0.14em] uppercase text-[#1A1A1A]/40 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* grid */}
      <div className="grid grid-cols-7 gap-px md:gap-1.5 bg-[#EDE3DA] md:bg-transparent p-px md:p-4">
        {days.map((cell) => {
          const b = bookingMap.get(cell.dateStr);
          const displayStatus: BookingStatus = b ? getBookingDisplayStatus(b, todayStr) : "available";
          const status = displayStatus;
          const isToday = cell.dateStr === todayStr;
          const isSelected = selected === cell.dateStr;
          const base =
            "relative flex flex-col items-center justify-center md:items-start md:justify-start md:rounded-[14px] md:border transition cursor-pointer select-none";
          const size = "h-12 md:h-[88px] md:p-2.5 p-1";
          let visual = "";
          if (status === "available") {
            if (cell.isCurrent) visual = "bg-white border-[#EDE3DA] text-[#1A1A1A] hover:border-[#C9A96E]/40 hover:shadow-sm";
            else visual = "bg-[#F6F1EB]/60 border-[#EDE3DA]/50 text-[#1A1A1A]/50 hover:bg-[#F6F1EB]";
          } else if (status === "booked") {
            if (cell.isCurrent) visual = "bg-white border-[#C9A96E] text-[#1A1A1A] hover:border-[#C9A96E] hover:shadow-sm";
            else visual = "bg-white/70 border-[#C9A96E]/40 text-[#1A1A1A]/60 hover:bg-white";
          } else if (status === "blocked") {
            if (cell.isCurrent) visual = "bg-[#EDE3DA] border-[#EDE3DA] text-[#1A1A1A] hover:bg-[#E8D9CA]";
            else visual = "bg-[#EDE3DA]/60 border-[#EDE3DA]/50 text-[#1A1A1A]/50";
          } else if (status === "cancelled") {
            visual = cell.isCurrent ? "bg-red-50 border-red-200 text-red-900 hover:bg-red-50" : "bg-red-50/60 border-red-200 text-red-800/70";
          } else if (status === "completed") {
            visual = cell.isCurrent ? "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-50" : "bg-emerald-50/60 border-emerald-200 text-emerald-800/70";
          }
          if (isToday) visual += " ring-2 ring-[#C9A96E] ring-offset-1 ring-offset-[#FFFCFA] md:ring-offset-0";
          if (isSelected) visual += " !border-[#C9A96E] ring-2 ring-[#C9A96E] ring-offset-2 ring-offset-white md:ring-offset-[#FFFCFA] z-10 shadow-[0_2px_12px_rgba(201,169,110,0.25)]";

          const numberCls =
            status === "blocked"
              ? "sans text-[13px] font-medium leading-none " + (cell.isCurrent ? "line-through decoration-[#1A1A1A]/30" : "line-through opacity-70")
              : status === "cancelled"
                ? "sans text-[13px] font-medium leading-none text-red-900 line-through decoration-red-200 " + (!cell.isCurrent ? "opacity-60" : "")
                : status === "completed"
                  ? "sans text-[13px] font-medium leading-none text-emerald-900 " + (!cell.isCurrent ? "opacity-60" : "")
                  : "sans text-[13px] font-medium leading-none text-[#1A1A1A] " + (!cell.isCurrent ? "opacity-60" : "");

          return (
            <button
              key={cell.dateStr}
              onClick={() => handleSelect(cell.dateStr)}
              className={`${base} ${size} ${visual}`}
              aria-label={cell.dateStr}
            >
              <span className={`${numberCls} ${isToday ? "!font-semibold" : ""}`}>{cell.day}</span>
              <span
                className={`hidden md:block mt-1 sans text-[10px] leading-[1.3] tracking-[0.04em] truncate w-full font-medium ${status === "booked" ? "text-[#C9A96E]" : status === "blocked" ? "text-[#1A1A1A]/60" : status === "cancelled" ? "text-red-700" : status === "completed" ? "text-emerald-700" : "text-[#1A1A1A]/45"}`}
              >
                {status === "booked"
                  ? mode === "admin"
                    ? b?.client || "Terisi"
                    : "Terisi"
                  : status === "blocked"
                    ? "Blocked"
                    : status === "cancelled"
                      ? "Batal"
                      : status === "completed"
                        ? "Selesai"
                        : "Tersedia"}
              </span>
              {b?.package && (status === "booked" || status === "completed") && (
                <span className="hidden md:inline-flex mt-auto sans text-[9px] tracking-[0.08em] uppercase px-2 py-0.5 rounded-full bg-[#C9A96E]/10 text-[#8A6A2E] border border-[#C9A96E]/20">
                  {b.package}
                </span>
              )}
              <span
                className="md:hidden mt-0.5 w-1 h-1 rounded-full"
                style={{
                  background:
                    status === "booked"
                      ? "#C9A96E"
                      : status === "blocked"
                        ? "#1A1A1A"
                        : status === "cancelled"
                          ? "#ef4444"
                          : status === "completed"
                            ? "#10b981"
                            : "transparent",
                }}
              />
              {isToday && !isSelected && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#C9A96E] md:hidden" />}
              {status === "booked" && <span className="hidden md:block absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-[#C9A96E]" />}
              {status === "cancelled" && <span className="hidden md:block absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-red-500" />}
              {status === "completed" && <span className="hidden md:block absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            </button>
          );
        })}
      </div>

      {loading && <div className="px-6 py-4 sans text-[12px] text-[#1A1A1A]/40">Memuat kalender...</div>}

      {/* detail card */}
      {selected && (
        <div className="m-3 md:m-4 rounded-[16px] border border-[#EDE3DA] bg-[#F6F1EB]/60 p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="sans text-[11px] tracking-[0.14em] uppercase text-[#1A1A1A]/40">
              {new Date(selected).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex sans text-[11px] tracking-[0.12em] uppercase px-3 py-1 rounded-full border font-medium ${
                  selectedStatus === "booked"
                    ? "bg-white text-[#1A1A1A] border-[#C9A96E]"
                    : selectedStatus === "blocked"
                      ? "bg-[#EDE3DA] text-[#1A1A1A] border-[#EDE3DA]"
                      : selectedStatus === "cancelled"
                        ? "bg-red-50 text-red-900 border-red-200 line-through"
                        : selectedStatus === "completed"
                          ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                          : "bg-white text-[#1A1A1A] border-[#EDE3DA]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {selectedStatus === "completed" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {selectedStatus === "cancelled" && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  {selectedStatus === "booked" && <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96E]" />}
                  {selectedStatus === "booked"
                    ? "Terisi"
                    : selectedStatus === "blocked"
                      ? "Blocked"
                      : selectedStatus === "cancelled"
                        ? "Batal"
                        : selectedStatus === "completed"
                          ? "Selesai"
                          : "Tersedia"}
                </span>
              </span>
              {selectedBooking?.package && <span className="sans text-[11px] font-medium text-[#1A1A1A] bg-white border border-[#EDE3DA] px-2 py-0.5 rounded-full">{selectedBooking.package}</span>}
            </div>
            {selectedBooking?.client && mode === "admin" && <div className="sans text-[12px] mt-2 text-[#1A1A1A]/70">Client: {selectedBooking.client}</div>}
            {selectedBooking?.notes && <div className="sans text-[12px] mt-1 text-[#1A1A1A]/50">{selectedBooking.notes}</div>}
            {!selectedBooking && <div className="sans text-[12px] mt-2 text-[#1A1A1A]/60">Slot masih kosong. Hubungi WA untuk booking.</div>}
            {mode === "customer" && selectedStatus === "available" && <div className="sans text-[11px] mt-2 text-[#C9A96E]">Silakan chat WA untuk amankan tanggal ini.</div>}
            {mode === "customer" && selectedStatus === "cancelled" && <div className="sans text-[11px] mt-2 text-[#1A1A1A]/50">Tanggal batal, posisi bisa ditanyakan kembali via WA.</div>}
          </div>
          <div className="flex gap-2 shrink-0">
            {mode === "customer" ? (
              waDisabled ? (
                <button
                  disabled
                  className="sans text-[11px] tracking-[0.14em] uppercase bg-[#1A1A1A]/10 text-[#1A1A1A]/50 border border-[#EDE3DA] px-5 h-10 inline-flex items-center rounded-full opacity-50 cursor-not-allowed select-none"
                  title={`${waLabel} - tidak bisa booking via WA`}
                >
                  {waLabel}
                </button>
              ) : (
                <a
                  href={`https://wa.me/6285179763693?text=Halo%20Hirena%20Makeup%20saya%20mau%20cek%20slot%20tanggal%20${selected}${selectedStatus === "cancelled" ? "%20(status%20batal%20apakah%20tersedia%20kembali)" : ""}`}
                  target="_blank"
                  rel="noopener"
                  className="sans text-[11px] tracking-[0.14em] uppercase bg-[#1A1A1A] text-white px-5 h-10 inline-flex items-center hover:bg-black transition rounded-full"
                >
                  Tanya via WA
                </a>
              )
            ) : (
              <span className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/40 border border-[#EDE3DA] bg-white px-4 h-9 inline-flex items-center rounded-full">Kelola di bawah</span>
            )}
          </div>
        </div>
      )}

      <div className="px-5 md:px-8 py-3 sans text-[10px] tracking-[0.12em] uppercase text-[#1A1A1A]/30 border-t border-[#EDE3DA]/60 flex justify-between">
        <span>Geser untuk ganti bulan</span>
        <span className="hidden md:inline">Hirena Makeup 2026</span>
      </div>
    </div>
  );
}
