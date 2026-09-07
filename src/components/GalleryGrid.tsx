"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { PortfolioCategory, PortfolioItem } from "@/lib/db";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function GalleryGrid({
  items,
  categories,
  onPreview,
}: {
  items: PortfolioItem[];
  categories: PortfolioCategory[];
  onPreview: (item: PortfolioItem) => void;
}) {
  const reduce = useReducedMotion();
  if (items.length === 0) {
    return (
      <div className="mt-6 sans text-[13px] text-[#1A1A1A]/40 bg-[#F6F1EB] rounded-[16px] border border-dashed border-[#EDE3DA] p-10 text-center">
        Belum ada foto di kategori ini.
      </div>
    );
  }
  return (
    <motion.div layout className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 mt-2">
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const catName = categories.find((c) => c.id === item.categoryId)?.name || "Tanpa kategori";
          const isGradient = item.imageUrl.startsWith("gradient:");
          return (
            <motion.div
              key={item.id}
              layout={!reduce}
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: reduce ? 0.2 : 0.42, ease: EASE }}
              whileHover={reduce ? {} : { y: -4, transition: { type: "spring", stiffness: 300, damping: 22 } }}
              onClick={() => onPreview(item)}
              className="group relative bg-[#FFFCFA] rounded-[22px] border border-[#EDE3DA] overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)] hover:border-[#C9A96E]/20 cursor-pointer will-change-transform"
            >
              <div className="aspect-[4/3] lg:aspect-[3/4] relative overflow-hidden bg-[#F6F1EB]">
                {isGradient ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-[#FFFCFA] via-[#F6F1EB] to-[#EDE3DA]" />
                    <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(120% 80% at 32% 22%, #C9A96E 0%, transparent 60%)` }} />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[68%] bg-gradient-to-t from-[#1A1A1A]/10 to-transparent rounded-t-full" />
                    <div className="absolute top-[24%] left-1/2 -translate-x-1/2 w-[38%] h-[24%] rounded-full bg-gradient-to-b from-[#EDE3DA] to-[#C9A96E]/20" />
                  </>
                ) : (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-700"
                  />
                )}
                <div className="absolute top-3 left-3 sans text-[10px] tracking-[0.12em] uppercase bg-white/90 backdrop-blur px-3 py-1 rounded-full border border-[#EDE3DA] shadow-sm">
                  {catName}
                </div>
                {item.featured && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#C9A96E] border-2 border-white shadow" />}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/0 via-transparent to-transparent group-hover:from-[#1A1A1A]/30 transition duration-500" />
              </div>
              <div className="p-3 lg:p-4">
                <div className="serif text-[15px] leading-[1.3] truncate">{item.title}</div>
                <div className="sans text-[11px] leading-[1.6] text-[#1A1A1A]/50 truncate mt-1">{item.description || "Soft glam look"}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="sans text-[10px] tracking-[0.14em] uppercase text-[#C9A96E] group-hover:text-[#8A6A2E] transition">Lihat detail</span>
                  <span className="w-6 h-6 rounded-full border border-[#EDE3DA] bg-[#F6F1EB] group-hover:bg-[#1A1A1A] group-hover:border-[#1A1A1A] flex items-center justify-center transition">
                    <span className="text-[11px] leading-none group-hover:text-white transition">↗</span>
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
