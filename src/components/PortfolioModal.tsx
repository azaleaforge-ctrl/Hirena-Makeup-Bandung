"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { PortfolioCategory, PortfolioItem } from "@/lib/db";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function PortfolioModal({
  preview,
  categories,
  waLink,
  onClose,
}: {
  preview: PortfolioItem | null;
  categories: PortfolioCategory[];
  waLink: string;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {preview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-[#1A1A1A]/70 backdrop-blur-[8px]" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.34, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[560px] bg-[#FFFCFA] rounded-[22px] border border-[#EDE3DA] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-h-[86vh] flex flex-col will-change-transform"
          >
            <div className="relative aspect-[4/3] bg-[#F6F1EB] overflow-hidden shrink-0">
              {preview.imageUrl.startsWith("gradient:") ? (
                <div className="absolute inset-0 bg-gradient-to-br from-[#FFFCFA] via-[#F6F1EB] to-[#EDE3DA]" />
              ) : (
                <img
                  src={preview.imageUrl}
                  alt={preview.title}
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 768px) 100vw, 560px"
                  className="w-full h-full object-cover"
                />
              )}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 backdrop-blur border border-[#EDE3DA] flex items-center justify-center hover:bg-white transition"
              >
                <span className="text-[16px] leading-none">×</span>
              </button>
              <div className="absolute bottom-3 left-3 sans text-[11px] tracking-[0.12em] uppercase bg-white/90 backdrop-blur px-3 py-1 rounded-full border border-[#EDE3DA]">
                {categories.find((c) => c.id === preview.categoryId)?.name || preview.categoryId}
              </div>
            </div>
            <div className="p-5 md:p-6 overflow-auto">
              <div className="serif text-[20px] md:text-[22px] leading-[1.2]">{preview.title}</div>
              <div className="sans text-[12px] leading-[1.7] text-[#1A1A1A]/60 mt-2">{preview.description || "Soft glam look by Hirena Makeup"}</div>
              <div className="mt-5 flex gap-2">
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener"
                  className="flex-1 bg-[#1A1A1A] text-white sans text-[11px] tracking-[0.14em] uppercase h-10 inline-flex items-center justify-center hover:bg-black transition rounded-full"
                >
                  Tanya Look Ini via WA
                </a>
                <button
                  onClick={onClose}
                  className="px-6 h-10 border border-[#EDE3DA] bg-white sans text-[11px] tracking-[0.14em] uppercase hover:bg-[#F6F1EB] transition rounded-full"
                >
                  Tutup
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
