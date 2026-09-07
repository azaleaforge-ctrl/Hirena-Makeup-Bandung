"use client";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  AnimatePresence,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { getCategories, getPortfolioItems, getFeaturedItems, getSettings, getPrices, buildWaLink, extractWaNumberFromLink, normalizeWaNumber, getDefaultPrices, type PortfolioCategory, type PortfolioItem, type Prices } from "@/lib/db";
import { useHirenaSync } from "@/lib/sync";

const BookingCalendar = dynamic(() => import("@/components/BookingCalendar"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-[#F6F1EB] rounded-[16px] border border-[#EDE3DA]" />,
});
const UpdatePopup = dynamic(() => import("@/components/UpdatePopup"), {
  ssr: false,
  loading: () => null,
});
const PortfolioModal = dynamic(() => import("@/components/PortfolioModal"), {
  ssr: false,
  loading: () => null,
});
const GalleryGrid = dynamic(() => import("@/components/GalleryGrid"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-[#F6F1EB] rounded-[22px] border border-[#EDE3DA] mt-2" />,
});

const DEFAULT_WA = "6285179763693";
const WA_LINK_FALLBACK = buildWaLink(DEFAULT_WA);
const IG_LINK = "https://instagram.com/hirenamakeup";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const revealVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: EASE },
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const wordVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE },
  },
};

function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      variants={revealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px", amount: 0.18 }}
      transition={{ duration: 0.55, ease: EASE, delay }}
      style={{ willChange: "transform, opacity" } as any}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StaggerReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px", amount: 0.15 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function GoldLine({ delay = 0, spring = false }: { delay?: number; spring?: boolean }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className="w-8 h-px bg-[#C9A96E]" />;
  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0.7 }}
      whileInView={{ scaleX: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={
        spring
          ? { type: "spring", stiffness: 200, damping: 28, delay, mass: 0.8 }
          : { duration: 0.9, ease: EASE, delay }
      }
      style={{ originX: 0 }}
      className="w-8 h-px bg-[#C9A96E] will-change-transform"
    />
  );
}

function CountUp({ to, suffix = "", className = "" }: { to: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setInView(true);
      },
      { threshold: 0.5 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [inView]);
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(to);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const dur = 1300;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return (
    <span ref={ref} className={className}>
      {val}
      {suffix}
    </span>
  );
}

function MagneticCTA({
  href,
  children,
  variant = "dark",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "dark" | "light" | "ghost";
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const upd = () => setIsDesktop(m.matches);
    upd();
    m.addEventListener("change", upd);
    return () => m.removeEventListener("change", upd);
  }, []);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 260, damping: 18 });
  const sy = useSpring(my, { stiffness: 260, damping: 18 });
  const enableMagnetic = !reduce && isDesktop;

  const handleMove = (e: React.MouseEvent) => {
    if (!enableMagnetic || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    mx.set((e.clientX - cx) * 0.18);
    my.set((e.clientY - cy) * 0.22);
  };
  const handleLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const base =
    variant === "dark"
      ? "bg-[#1A1A1A] text-white hover:bg-black shadow-[0_8px_24px_rgba(0,0,0,0.14)]"
      : variant === "light"
      ? "bg-[#FFFCFA] text-[#1A1A1A] border border-[#EDE3DA] hover:bg-white"
      : "border border-[#EDE3DA] bg-white hover:bg-[#F6F1EB]";

  return (
    <motion.a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={enableMagnetic ? { x: sx, y: sy, willChange: "transform" as any } : undefined}
      whileHover={enableMagnetic ? { scale: 1.02 } : {}}
      whileTap={enableMagnetic ? { scale: 0.98 } : {}}
      className={`relative overflow-hidden sans text-[11px] tracking-[0.16em] uppercase px-7 h-[48px] inline-flex items-center gap-2 transition ${base} group will-change-transform`}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.28) 50%, transparent 70%)",
        }}
        initial={{ x: "-120%" }}
        whileHover={{ x: "120%" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A96E]/0 to-transparent group-hover:via-[#C9A96E]/40 transition duration-700" />
    </motion.a>
  );
}

function Header({ waLink }: { waLink?: string }) {
  const waHref = waLink || WA_LINK_FALLBACK;
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const diff = y - lastY.current;
      if (y > 120 && diff > 6) setHidden(true);
      else if (diff < -4 || y <= 120) setHidden(false);
      setScrolled(y > 12);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.div
        style={{ scaleX: progress, originX: 0 }}
        className="fixed top-0 left-0 right-0 h-[2px] bg-[#C9A96E] z-[60] origin-left will-change-transform"
      />
      <motion.header
        animate={{ y: hidden && !open ? -72 : 0 }}
        transition={
          reduce
            ? { duration: 0.2 }
            : { type: "spring", stiffness: 300, damping: 30, mass: 0.9 }
        }
        style={
          {
            backdropFilter: scrolled ? "blur(18px) saturate(1.15)" : "blur(10px) saturate(1)",
            WebkitBackdropFilter: scrolled ? "blur(18px) saturate(1.15)" : "blur(10px) saturate(1)",
          } as any
        }
        className={`sticky top-0 z-50 border-b transition-colors duration-500 ${
          scrolled ? "bg-[#FFFCFA]/86 border-[#E2D5C6]/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)]" : "bg-[#FFFCFA]/72 border-[#EDE3DA]"
        }`}
      >
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a href="#" className="serif text-[18px] tracking-[0.18em] font-medium hover:opacity-80 transition">
              HIRENA MAKEUP
            </a>
            <nav className="hidden lg:flex items-center gap-8 sans text-[11px] tracking-[0.14em] uppercase font-light text-[#1A1A1A]/70">
              <a href="#portfolio" className="hover:text-[#1A1A1A] transition relative group">
                Portfolio <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#C9A96E] group-hover:w-full transition-all duration-400" />
              </a>
              <a href="#reguler" className="hover:text-[#1A1A1A] transition relative group">
                Reguler <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#C9A96E] group-hover:w-full transition-all" />
              </a>
              <a href="#bride" className="hover:text-[#1A1A1A] transition relative group">
                Bride <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#C9A96E] group-hover:w-full transition-all" />
              </a>
              <a href="#notes" className="hover:text-[#1A1A1A] transition relative group">
                Notes <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#C9A96E] group-hover:w-full transition-all" />
              </a>
              <a href="#contact" className="hover:text-[#1A1A1A] transition relative group">
                Contact <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#C9A96E] group-hover:w-full transition-all" />
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <MagneticCTA href={waHref} variant="dark">
              Book via WA
            </MagneticCTA>
            <button
              onClick={() => setOpen(!open)}
              aria-label="menu"
              aria-expanded={open}
              className="lg:hidden w-10 h-10 border border-[#EDE3DA] flex items-center justify-center bg-[#FFFCFA] hover:bg-[#F6F1EB] transition"
            >
              <div className="space-y-1.5">
                <div className={`w-4 h-px bg-[#1A1A1A] transition ${open ? "rotate-45 translate-y-[3px]" : ""}`} />
                <div className={`w-4 h-px bg-[#1A1A1A] transition ${open ? "-rotate-45 -translate-y-[3px]" : ""}`} />
              </div>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.38, ease: EASE }}
              className="lg:hidden overflow-hidden border-t border-[#EDE3DA] bg-[#FFFCFA]"
            >
              <div className="px-6 py-7 sans text-[12px] tracking-[0.14em] uppercase space-y-5">
                {["portfolio", "reguler", "bride", "notes", "contact"].map((id, i) => (
                  <motion.a
                    key={id}
                    onClick={() => setOpen(false)}
                    href={`#${id}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.4, ease: EASE }}
                    className="block hover:text-[#C9A96E] transition"
                  >
                    {id}
                  </motion.a>
                ))}
                <a
                  href={waHref}
                  target="_blank"
                  className="inline-flex mt-2 bg-[#1A1A1A] text-white px-6 h-11 items-center gap-2 hover:bg-black transition"
                >
                  Book via WA <span className="text-[#C9A96E]">→</span>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
}

function PortfolioCard({ i, scrollYProgress, item }: { i: number; scrollYProgress: any; item?: PortfolioItem }) {
  const reduce = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const upd = () => setIsDesktop(m.matches);
    upd();
    m.addEventListener("change", upd);
    return () => m.removeEventListener("change", upd);
  }, []);
  const y = useTransform(scrollYProgress, [0, 1], [0, -12 - (i % 3) * 4]);

  const isGradient = !item || item.imageUrl.startsWith("gradient:");
  const title = item?.title || `Soft Glam #${i + 1}`;

  if (reduce || !isDesktop) {
    return (
      <div className="group relative aspect-[3/4] overflow-hidden bg-[#F6F1EB] rounded-[22px] border border-[#EDE3DA] shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
        {isGradient ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#FFFCFA] via-[#F6F1EB] to-[#EDE3DA]" />
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                background: `radial-gradient(120% 80% at ${28 + i * 6}% ${18 + i * 4}%, #C9A96E 0%, transparent 62%)`,
              }}
            />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[68%] h-[72%] bg-gradient-to-t from-[#1A1A1A]/10 to-transparent rounded-t-full" />
            <div className="absolute top-[22%] left-1/2 -translate-x-1/2 w-[38%] h-[26%] rounded-full bg-gradient-to-b from-[#EDE3DA] to-[#C9A96E]/20 shadow-inner" />
          </>
        ) : (
          <img src={item!.imageUrl} alt={title} loading="lazy" decoding="async" sizes="(max-width: 768px) 42vw, 33vw" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-[#1A1A1A]/40 to-transparent">
          <div className="sans text-[9px] tracking-[0.16em] uppercase text-white">{title}</div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      style={{ y, willChange: "transform" } as any}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay: i * 0.055, duration: 0.6, ease: EASE }}
      whileHover={{ y: -6, scale: 1.02, transition: { type: "spring", stiffness: 320, damping: 22 } }}
      className="group relative aspect-[3/4] overflow-hidden bg-[#F6F1EB] rounded-[22px] border border-[#EDE3DA] shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_32px_rgba(201,169,110,0.18),0_4px_16px_rgba(0,0,0,0.08)] will-change-transform cursor-pointer"
    >
      <div className="absolute inset-0">
        {isGradient ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#FFFCFA] via-[#F6F1EB] to-[#EDE3DA]" />
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                background: `radial-gradient(120% 80% at ${28 + i * 6}% ${18 + i * 4}%, #C9A96E 0%, transparent 62%)`,
              }}
            />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[68%] h-[72%] bg-gradient-to-t from-[#1A1A1A]/10 to-transparent rounded-t-full" />
            <div className="absolute top-[22%] left-1/2 -translate-x-1/2 w-[38%] h-[26%] rounded-full bg-gradient-to-b from-[#EDE3DA] to-[#C9A96E]/20 shadow-inner" />
            <div className="absolute top-[22%] left-1/2 -translate-x-1/2 w-[16%] h-[9%] rounded-full bg-[#1A1A1A]/5 blur-[6px] mt-[22px]" />
          </>
        ) : (
          <img src={item!.imageUrl} alt={title} loading="lazy" decoding="async" sizes="(max-width: 768px) 42vw, 33vw" className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/55 via-[#1A1A1A]/0 to-transparent opacity-0 group-hover:opacity-100 transition duration-500" />
      <div className="absolute bottom-0 inset-x-0 p-3 translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition duration-500">
        <div className="sans text-[9px] tracking-[0.16em] uppercase text-white drop-shadow">{title}</div>
        <div className="sans text-[8px] tracking-[0.12em] uppercase text-white/70 mt-0.5">{item?.description || "Soft glam · Bandung 2026"}</div>
      </div>
      <div className="absolute top-3 right-3 w-5 h-5 rounded-full border border-white/60 backdrop-blur bg-white/30 hidden md:flex items-center justify-center opacity-60 group-hover:opacity-100 group-hover:scale-110 transition">
        <div className="w-1 h-1 rounded-full bg-white" />
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-[22px] border border-transparent group-hover:border-[#C9A96E]/30 transition duration-500" />
    </motion.div>
  );
}

export default function Home() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.22], [0, -46]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.18], [1, 0.94]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.99]);
  const reduce = useReducedMotion();

  const line1 = ["Soft", "Glam"];
  const line2 = ["that", "still"];
  const line3 = ["looks", "like"];
  const line4 = ["you."];

  const [categories, setCategories] = useState<PortfolioCategory[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [featured, setFeatured] = useState<PortfolioItem[]>([]);
  const [galleryFilter, setGalleryFilter] = useState<string>("all");
  const [preview, setPreview] = useState<PortfolioItem | null>(null);
  const [regulerTab, setRegulerTab] = useState<"basic" | "premium">("premium");
  const [prices, setPrices] = useState<Prices | null>(null);
  const [waNumber, setWaNumber] = useState<string>(DEFAULT_WA);

  const waLink = buildWaLink(waNumber);
  const fallbackPrices = getDefaultPrices();
  const basicItems = prices ? prices.basic : fallbackPrices.basic;
  const premiumItems = prices ? prices.premium : fallbackPrices.premium;
  const basicNote = prices ? prices.basicNote : fallbackPrices.basicNote;
  const premiumNote = prices ? prices.premiumNote : fallbackPrices.premiumNote;
  const hasBasic = prices ? prices.basic.length > 0 : true;
  const hasPremium = prices ? prices.premium.length > 0 : true;

  const [showUpdate, setShowUpdate] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [pendingReload, setPendingReload] = useState(false);
  const hasMountedRef = useRef(false);
  const showRef = useRef(false);

  const fetchPortfolio = useCallback(async () => {
    try {
      const [cats, all, feat] = await Promise.all([getCategories(), getPortfolioItems(), getFeaturedItems(9)]);
      setCategories(cats);
      setItems(all);
      setFeatured(feat);
    } catch {}
  }, []);

  useEffect(() => {
    const run = () => fetchPortfolio();
    if (typeof window !== "undefined" && "requestIdleCallback" in window) (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(run, { timeout: 2000 });
    else run();
  }, [fetchPortfolio]);

  useHirenaSync("portfolio", fetchPortfolio, 15000);

  const fetchPricesAndWa = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([getSettings(), getPrices()]);
      setPrices(p);
      const num = s.waNumber || extractWaNumberFromLink(s.waLink || "") || DEFAULT_WA;
      setWaNumber(normalizeWaNumber(num) || DEFAULT_WA);
    } catch {}
  }, []);

  useEffect(() => {
    const run = () => fetchPricesAndWa();
    if (typeof window !== "undefined" && "requestIdleCallback" in window) (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(run, { timeout: 2000 });
    else run();
  }, [fetchPricesAndWa]);

  useHirenaSync("settings", fetchPricesAndWa, 15000);
  useHirenaSync("prices", fetchPricesAndWa, 15000);

  // popup realtime listeners - reload tetap jalan meski di-dismiss (pendingReload decoupled dari visibility)
  const triggerUpdate = useCallback(() => {
    if (!hasMountedRef.current) return;
    if (showRef.current) return;
    showRef.current = true;
    setPendingReload(true);
    setShowUpdate(true);
    setCountdown(5);
  }, []);

  useEffect(() => {
    const grace = window.setTimeout(() => {
      hasMountedRef.current = true;
    }, 2200);
    return () => window.clearTimeout(grace);
  }, []);

  // single realtime listener for update popup (15s poll, single BroadcastChannel/storage)
  useHirenaSync(triggerUpdate, 15000);

  useEffect(() => {
    if (!pendingReload) return;
    const iv = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(iv);
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(iv);
  }, [pendingReload]);

  const handleDismiss = useCallback(() => {
    // hanya sembunyikan popup, reload tetap jalan (pendingReload tetap true)
    setShowUpdate(false);
  }, []);

  const galleryItems = galleryFilter === "all" ? items : items.filter((it) => it.categoryId === galleryFilter);

  return (
    <MotionConfig reducedMotion="user">
      <main className="bg-[#FFFCFA] text-[#1A1A1A] overflow-x-hidden selection:bg-[#C9A96E] selection:text-white">
        <UpdatePopup show={showUpdate} countdown={countdown} onDismiss={handleDismiss} />

        <div className="pointer-events-none fixed inset-0 z-0">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
          {!reduce ? (
            <>
              <motion.div
                className="absolute -top-32 -right-32 w-[520px] h-[520px] bg-[#C9A96E]/10 blur-[80px] rounded-full will-change-transform"
                animate={{ x: [0, 28, -12, 0], y: [0, -18, 14, 0], scale: [1, 1.04, 0.98, 1] }}
                transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute top-[620px] -left-40 w-[640px] h-[640px] bg-[#EDE3DA]/50 blur-[90px] rounded-full will-change-transform"
                animate={{ x: [0, -22, 16, 0], y: [0, 12, -10, 0], scale: [1, 0.98, 1.03, 1] }}
                transition={{ duration: 24, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
              />
              <motion.div
                className="absolute top-[1180px] right-[6%] w-[380px] h-[380px] bg-[#C9A96E]/07 blur-[70px] rounded-full will-change-transform"
                animate={{ x: [0, 14, -10, 0], y: [0, 16, -12, 0] }}
                transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              />
            </>
          ) : (
            <>
              <div className="absolute -top-32 -right-32 w-[520px] h-[520px] bg-[#C9A96E]/10 blur-[80px] rounded-full" />
              <div className="absolute top-[600px] -left-40 w-[640px] h-[640px] bg-[#EDE3DA]/50 blur-[90px] rounded-full" />
            </>
          )}
        </div>

        <Header waLink={waLink} />

        {/* HERO */}
        <section className="relative z-10 mx-auto max-w-[1280px] px-6 lg:px-10 pt-8 lg:pt-20 pb-10 lg:pb-20">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-20 items-start">
            <motion.div style={reduce ? {} : { y: heroY, opacity: heroOpacity, scale: heroScale }} className="will-change-transform text-center lg:text-left">
              <Reveal>
                <div className="flex items-center gap-3 mb-5 lg:mb-8 justify-center lg:justify-start">
                  <GoldLine spring />
                  <span className="sans text-[10px] tracking-[0.22em] uppercase text-[#C9A96E] font-medium">
                    Price List 2026 · Bandung
                  </span>
                </div>
              </Reveal>

              {reduce ? (
                <h1 className="serif text-[32px] sm:text-[36px] lg:text-[72px] leading-[0.95] tracking-[-0.025em] font-[400] text-center lg:text-left pb-1 overflow-visible">
                  Soft Glam
                  <br />
                  <span className="serif2 italic font-light text-[#1A1A1A]/80">that still</span>
                  <br />
                  looks like
                  <br />
                  <span className="inline-block pb-1">you.</span>
                </h1>
              ) : (
                <motion.h1
                  className="serif text-[32px] sm:text-[36px] lg:text-[72px] leading-[0.95] tracking-[-0.025em] font-[400] text-center lg:text-left overflow-visible"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.span className="block overflow-hidden py-1 -my-1" variants={containerVariants}>
                    {line1.map((w) => (
                      <motion.span key={w} variants={wordVariants} className="inline-block mr-[0.18em] will-change-transform">
                        {w}
                      </motion.span>
                    ))}
                  </motion.span>
                  <motion.span className="block overflow-hidden serif2 italic font-light text-[#1A1A1A]/80 py-1 -my-1" variants={containerVariants}>
                    {line2.map((w) => (
                      <motion.span key={w} variants={wordVariants} className="inline-block mr-[0.18em] will-change-transform">
                        {w}
                      </motion.span>
                    ))}
                  </motion.span>
                  <motion.span className="block overflow-hidden py-1 -my-1" variants={containerVariants}>
                    {line3.map((w) => (
                      <motion.span key={w} variants={wordVariants} className="inline-block mr-[0.18em] will-change-transform">
                        {w}
                      </motion.span>
                    ))}
                  </motion.span>
                  <motion.span className="block overflow-hidden pb-2 -mb-2 pt-1 -mt-1" variants={containerVariants}>
                    {line4.map((w) => (
                      <motion.span key={w} variants={wordVariants} className="inline-block will-change-transform pb-1">
                        {w}
                      </motion.span>
                    ))}
                  </motion.span>
                </motion.h1>
              )}

              <Reveal delay={0.22}>
                <p className="sans text-[13px] lg:text-[14px] leading-[1.85] font-light text-[#1A1A1A]/70 max-w-[420px] mt-5 lg:mt-7 mx-auto lg:mx-0 text-center lg:text-left">
                  Certified Bandung MUA Since 2022. Signature{" "}
                  <span className="text-[#1A1A1A] font-medium">low visual and soft glam look</span> · mostly using mix high
                  end, Asian and local products. Durasi 1.5 to 3 jam, detail oriented.
                </p>
              </Reveal>
              <Reveal delay={0.28}>
                <motion.div
                  initial={reduce ? {} : { opacity: 0, y: 12 }}
                  whileInView={reduce ? {} : { opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.52, duration: 0.6, ease: EASE }}
                  className="mt-6 lg:mt-8 flex flex-col lg:flex-row gap-3 w-full max-w-full lg:max-w-[420px] mx-auto lg:mx-0 box-border lg:w-auto"
                >
                  <motion.a
                    href={waLink}
                    target="_blank"
                    rel="noopener"
                    whileHover={reduce ? {} : { scale: 1.02, y: -1 }}
                    whileTap={reduce ? {} : { scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    className="group relative overflow-hidden w-full lg:w-auto flex-none min-w-0 box-border max-w-full inline-flex items-center justify-center gap-2 sans text-[11px] tracking-[0.16em] uppercase bg-[#1A1A1A] text-white h-12 lg:h-[46px] px-4 lg:px-6 rounded-full border border-[#1A1A1A] shadow-sm hover:bg-black hover:shadow-[0_8px_24px_rgba(0,0,0,0.14)] hover:border-black transition-all duration-300 lg:shrink-0 whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    <span className="relative z-10 flex items-center gap-2 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis justify-center">
                      <span className="truncate">Cek Slot · WA</span> <span className="text-[#C9A96E] group-hover:translate-x-0.5 transition-transform duration-300 shrink-0">→</span>
                    </span>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background:
                          "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)",
                        transform: "translateX(-120%)",
                      }}
                    />
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(100deg, transparent 32%, rgba(255,255,255,0.26) 50%, transparent 68%)",
                      }}
                      initial={{ x: "-120%" }}
                      whileHover={{ x: "120%" }}
                      transition={{ duration: 0.9, ease: EASE }}
                    />
                  </motion.a>
                  <motion.a
                    href="#reguler"
                    whileHover={reduce ? {} : { scale: 1.02, y: -1 }}
                    whileTap={reduce ? {} : { scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    className="w-full lg:w-auto flex-none min-w-0 box-border max-w-full inline-flex items-center justify-center sans text-[11px] tracking-[0.16em] uppercase border border-[#EDE3DA] bg-white lg:bg-transparent text-[#1A1A1A] h-12 lg:h-[46px] px-4 lg:px-6 rounded-full hover:bg-[#F6F1EB] hover:border-[#C9A96E] hover:text-[#1A1A1A] transition-all duration-300 lg:shrink-0 whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    Price List
                  </motion.a>
                </motion.div>
              </Reveal>
              <Reveal delay={0.34}>
                <div className="mt-8 lg:mt-10 grid grid-cols-3 gap-3 lg:flex lg:items-center lg:gap-6 border-t border-[#EDE3DA] pt-6 w-full max-w-full lg:max-w-[420px] mx-auto lg:mx-0 box-border">
                  <div className="flex -space-x-2 justify-center lg:justify-start col-span-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        initial={reduce ? {} : { scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.6 + i * 0.08, duration: 0.5, ease: EASE }}
                        className="w-8 h-8 rounded-full border-[2px] border-white bg-[#EDE3DA] overflow-hidden"
                      >
                        <div className="w-full h-full bg-gradient-to-br from-[#EDE3DA] to-[#C9A96E]/40" />
                      </motion.div>
                    ))}
                  </div>
                  <div className="sans text-[10px] lg:text-[11px] leading-[1.5] text-[#1A1A1A]/60 col-span-2 lg:col-auto">
                    <span className="text-[#1A1A1A] font-medium">
                      <CountUp to={500} suffix="+" />
                    </span>{" "}
                    clients · <span className="text-[#1A1A1A] font-medium">4.9/5</span> rating
                    <br />
                    IG @hirenamakeup
                  </div>
                  <div className="hidden lg:block h-6 w-px bg-[#EDE3DA]" />
                  <div className="hidden lg:block sans text-[10px] tracking-[0.12em] uppercase text-[#1A1A1A]/40">Bandung · Since 2022</div>
                </div>
              </Reveal>
            </motion.div>

            {/* right portfolio - hero sample featured - hidden on mobile per fix */}
            <div className="relative hidden lg:block">
              <div className="hidden xl:block absolute -left-10 top-6 bottom-6">
                <div
                  className="sans text-[9px] tracking-[0.26em] uppercase text-[#1A1A1A]/30"
                  style={{ writingMode: "vertical-rl" }}
                >
                  Signature Low Visual · 2022 to 2026
                </div>
              </div>

              {/* desktop grid */}
              <div className="hidden lg:grid grid-cols-3 gap-3">
                {(featured.length > 0 ? featured : Array.from({ length: 9 }).map((_, i) => null)).map((it, i) => (
                  <PortfolioCard key={it ? it.id : i} i={i} scrollYProgress={scrollYProgress} item={it || undefined} />
                ))}
              </div>

              {/* mobile snap - hidden on mobile per fix: hapus foto di bawah Price List on mobile, keep desktop grid */}
              <div className="hidden lg:hidden -mx-6 px-6 relative">
                <div
                  className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide overscroll-x-contain scroll-smooth touch-pan-x"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch", scrollPaddingInline: "24px", overscrollBehaviorX: "contain", touchAction: "pan-x pinch-zoom" } as any}
                >
                  {(featured.length > 0 ? featured : Array.from({ length: 9 }).map((_, i) => null)).map((it, i) => {
                    const isGradient = !it || it.imageUrl.startsWith("gradient:");
                    const title = it?.title || `Soft Glam #${i + 1}`;
                    return (
                      <motion.div
                        key={it ? it.id : i}
                        initial={reduce ? {} : { opacity: 0, scale: 0.96, y: 12 }}
                        whileInView={reduce ? {} : { opacity: 1, scale: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.04, duration: 0.6, ease: EASE }}
                        className="flex-none snap-center w-[44vw] max-w-[168px] aspect-[3/4] relative overflow-hidden bg-[#F6F1EB] rounded-[22px] border border-[#EDE3DA] will-change-transform"
                      >
                        {isGradient ? (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-br from-[#FFFCFA] via-[#F6F1EB] to-[#EDE3DA]" />
                            <div
                              className="absolute inset-0 opacity-30"
                              style={{
                                background: `radial-gradient(120% 80% at 30% 20%, #C9A96E 0%, transparent 60%)`,
                              }}
                            />
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[70%] bg-gradient-to-t from-[#1A1A1A]/10 to-transparent rounded-t-full" />
                            <div className="absolute top-[24%] left-1/2 -translate-x-1/2 w-[42%] h-[26%] rounded-full bg-gradient-to-b from-[#EDE3DA] to-[#C9A96E]/20" />
                          </>
                        ) : (
                          <img src={it!.imageUrl} alt={title} loading="lazy" decoding="async" sizes="42vw" className="absolute inset-0 w-full h-full object-cover" />
                        )}
                        <div className="absolute bottom-2 inset-x-2 text-center sans text-[8px] tracking-[0.14em] uppercase text-[#1A1A1A]/60 bg-white/80 backdrop-blur rounded-full py-1">
                          {title}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="flex gap-1.5 justify-center mt-1">
                  <div className="w-6 h-1 rounded-full bg-[#1A1A1A]" />
                  <div className="w-1 h-1 rounded-full bg-[#EDE3DA]" />
                  <div className="w-1 h-1 rounded-full bg-[#EDE3DA]" />
                </div>
              </div>

              <Reveal delay={0.2} className="mt-4">
                <div className="flex items-center gap-3">
                  <GoldLine delay={0.2} spring />
                  <p className="sans text-[10px] tracking-[0.14em] uppercase text-[#1A1A1A]/45">
                    Signature Low Visual · 2022 to 2026 | Bandung soft glam specialist
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* PORTFOLIO GALERI KATEGORI */}
        <section id="portfolio" className="relative z-10 mx-auto max-w-[1280px] px-6 lg:px-10 py-8 lg:py-12">
          <Reveal>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 lg:gap-6 mb-6 lg:mb-8">
              <div>
                <div className="flex items-center gap-3">
                  <GoldLine spring />
                  <span className="sans text-[10px] tracking-[0.22em] uppercase text-[#C9A96E]">Portfolio · Galeri</span>
                </div>
                <h2 className="serif text-[28px] lg:text-[44px] leading-[0.95] mt-3">
                  Karya kurasi
                  <br />
                  <span className="serif2 italic font-light">per kategori.</span>
                </h2>
              </div>
              <p className="sans text-[12px] leading-[1.7] text-[#1A1A1A]/50 max-w-[360px]">
                Filter berdasarkan kategori. Tap foto untuk preview. Data langsung dari dashboard dan update realtime.
              </p>
            </div>
          </Reveal>

          {/* filter pills - mobile sticky */}
          <div className="sticky top-[72px] z-10 -mx-6 px-6 lg:mx-0 lg:px-0 bg-[#FFFCFA]/95 backdrop-blur supports-[backdrop-filter]:bg-[#FFFCFA]/85 border-b border-[#EDE3DA]/0 lg:border-0 lg:static lg:bg-transparent lg:backdrop-blur-none py-3 lg:py-0 mb-2 lg:mb-0">
            <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setGalleryFilter("all")}
                className={`shrink-0 snap-start sans text-[11px] tracking-[0.12em] uppercase px-4 lg:px-5 h-8 lg:h-9 rounded-full border transition ${galleryFilter === "all" ? "bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-[0_4px_12px_rgba(0,0,0,0.12)]" : "bg-white border-[#EDE3DA] text-[#1A1A1A] hover:border-[#C9A96E]/30 hover:bg-[#F6F1EB]"}`}
              >
                Semua {items.length > 0 && `· ${items.length}`}
              </button>
              {categories.map((c) => {
                const count = items.filter((it) => it.categoryId === c.id).length;
                const active = galleryFilter === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setGalleryFilter(c.id)}
                    className={`shrink-0 snap-start sans text-[11px] tracking-[0.12em] uppercase px-4 lg:px-5 h-8 lg:h-9 rounded-full border transition ${active ? "bg-[#C9A96E] text-[#1A1A1A] border-[#C9A96E] shadow-[0_4px_12px_rgba(201,169,110,0.2)] font-medium" : "bg-white border-[#EDE3DA] text-[#1A1A1A] hover:border-[#C9A96E]/30 hover:bg-[#F6F1EB]"}`}
                  >
                    {c.name} {count > 0 && `· ${count}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* gallery grid - extracted to dynamic GalleryGrid for code splitting */}
          <GalleryGrid items={galleryItems} categories={categories} onPreview={setPreview} />

          <Reveal delay={0.12}>
            <div className="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
              <a href={IG_LINK} target="_blank" rel="noopener" className="sans text-[11px] tracking-[0.14em] uppercase border border-[#EDE3DA] bg-white px-6 h-11 inline-flex items-center hover:bg-[#F6F1EB] transition rounded-full">
                Lihat IG @hirenamakeup
              </a>
              <MagneticCTA href={waLink} variant="ghost">
                Konsultasi via WA
              </MagneticCTA>
            </div>
          </Reveal>
        </section>

        {/* preview modal */}
        {/* portfolio modal - dynamic import for code splitting */}
        <PortfolioModal preview={preview} categories={categories} waLink={waLink} onClose={() => setPreview(null)} />

        {/* ASAL USUL */}
        <section className="relative z-10 bg-[#F6F1EB] border-y border-[#EDE3DA]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-10 lg:py-20">
            <div className="grid lg:grid-cols-[0.75fr_1.25fr] gap-8 lg:gap-16 items-start">
              <Reveal>
                <div className="flex items-center gap-3 lg:block">
                  <div className="sans text-[10px] tracking-[0.22em] uppercase text-[#C9A96E] flex items-center gap-3">
                    <span className="hidden lg:block w-8 h-px bg-[#C9A96E]" />
                    Asal Usul
                  </div>
                  <div className="lg:hidden w-6 h-px bg-[#C9A96E]" />
                </div>
                <h2 className="serif text-[28px] lg:text-[42px] leading-[0.95] mt-3">
                  From 2022,
                  <br />
                  <span className="serif2 italic font-light">Tempaan Signature</span>
                </h2>
                <div className="mt-5 w-12 h-px bg-[#C9A96E] hidden lg:block" />
              </Reveal>
              <div>
                <Reveal delay={0.08}>
                  <div className="sans text-[13px] lg:text-[13.5px] leading-[1.85] text-[#1A1A1A]/70 space-y-4">
                    <p>
                      Hirena memulai perjalanan sejak 2022 dengan obsesi pada detail yang halus. Bukan makeup yang
                      mengubah wajah, tapi yang mengangkat karakter aslinya. Soft glam yang tetap terlihat seperti kamu,
                      hanya versi paling terawat.
                    </p>
                    <p className="text-[#1A1A1A]/60">
                      Setiap sesi dirancang personal, konsultasi tone kulit, bentuk wajah, dan preferensi hijab. Produk
                      kurasi mix high end, Asian dan lokal untuk hasil tahan lama namun tetap ringan di kulit.
                    </p>
                  </div>
                </Reveal>
                <StaggerReveal className="mt-8 grid grid-cols-2 gap-4 max-w-[420px]">
                  {[
                    { big: "1.5 to 3 jam", small: "Durasi detail oriented" },
                    { big: "Mix High End", small: "Asian and local curated" },
                  ].map((c) => (
                    <motion.div
                      key={c.big}
                      variants={revealVariants}
                      whileHover={reduce ? {} : { y: -3, scale: 1.01 }}
                      className="bg-white rounded-[16px] border border-[#EDE3DA] p-5 hover:border-[#C9A96E]/25 hover:shadow-[0_8px_22px_rgba(201,169,110,0.12)] transition will-change-transform"
                    >
                      <div className="serif text-[22px] leading-none">{c.big}</div>
                      <div className="sans text-[10px] tracking-[0.14em] uppercase text-[#1A1A1A]/40 mt-2">{c.small}</div>
                    </motion.div>
                  ))}
                </StaggerReveal>
                <Reveal delay={0.18}>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {["IG @hirenamakeup", "WA 0851 7976 3693", "Free mini touch up kit Premium"].map((t) => (
                      <motion.span
                        key={t}
                        whileHover={reduce ? {} : { y: -1, scale: 1.02 }}
                        className="sans text-[10px] tracking-[0.14em] uppercase border border-[#EDE3DA] bg-white/60 px-3 py-2 rounded-full hover:border-[#C9A96E]/30 hover:bg-white transition will-change-transform"
                      >
                        {t}
                      </motion.span>
                    ))}
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* REGULER */}
        <section id="reguler" className="relative z-10 mx-auto max-w-[1280px] px-6 lg:px-10 py-10 lg:py-20">
          <Reveal>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 lg:gap-6 mb-6 lg:mb-10">
              <div>
                <div className="flex items-center gap-3">
                  <GoldLine spring />
                  <span className="sans text-[10px] tracking-[0.22em] uppercase text-[#C9A96E]">Pricelist Reguler 2026</span>
                </div>
                <h2 className="serif text-[28px] lg:text-[44px] leading-[0.95] mt-3">
                  Wisuda, Event
                  <br />
                  <span className="serif2 italic font-light">and Daily Glam</span>
                </h2>
              </div>
              <p className="sans text-[12px] leading-[1.7] text-[#1A1A1A]/50 max-w-[360px]">
                Untuk wisuda, bridesmaid, photoshoot, dan acara formal. Pilih sesuai kebutuhan retouch kamu.
              </p>
            </div>
          </Reveal>

          {/* mobile tabs BASIC | PREMIUM */}
          {hasBasic && hasPremium && (
            <div className="lg:hidden flex p-1 bg-[#F6F1EB] rounded-full border border-[#EDE3DA] mb-5">
              <button
                onClick={() => setRegulerTab("basic")}
                className={`flex-1 h-10 rounded-full sans text-[11px] tracking-[0.12em] uppercase font-medium transition ${regulerTab === "basic" ? "bg-white shadow-sm border border-[#EDE3DA] text-[#1A1A1A]" : "text-[#1A1A1A]/60"}`}
              >
                Basic
              </button>
              <button
                onClick={() => setRegulerTab("premium")}
                className={`flex-1 h-10 rounded-full sans text-[11px] tracking-[0.12em] uppercase font-medium transition ${regulerTab === "premium" ? "bg-[#1A1A1A] text-white shadow-sm" : "text-[#1A1A1A]/60"}`}
              >
                Premium
              </button>
            </div>
          )}

          {/* mobile single card */}
          {!hasBasic && !hasPremium ? (
            <div className="lg:hidden sans text-[12px] text-[#1A1A1A]/40 bg-[#F6F1EB] rounded-[16px] border border-dashed border-[#EDE3DA] p-8 text-center">Daftar harga segera hadir.</div>
          ) : (
            <div className="lg:hidden">
              {hasBasic && hasPremium ? (
                regulerTab === "basic" ? (
                  <motion.div
                    key="basic-m"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="bg-[#FFFCFA] rounded-[24px] border border-[#EDE3DA] p-6 shadow-sm"
                  >
                    <div className="flex items-baseline justify-between">
                      <h3 className="serif text-[20px] tracking-[0.12em]">BASIC</h3>
                      <span className="sans text-[10px] tracking-[0.16em] uppercase text-[#1A1A1A]/40">Cream edition</span>
                    </div>
                    <div className="mt-6 space-y-5">
                      {basicItems.map((it) => (
                        <div key={it.id} className="flex justify-between gap-4 pb-5 border-b border-[#EDE3DA] last:border-0">
                          <div>
                            <div className="sans text-[12px] font-medium tracking-[0.02em]">{it.name}</div>
                            <div className="sans text-[11px] text-[#1A1A1A]/50 mt-1 leading-[1.5]">{it.note || ""}</div>
                          </div>
                          <div className="serif text-[18px] shrink-0">{it.price}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-[14px] bg-[#F6F1EB] border border-[#EDE3DA] p-4 sans text-[11px] leading-[1.7] text-[#1A1A1A]/60">
                      {basicNote}
                    </div>
                    <a href={waLink} target="_blank" rel="noopener" className="mt-5 w-full h-11 rounded-full bg-white border border-[#EDE3DA] sans text-[11px] tracking-[0.14em] uppercase inline-flex items-center justify-center hover:bg-[#F6F1EB] transition">
                      Book Basic · WA
                    </a>
                  </motion.div>
                ) : (
                  <motion.div
                    key="premium-m"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="relative bg-[#1A1A1A] text-[#FFFCFA] rounded-[24px] p-6 overflow-hidden shadow-sm border border-[#1A1A1A]"
                  >
                    <div className="absolute -top-20 -right-20 w-[260px] h-[260px] bg-[#C9A96E]/15 blur-[50px] rounded-full" />
                    <div className="absolute top-5 right-5 sans text-[9px] tracking-[0.2em] uppercase bg-[#C9A96E] text-[#1A1A1A] px-3 py-1 rounded-full">
                      Most Booked
                    </div>
                    <div className="flex items-baseline gap-3">
                      <h3 className="serif text-[20px] tracking-[0.12em]">PREMIUM</h3>
                      <span className="sans text-[10px] tracking-[0.16em] uppercase text-white/40">Black and gold</span>
                    </div>
                    <div className="mt-6 space-y-5">
                      {premiumItems.map((it) => (
                        <div key={it.id} className="flex justify-between gap-4 pb-5 border-b border-white/10 last:border-0">
                          <div>
                            <div className="sans text-[12px] font-medium">{it.name}</div>
                            <div className="sans text-[11px] text-white/50 mt-1">{it.note || ""}</div>
                          </div>
                          <div className="serif text-[18px] text-[#C9A96E] shrink-0">{it.price}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-[14px] bg-white/5 border border-white/10 p-4 sans text-[11px] leading-[1.7] text-white/60">
                      {premiumNote}
                    </div>
                    <a href={waLink} target="_blank" rel="noopener" className="mt-6 w-full sans text-[11px] tracking-[0.16em] uppercase bg-[#C9A96E] text-[#1A1A1A] h-11 rounded-full inline-flex items-center justify-center hover:bg-[#ddbf8b] transition font-medium">
                      Book Premium · WA
                    </a>
                  </motion.div>
                )
              ) : hasBasic ? (
                <motion.div key="basic-only-m" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="bg-[#FFFCFA] rounded-[24px] border border-[#EDE3DA] p-6 shadow-sm">
                  <div className="flex items-baseline justify-between"><h3 className="serif text-[20px] tracking-[0.12em]">BASIC</h3><span className="sans text-[10px] tracking-[0.16em] uppercase text-[#1A1A1A]/40">Cream edition</span></div>
                  <div className="mt-6 space-y-5">{basicItems.map((it) => (<div key={it.id} className="flex justify-between gap-4 pb-5 border-b border-[#EDE3DA] last:border-0"><div><div className="sans text-[12px] font-medium tracking-[0.02em]">{it.name}</div><div className="sans text-[11px] text-[#1A1A1A]/50 mt-1 leading-[1.5]">{it.note || ""}</div></div><div className="serif text-[18px] shrink-0">{it.price}</div></div>))}</div>
                  <div className="mt-6 rounded-[14px] bg-[#F6F1EB] border border-[#EDE3DA] p-4 sans text-[11px] leading-[1.7] text-[#1A1A1A]/60">{basicNote}</div>
                  <a href={waLink} target="_blank" rel="noopener" className="mt-5 w-full h-11 rounded-full bg-white border border-[#EDE3DA] sans text-[11px] tracking-[0.14em] uppercase inline-flex items-center justify-center hover:bg-[#F6F1EB] transition">Book Basic · WA</a>
                </motion.div>
              ) : (
                <motion.div key="premium-only-m" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="relative bg-[#1A1A1A] text-[#FFFCFA] rounded-[24px] p-6 overflow-hidden shadow-sm border border-[#1A1A1A]">
                  <div className="absolute -top-20 -right-20 w-[260px] h-[260px] bg-[#C9A96E]/15 blur-[50px] rounded-full" /><div className="absolute top-5 right-5 sans text-[9px] tracking-[0.2em] uppercase bg-[#C9A96E] text-[#1A1A1A] px-3 py-1 rounded-full">Most Booked</div>
                  <div className="flex items-baseline gap-3"><h3 className="serif text-[20px] tracking-[0.12em]">PREMIUM</h3><span className="sans text-[10px] tracking-[0.16em] uppercase text-white/40">Black and gold</span></div>
                  <div className="mt-6 space-y-5">{premiumItems.map((it) => (<div key={it.id} className="flex justify-between gap-4 pb-5 border-b border-white/10 last:border-0"><div><div className="sans text-[12px] font-medium">{it.name}</div><div className="sans text-[11px] text-white/50 mt-1">{it.note || ""}</div></div><div className="serif text-[18px] text-[#C9A96E] shrink-0">{it.price}</div></div>))}</div>
                  <div className="mt-6 rounded-[14px] bg-white/5 border border-white/10 p-4 sans text-[11px] leading-[1.7] text-white/60">{premiumNote}</div>
                  <a href={waLink} target="_blank" rel="noopener" className="mt-6 w-full sans text-[11px] tracking-[0.16em] uppercase bg-[#C9A96E] text-[#1A1A1A] h-11 rounded-full inline-flex items-center justify-center hover:bg-[#ddbf8b] transition font-medium">Book Premium · WA</a>
                </motion.div>
              )}
            </div>
          )}

          {!hasBasic && !hasPremium ? (
            <div className="hidden lg:block sans text-[12px] text-[#1A1A1A]/40 bg-[#F6F1EB] rounded-[16px] border border-dashed border-[#EDE3DA] p-10 text-center">Daftar harga segera hadir.</div>
          ) : (
            <div className={`hidden lg:grid gap-[14px] ${hasBasic && hasPremium ? "lg:grid-cols-2" : "lg:grid-cols-1 max-w-[640px] mx-auto"}`}>
              {hasBasic && (
                <Reveal>
                  <motion.div
                    whileHover={reduce ? {} : { y: -4 }}
                    className="bg-[#FFFCFA] rounded-[24px] border border-[#EDE3DA] p-7 lg:p-9 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:border-[#C9A96E]/20 transition will-change-transform group"
                  >
                    <div className="flex items-baseline justify-between">
                      <h3 className="serif text-[22px] tracking-[0.12em]">BASIC</h3>
                      <span className="sans text-[10px] tracking-[0.16em] uppercase text-[#1A1A1A]/40">Cream edition</span>
                    </div>
                    <div className="mt-6 space-y-5">
                      {basicItems.map((it, idx) => (
                        <motion.div
                          key={it.id}
                          initial={reduce ? {} : { opacity: 0, y: 10 }}
                          whileInView={reduce ? {} : { opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: idx * 0.06, duration: 0.5, ease: EASE }}
                          className="flex justify-between gap-4 pb-5 border-b border-[#EDE3DA] last:border-0 hover:pl-1 transition-all duration-300"
                        >
                          <div>
                            <div className="sans text-[12px] font-medium tracking-[0.02em]">{it.name}</div>
                            <div className="sans text-[11px] text-[#1A1A1A]/50 mt-1 leading-[1.5]">{it.note || ""}</div>
                          </div>
                          <div className="serif text-[18px] shrink-0">{it.price}</div>
                        </motion.div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-[14px] bg-[#F6F1EB] border border-[#EDE3DA] p-4 sans text-[11px] leading-[1.7] text-[#1A1A1A]/60 group-hover:border-[#C9A96E]/20 transition">
                      {basicNote}
                    </div>
                    <MagneticCTA href={waLink} variant="ghost">
                      Book Basic · WA
                    </MagneticCTA>
                  </motion.div>
                </Reveal>
              )}

              {hasPremium && (
                <Reveal delay={hasBasic ? 0.08 : 0}>
                  <div className="relative rounded-[24px] p-[1.2px] overflow-hidden group">
                    {!reduce && (
                      <motion.div
                        className="absolute inset-0"
                        style={{
                          background: "conic-gradient(from 0deg at 50% 50%, #C9A96E 0%, #E8D5B8 14%, #C9A96E 28%, #1A1A1A 50%, #C9A96E 78%, #E8D5B8 90%, #C9A96E 100%)",
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                    {reduce && <div className="absolute inset-0 bg-[#C9A96E]/20" />}
                    <motion.div
                      whileHover={reduce ? {} : { y: -4, scale: 1.005 }}
                      className="relative bg-[#1A1A1A] text-[#FFFCFA] rounded-[23px] p-7 lg:p-9 overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.18)] will-change-transform"
                    >
                      <div className="absolute -top-20 -right-20 w-[260px] h-[260px] bg-[#C9A96E]/15 blur-[50px] rounded-full" />
                      <motion.div
                        className="absolute -bottom-20 -left-20 w-[220px] h-[220px] bg-[#C9A96E]/10 blur-[40px] rounded-full"
                        animate={reduce ? {} : { scale: [1, 1.12, 1], opacity: [0.6, 0.9, 0.6] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <div className="absolute top-6 right-6 sans text-[9px] tracking-[0.2em] uppercase bg-[#C9A96E] text-[#1A1A1A] px-3 py-1 rounded-full">
                        Most Booked
                      </div>
                      <div className="flex items-baseline gap-3">
                        <h3 className="serif text-[22px] tracking-[0.12em]">PREMIUM</h3>
                        <span className="sans text-[10px] tracking-[0.16em] uppercase text-white/40">Black and gold</span>
                      </div>
                      <div className="mt-6 space-y-5">
                        {premiumItems.map((it, idx) => (
                          <motion.div
                            key={it.id}
                            initial={reduce ? {} : { opacity: 0, y: 10 }}
                            whileInView={reduce ? {} : { opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.12 + idx * 0.06, duration: 0.5, ease: EASE }}
                            className="flex justify-between gap-4 pb-5 border-b border-white/10 last:border-0"
                          >
                            <div>
                              <div className="sans text-[12px] font-medium">{it.name}</div>
                              <div className="sans text-[11px] text-white/50 mt-1">{it.note || ""}</div>
                            </div>
                            <div className="serif text-[18px] text-[#C9A96E] shrink-0">{it.price}</div>
                          </motion.div>
                        ))}
                      </div>
                      <div className="mt-6 rounded-[14px] bg-white/5 border border-white/10 p-4 sans text-[11px] leading-[1.7] text-white/60">
                        {premiumNote}
                      </div>
                      <a
                        href={waLink}
                        target="_blank"
                        className="mt-6 w-full sans text-[11px] tracking-[0.16em] uppercase bg-[#C9A96E] text-[#1A1A1A] h-11 inline-flex items-center justify-center hover:bg-[#ddbf8b] hover:shadow-[0_8px_22px_rgba(201,169,110,0.35)] transition font-medium relative overflow-hidden group/btn"
                      >
                        <span className="relative z-10">Book Premium · WA</span>
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                      </a>
                    </motion.div>
                  </div>
                </Reveal>
              )}
            </div>
          )}
        </section>

        {/* BRIDE */}
        <section id="bride" className="relative z-10 bg-[#F6F1EB] border-y border-[#EDE3DA] py-10 lg:py-20">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
            <Reveal>
              <div className="text-center max-w-[640px] mx-auto">
                <div className="flex items-center justify-center gap-3">
                  <GoldLine spring />
                  <span className="sans text-[10px] tracking-[0.22em] uppercase text-[#C9A96E]">Bride Pricelist 2026</span>
                  <GoldLine spring />
                </div>
                <h2 className="serif text-[28px] lg:text-[44px] leading-[0.95] mt-4">Curated for your once in a lifetime</h2>
                <p className="serif2 italic text-[16px] lg:text-[18px] text-[#1A1A1A]/60 mt-3">Akad / Pemberkatan and Resepsi</p>
              </div>
            </Reveal>

            <div className="mt-8 lg:mt-10 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-[1px] lg:bg-[#EDE3DA] lg:border lg:border-[#EDE3DA] lg:rounded-[24px] lg:overflow-hidden">
              {[
                {
                  name: "SAPPHIRE",
                  price: "4.500K",
                  tag: "BEST VALUE · Akad + Resepsi + Retouch",
                  includes: [
                    "Akad + Resepsi + Retouch",
                    "2 pax Mom Make Up by Partner",
                    "Free Hijab Do Clean Mom",
                    "Free Trial",
                    "Free Softlens Normal and Natural Brown",
                    "Free Groom Make Up",
                    "Hairdo/Hijab Drapery Mom +300K/pax",
                  ],
                  accent: true,
                },
                {
                  name: "PEARL",
                  price: "3.000K",
                  tag: "Akad / Pemberkatan + Retouch",
                  includes: [
                    "Akad / Pemberkatan + Retouch",
                    "Free Trial",
                    "Free Softlens Normal and Brown",
                    "Free Groom Make Up",
                  ],
                  accent: false,
                },
                {
                  name: "HARMONIA",
                  price: "3.500K",
                  tag: "Pick One Event · With Moms",
                  includes: [
                    "Pick one: Akad / Resepsi / After Party",
                    "No Retouch",
                    "2 pax Mom Make Up by Partner",
                    "Free Hijab Do Clean Mom",
                    "Free Trial",
                    "Free Softlens",
                    "Free Groom",
                  ],
                  accent: false,
                },
                {
                  name: "AURORA",
                  price: "2.500K",
                  tag: "Pick One Event · Essential",
                  includes: [
                    "Pick one: Akad / Resepsi / After Party",
                    "No Retouch",
                    "Free Trial",
                    "Free Softlens",
                    "Free Groom Make Up",
                  ],
                  accent: false,
                },
              ].map((r, idx) => (
                <motion.div
                  key={r.name}
                  variants={revealVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ delay: idx * 0.07, duration: 0.7, ease: EASE }}
                  whileHover={
                    reduce
                      ? {}
                      : r.accent
                      ? { scale: 1.015, transition: { type: "spring", stiffness: 300, damping: 22 } }
                      : { y: -3, transition: { type: "spring", stiffness: 320, damping: 22 } }
                  }
                  className={`p-7 lg:p-10 relative will-change-transform hover:z-10 rounded-[24px] shadow-sm lg:rounded-none lg:shadow-none border border-[#EDE3DA] lg:border-0 ${r.accent ? "bg-[#1A1A1A] text-white lg:hover:shadow-[0_16px_40px_rgba(0,0,0,0.25)]" : "bg-[#FFFCFA] lg:hover:shadow-[0_8px_30px_rgba(201,169,110,0.12)]"} transition-shadow`}
                >
                  {r.accent && !reduce && (
                    <motion.div
                      className="absolute inset-0 opacity-[0.08]"
                      style={{
                        background: "linear-gradient(105deg, transparent 40%, rgba(201,169,110,0.6) 50%, transparent 60%)",
                      }}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 2.8, ease: "easeInOut" }}
                    />
                  )}
                  {r.accent && (
                    <div className="absolute top-6 right-6 sans text-[9px] tracking-[0.2em] uppercase bg-[#C9A96E] text-[#1A1A1A] px-3 py-1 rounded-full">
                      Most Loved
                    </div>
                  )}
                  <div className="flex items-baseline gap-4 mb-2">
                    <h3 className={`serif text-[20px] lg:text-[24px] tracking-[0.08em] ${r.accent ? "text-white" : ""}`}>
                      {r.name}
                    </h3>
                    <span className={`serif text-[20px] lg:text-[22px] ${r.accent ? "text-[#C9A96E]" : "text-[#1A1A1A]"}`}>
                      {r.price}
                    </span>
                  </div>
                  <div className={`sans text-[10px] tracking-[0.14em] uppercase mb-6 ${r.accent ? "text-white/50" : "text-[#1A1A1A]/50"}`}>
                    {r.tag}
                  </div>
                  <ul className="space-y-2.5">
                    {r.includes.map((l, j) => (
                      <motion.li
                        key={l}
                        initial={reduce ? {} : { opacity: 0, x: -6 }}
                        whileInView={reduce ? {} : { opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.05 + j * 0.03, duration: 0.4, ease: EASE }}
                        className="flex gap-3 sans text-[12px] leading-[1.5]"
                      >
                        <span className={`mt-[7px] w-[4px] h-[4px] rounded-full shrink-0 ${r.accent ? "bg-[#C9A96E]" : "bg-[#C9A96E]"}`} />
                        <span className={r.accent ? "text-white/70" : "text-[#1A1A1A]/70"}>{l}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 lg:mt-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-8">
              <Reveal>
                <motion.div whileHover={reduce ? {} : { y: -3 }} className="bg-[#FFFCFA] rounded-[20px] border border-[#EDE3DA] p-7 lg:p-8 hover:border-[#C9A96E]/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition will-change-transform">
                  <h4 className="serif text-[18px] mb-6 flex items-center gap-3">
                    <span className="w-6 h-px bg-[#C9A96E]" />
                    Additional Price List
                  </h4>
                  <div className="divide-y divide-[#EDE3DA] sans text-[12px]">
                    {[
                      ["Set melati", "350K to 1.000K (vendor and musim)"],
                      ["Retouch hair / hijab mom", "200K / look"],
                      ["Make up family by partner", "500K (free hijab clean)"],
                      ["Pagar ayu", "350K"],
                      ["Trial only", "650K"],
                      ["Trial + hair / hijab", "850K"],
                      ["Groom Make Up and Hair", "650K"],
                      ["Overtime bride / reguler", "150K / hour (bride) · 100K (reguler)"],
                    ].map(([a, b]) => (
                      <div key={a} className="flex justify-between py-3.5 gap-6 hover:bg-[#F6F1EB]/40 -mx-2 px-2 rounded transition">
                        <span className="text-[#1A1A1A]/60">{a}</span>
                        <span className="font-medium text-right">{b}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </Reveal>
              <div className="space-y-6">
                <Reveal delay={0.08}>
                  <motion.div whileHover={reduce ? {} : { y: -3 }} className="bg-[#FFFCFA] rounded-[20px] border border-[#EDE3DA] p-7 lg:p-8 hover:border-[#C9A96E]/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition will-change-transform">
                    <h4 className="serif text-[18px] mb-4">Hijab Styling</h4>
                    <div className="grid grid-cols-2 gap-6 sans text-[12px] leading-[1.7]">
                      <div>
                        <div className="font-medium mb-2 tracking-[0.08em] uppercase text-[11px]">By MUA</div>
                        <p className="text-[#1A1A1A]/60">
                          Clean look / Menutup dada, segi empat 115x115cm, paris/bella, durasi about 15 menit. Included clean
                          style.
                        </p>
                      </div>
                      <div>
                        <div className="font-medium mb-2 tracking-[0.08em] uppercase text-[11px]">By Stylist</div>
                        <p className="text-[#1A1A1A]/60">
                          Lebih detail, presisi, custom style pashmina / segi empat. Rekomendasi untuk bride and mom.
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-[#EDE3DA] sans text-[10px] tracking-[0.12em] uppercase text-[#1A1A1A]/40">
                      Stylist tidak sediakan ciput / scrunchie, client bawa sendiri
                    </div>
                  </motion.div>
                </Reveal>
                <Reveal delay={0.12}>
                  <motion.div whileHover={reduce ? {} : { scale: 1.01 }} className="rounded-[20px] bg-[#1A1A1A] text-white p-7 lg:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)] transition will-change-transform">
                    <div>
                      <div className="serif text-[18px]">Butuh pricelist lengkap PDF?</div>
                      <div className="sans text-[11px] text-white/50 mt-1">Katalog WA sudah include T and C lengkap</div>
                    </div>
                    <a
                      href={waLink}
                      target="_blank"
                      className="sans text-[10px] tracking-[0.16em] uppercase border border-white/20 px-5 h-10 inline-flex items-center hover:bg-white hover:text-black transition shrink-0"
                    >
                      Request via WA
                    </a>
                  </motion.div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* NOTES */}
        <section id="notes" className="relative z-10 mx-auto max-w-[1280px] px-6 lg:px-10 py-10 lg:py-20">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-12">
            <Reveal>
              <div className="sans text-[10px] tracking-[0.22em] uppercase text-[#C9A96E] mb-4">Notes and Terms</div>
              <h2 className="serif text-[28px] lg:text-[44px] leading-[0.95]">
                Mohon dibaca
                <br />
                <span className="serif2 italic font-light">sebelum booking.</span>
              </h2>
              <div className="mt-6 w-12 h-px bg-[#C9A96E]" />
            </Reveal>
            <StaggerReveal className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
              {[
                { t: "DP and Pelunasan", d: "DP min 1.000K untuk bride package. Pelunasan H-7 sebelum hari H. Booking dianggap sudah baca Terms and Condition di katalog WA.", icon: "◆" },
                { t: "Durasi", d: "Bride 2.5 to 3 jam, Reguler 1.5 to 2 jam. Mohon datang dengan kondisi wajah bersih, sudah skincare ringan.", icon: "◐" },
                { t: "Transport", d: "Bandung and Cimahi 50K to 150K (max 20KM). Wedding 200K to 500K. Luar Bandung (Jakarta, Bekasi, Tasik, dll) +1.000K + transport / makan / akomodasi.", icon: "◎" },
                { t: "Hijab and Hair", d: "Hairdo/hijabdo by partner stylist. Hijab by MUA hanya segi empat clean look. Client wajib bawa ciput, inner, scrunchie sendiri.", icon: "✦" },
              ].map((r) => (
                <motion.div
                  key={r.t}
                  variants={revealVariants}
                  whileHover={reduce ? {} : { y: -3, scale: 1.01 }}
                  className="bg-white lg:bg-[#F6F1EB]/70 rounded-[16px] p-6 border border-[#EDE3DA] lg:border-[#EDE3DA]/60 h-full shadow-sm lg:shadow-none hover:bg-white hover:border-[#C9A96E]/20 hover:shadow-[0_8px_22px_rgba(0,0,0,0.06)] transition will-change-transform"
                >
                  <div className="w-8 h-8 rounded-full bg-[#C9A96E]/10 border border-[#C9A96E]/20 flex items-center justify-center sans text-[11px] text-[#C9A96E] mb-3">{r.icon}</div>
                  <div className="sans text-[11px] tracking-[0.14em] uppercase font-medium mb-2">{r.t}</div>
                  <div className="sans text-[12.5px] leading-[1.8] text-[#1A1A1A]/65">{r.d}</div>
                </motion.div>
              ))}
            </StaggerReveal>
          </div>
        </section>

        {/* VIDEO */}
        <section className="relative z-10 mx-auto max-w-[1280px] px-6 lg:px-10 pb-10 lg:pb-16">
          <Reveal>
            <motion.div
              whileHover={reduce ? {} : { scale: 1.005 }}
              className="relative rounded-[24px] lg:rounded-[28px] overflow-hidden bg-[#1A1A1A] aspect-[16/9] lg:aspect-[16/6] flex items-center justify-center border border-[#1A1A1A] shadow-[0_16px_50px_rgba(0,0,0,0.15)] group will-change-transform"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A1A] via-[#1A1A1A] to-[#C9A96E]/20" />
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 30% 40%, #C9A96E 0%, transparent 40%), radial-gradient(circle at 80% 70%, #EDE3DA 0%, transparent 35%)",
                }}
              />
              {!reduce && (
                <motion.div
                  className="absolute inset-0 opacity-10"
                  style={{
                    background: "linear-gradient(100deg, transparent 30%, rgba(201,169,110,0.3) 50%, transparent 70%)",
                  }}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                />
              )}
              <div className="relative z-10 text-center px-6">
                <motion.a
                  href={IG_LINK}
                  target="_blank"
                  whileHover={reduce ? {} : { scale: 1.06 }}
                  whileTap={reduce ? {} : { scale: 0.96 }}
                  className="mx-auto w-[64px] h-[64px] lg:w-[72px] lg:h-[72px] rounded-full border border-white/20 flex items-center justify-center backdrop-blur bg-white/10 hover:bg-white/15 transition cursor-pointer flex-col shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
                >
                  <div className="w-0 h-0 border-l-[14px] border-l-white border-y-[9px] border-y-transparent ml-1" />
                </motion.a>
                <div className="mt-6 serif text-white text-[20px] lg:text-[28px]">Video Pekerjaan</div>
                <div className="sans text-[11px] tracking-[0.16em] uppercase text-white/50 mt-2">Reels · TikTok · Behind The Brush</div>
                <div className="mt-3 sans text-[11px] text-white/30">@hirenamakeup · link di bio IG</div>
              </div>
              <div className="absolute bottom-5 left-6 lg:left-10 sans text-[10px] tracking-[0.18em] uppercase text-white/30">
                Play · Signature Soft Glam Motion
              </div>
            </motion.div>
          </Reveal>
        </section>

        {/* TESTIMONI */}
        <section className="relative z-10 bg-[#FFFCFA] border-t border-[#EDE3DA] py-10 lg:py-20">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
            <Reveal>
              <div className="flex items-center gap-3 mb-6 lg:mb-10">
                <GoldLine spring />
                <span className="sans text-[10px] tracking-[0.22em] uppercase text-[#C9A96E]">Testimoni Client</span>
              </div>
            </Reveal>

            <div className="hidden lg:grid lg:grid-cols-3 gap-[1px] bg-[#EDE3DA] border border-[#EDE3DA] rounded-[20px] overflow-hidden">
              {[
                {
                  name: "Dinda · Bride SAPPHIRE",
                  text: "Makeupnya bener bener soft glam, masih kayak aku tapi manglingi. Mama mama juga puas, hijabnya clean banget. Worth it!",
                },
                {
                  name: "Salsa · Wisuda Premium",
                  text: "Request look Thai soft, hasilnya dapet banget. Tahan 10 jam, foto tetep flawless. Touch up kitnya kepake banget.",
                },
                {
                  name: "Mom Rina · Mature Makeup",
                  text: "Umur 52 tapi makeupnya gak berat, lift effect. Hirena sabar banget, detail. Bakal langganan keluarga.",
                },
              ].map((r, i) => (
                <motion.div
                  key={r.name}
                  variants={revealVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.7, ease: EASE }}
                  whileHover={reduce ? {} : { y: -4 }}
                  className="bg-[#F6F1EB]/50 p-8 h-full flex flex-col hover:bg-white transition will-change-transform"
                >
                  <div className="serif2 italic text-[18px] leading-[1.5] text-[#1A1A1A]/80">"{r.text}"</div>
                  <div className="mt-auto pt-6 flex items-center justify-between">
                    <div className="sans text-[11px] tracking-[0.08em] uppercase text-[#1A1A1A]/60">{r.name}</div>
                    <div className="text-[11px] text-[#C9A96E] tracking-[0.12em]">★★★★★</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="lg:hidden space-y-4">
              {[
                { name: "Dinda · Bride SAPPHIRE", text: "Makeupnya bener bener soft glam, masih kayak aku tapi manglingi. Mama mama juga puas, hijabnya clean banget. Worth it!" },
                { name: "Salsa · Wisuda Premium", text: "Request look Thai soft, hasilnya dapet banget. Tahan 10 jam, foto tetep flawless. Touch up kitnya kepake banget." },
                { name: "Mom Rina · Mature", text: "Umur 52 tapi makeupnya gak berat, lift effect. Hirena sabar banget, detail. Bakal langganan keluarga." },
              ].map((r) => (
                <div key={r.name} className="bg-white rounded-[20px] border border-[#EDE3DA] p-6 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-[#C9A96E]/10 border border-[#C9A96E]/20 flex items-center justify-center text-[#C9A96E] text-[12px] mb-3">“</div>
                  <div className="serif2 italic text-[16px] leading-[1.55] text-[#1A1A1A]/85">"{r.text}"</div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="sans text-[11px] tracking-[0.06em] uppercase text-[#1A1A1A]/60">{r.name}</div>
                    <div className="text-[#C9A96E] text-[11px]">★★★★★</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOOKING CALENDAR */}
        <section id="booking-calendar" className="relative z-10 bg-[#F6F1EB] border-t border-[#EDE3DA] py-10 lg:py-20">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
            <Reveal>
              <div className="flex items-center gap-3 mb-4">
                <GoldLine spring />
                <span className="sans text-[10px] tracking-[0.22em] uppercase text-[#C9A96E]">Cek Ketersediaan</span>
              </div>
              <h2 className="serif text-[28px] lg:text-[42px] leading-[0.95]">
                Lihat slot kosong
                <br />
                <span className="serif2 italic font-light">dan terisi.</span>
              </h2>
              <p className="sans text-[13px] leading-[1.7] text-[#1A1A1A]/50 max-w-[560px] mt-4">
                Kalender update langsung. Putih Tersedia, gold Terisi, hitam Blocked, merah Batal, hijau Selesai. Klik
                tanggal untuk detail. Tanggal terisi tidak bisa WA.
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="mt-6 lg:mt-10 max-w-[860px]">
                <BookingCalendar mode="customer" />
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="mt-6 flex flex-wrap gap-3">
                <MagneticCTA href={waLink} variant="dark">
                  Tanya Slot via WA
                </MagneticCTA>
                <span className="sans text-[11px] tracking-[0.12em] uppercase border border-[#EDE3DA] bg-white px-5 h-11 inline-flex items-center text-[#1A1A1A]/60">
                  Update realtime · Tanpa refresh
                </span>
              </div>
            </Reveal>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="relative z-10 bg-[#1A1A1A] text-[#FFFCFA] py-12 lg:py-28 overflow-hidden">
          {!reduce && (
            <motion.div
              className="absolute -top-24 -right-24 w-[520px] h-[520px] bg-[#C9A96E]/08 blur-[80px] rounded-full pointer-events-none"
              animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 relative">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-12 items-end">
              <Reveal>
                <div className="flex items-center gap-3 mb-6">
                  <GoldLine />
                  <span className="sans text-[10px] tracking-[0.22em] uppercase text-[#C9A96E]">September 2026</span>
                </div>
                <h2 className="serif text-[36px] lg:text-[64px] leading-[0.9] tracking-[-0.02em]">
                  Sisa slot
                  <br />
                  September
                  <br />
                  <span className="serif2 italic font-light text-white/70">terbatas.</span>
                </h2>
                <div className="lg:hidden mt-6 h-px w-12 bg-[#C9A96E]" />
              </Reveal>
              <Reveal delay={0.1}>
                <p className="sans text-[13px] leading-[1.8] font-light text-white/60 max-w-[360px]">
                  Bandung based, ready for Cimahi, Jakarta, Bekasi, Tasik dengan akomodasi. Booking sekarang, amankan
                  tanggalmu sebelum penuh.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <MagneticCTA href={waLink} variant="light">
                    Book via WhatsApp <span className="text-[#C9A96E]">→</span>
                  </MagneticCTA>
                  <motion.a
                    href={IG_LINK}
                    target="_blank"
                    rel="noopener"
                    whileHover={reduce ? {} : { y: -2, scale: 1.02 }}
                    whileTap={reduce ? {} : { scale: 0.98 }}
                    className="sans text-[11px] tracking-[0.18em] uppercase border border-white/20 px-8 h-[52px] inline-flex items-center justify-center hover:bg-white/10 transition"
                  >
                    IG @hirenamakeup
                  </motion.a>
                </div>
                <div className="mt-8 pt-6 border-t border-white/10 sans text-[10px] tracking-[0.14em] uppercase text-white/30 flex flex-wrap gap-4 lg:gap-6">
                  <span>WA 0851 7976 3693</span>
                  <span className="hidden sm:inline">·</span>
                  <span>Bandung · Certified Since 2022</span>
                  <span className="hidden sm:inline">·</span>
                  <span>Soft Glam Specialist</span>
                </div>
              </Reveal>
            </div>

            <div className="mt-12 lg:mt-20 pt-8 border-t border-white/10 flex flex-col lg:flex-row flex-wrap justify-between gap-3 sans text-[10px] tracking-[0.1em] uppercase text-white/30">
              <span>© 2026 Hirena Makeup · Bandung Soft Glam Specialist · Price List 2026</span>
              <span className="text-white/20">Crafted with detail · low visual, soft glam, timeless</span>
            </div>
          </div>
        </section>

        <style>{` .scrollbar-none::-webkit-scrollbar{display:none}`}</style>
      </main>
    </MotionConfig>
  );
}
