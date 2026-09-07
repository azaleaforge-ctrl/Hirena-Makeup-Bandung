"use client";
import { motion, AnimatePresence } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function UpdatePopup({
  show,
  countdown,
  onDismiss,
}: {
  show: boolean;
  countdown: number;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-start justify-center pt-20 px-4 pointer-events-none"
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="pointer-events-auto relative w-full max-w-[420px] bg-white/90 backdrop-blur-[16px] rounded-[20px] border border-[#EDE3DA] shadow-[0_16px_40px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden will-change-transform"
          >
            <div className="p-5 md:p-6 flex gap-4">
              <div className="shrink-0 w-9 h-9 rounded-full bg-[#C9A96E]/15 border border-[#C9A96E]/20 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-[#C9A96E] animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="sans text-[11px] tracking-[0.14em] uppercase text-[#C9A96E] font-medium">Pembaruan tersedia</div>
                <div className="serif text-[15px] leading-[1.4] mt-1">Web akan refresh dalam {countdown} detik</div>
                <div className="sans text-[11px] text-[#1A1A1A]/50 mt-1">Konten terbaru dari dashboard sudah siap.</div>
              </div>
              <button
                onClick={onDismiss}
                className="shrink-0 sans text-[11px] tracking-[0.12em] uppercase border border-[#EDE3DA] bg-white hover:bg-[#F6F1EB] px-3 h-8 rounded-full transition"
              >
                Dismiss
              </button>
            </div>
            <div className="h-[3px] bg-[#F6F1EB] w-full overflow-hidden">
              <motion.div
                className="h-full bg-[#C9A96E]"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 5, ease: "linear" }}
              />
            </div>
            <div className="px-5 pb-3 flex items-center gap-2 sans text-[10px] tracking-[0.12em] uppercase text-[#1A1A1A]/35">
              <span className="w-1 h-1 rounded-full bg-[#C9A96E]" />
              {countdown} · refresh otomatis
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
