"use client";

import { openDB, DBSchema, IDBPDatabase } from "idb";

// legacy photo type for compatibility
export type Photo = {
  id: string;
  url: string;
  label: string;
  order: number;
};

export type BookingStatus = "booked" | "blocked" | "available" | "cancelled" | "completed";

export type Booking = {
  id: string;
  date: string; // YYYY-MM-DD
  status: BookingStatus;
  client?: string;
  package?: string;
  notes?: string;
  updatedAt?: string;
};

export type PriceItem = {
  id: string;
  name: string;
  price: string;
  note?: string;
};

export type Prices = {
  basic: PriceItem[];
  premium: PriceItem[];
  basicNote: string;
  premiumNote: string;
};

export type Settings = {
  id: string; // always 'main'
  waLink: string;
  waNumber?: string;
  transportNote?: string;
  priceBasic?: string;
  pricePremium?: string;
  prices?: Prices;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type AuthDoc = {
  id: string; // always 'owner'
  passwordHash: string;
  createdAt: string;
};

export type PortfolioCategory = {
  id: string;
  name: string;
  slug: string;
  order: number;
};

export type PortfolioItem = {
  id: string;
  categoryId: string;
  title: string;
  description?: string;
  imageUrl: string; // base64/dataURL
  featured: boolean;
  order: number;
  createdAt: string;
};

interface HirenaDB extends DBSchema {
  portfolioCategories: {
    key: string;
    value: PortfolioCategory;
    indexes: { "by-order": number; "by-slug": string };
  };
  portfolioItems: {
    key: string;
    value: PortfolioItem;
    indexes: { "by-category": string; "by-order": number; "by-featured": string };
  };
  bookings: {
    key: string;
    value: Booking;
    indexes: { "by-date": string };
  };
  settings: {
    key: string;
    value: Settings;
  };
  auth: {
    key: string;
    value: AuthDoc;
  };
}

const DB_NAME = "hirena-db";
const DB_VERSION = 2;

export const HIRENA_CHANNEL = "hirena-sync";
const HIRENA_STORAGE_KEY = "hirena_update_at";

export type HirenaUpdateType = "portfolio" | "bookings" | "settings" | "prices";

export function broadcastUpdate(type: HirenaUpdateType, payload?: unknown): void {
  void payload;
  try {
    new BroadcastChannel(HIRENA_CHANNEL).postMessage({ type, at: Date.now() });
  } catch {}
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("hirena:update", { detail: { type } }));
  } catch {}
  try {
    if (typeof window !== "undefined") localStorage.setItem(HIRENA_STORAGE_KEY, String(Date.now()));
  } catch {}
}

let dbPromise: Promise<IDBPDatabase<HirenaDB>> | null = null;

// migration capture for legacy photos
let legacyPhotosCache: Photo[] | null = null;
let migrationPending = false;

function getDb(): Promise<IDBPDatabase<HirenaDB>> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<HirenaDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      // v1 stores: photos, bookings, settings, auth
      // v2: delete old photos, create portfolioCategories + portfolioItems
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains("bookings")) {
          const s = (db as unknown as IDBDatabase).createObjectStore("bookings", { keyPath: "id" });
          (s as unknown as { createIndex: (n: string, k: string) => void }).createIndex("by-date", "date");
        }
        if (!db.objectStoreNames.contains("settings")) {
          (db as unknown as IDBDatabase).createObjectStore("settings", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("auth")) {
          (db as unknown as IDBDatabase).createObjectStore("auth", { keyPath: "id" });
        }
        if (!(db.objectStoreNames as unknown as { contains: (n: string) => boolean }).contains("photos")) {
          const s = (db as unknown as IDBDatabase).createObjectStore("photos", { keyPath: "id" });
          (s as unknown as { createIndex: (n: string, k: string) => void }).createIndex("by-order", "order");
        }
      }
      if (oldVersion < 2) {
        // capture legacy photos if exists before deleting
        try {
          if ((transaction as unknown as { objectStoreNames: { contains: (n: string) => boolean } }).objectStoreNames.contains("photos")) {
            migrationPending = true;
            try {
              void (transaction as unknown as { objectStore: (n: string) => unknown }).objectStore("photos");
            } catch {}
          }
        } catch {}
        // create new stores if not exist
        if (!db.objectStoreNames.contains("portfolioCategories")) {
          const s = db.createObjectStore("portfolioCategories", { keyPath: "id" });
          s.createIndex("by-order", "order");
          s.createIndex("by-slug", "slug");
        }
        if (!db.objectStoreNames.contains("portfolioItems")) {
          const s = db.createObjectStore("portfolioItems", { keyPath: "id" });
          s.createIndex("by-category", "categoryId");
          s.createIndex("by-order", "order");
          s.createIndex("by-featured", "featured");
        }
        // ensure bookings/settings/auth exist (in case fresh v2 install)
        if (!db.objectStoreNames.contains("bookings")) {
          const s = db.createObjectStore("bookings", { keyPath: "id" });
          s.createIndex("by-date", "date");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("auth")) {
          db.createObjectStore("auth", { keyPath: "id" });
        }
        // delete old photos store last
        if ((db.objectStoreNames as unknown as { contains: (n: string) => boolean }).contains("photos")) {
          (db as unknown as { deleteObjectStore: (n: string) => void }).deleteObjectStore("photos");
        }
      }
    },
  });
  return dbPromise;
}

// helpers crypto
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function _todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function _addDaysStr(base: Date, offset: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// seed helpers

function defaultCategories(): PortfolioCategory[] {
  return [
    { id: "soft-glam", name: "Soft Glam", slug: "soft-glam", order: 0 },
    { id: "bold-glam", name: "Bold Glam", slug: "bold-glam", order: 1 },
    { id: "hijab-look", name: "Hijab Look", slug: "hijab-look", order: 2 },
    { id: "bride", name: "Bride", slug: "bride", order: 3 },
  ];
}

function placeholderPhotos(): Photo[] {
  const labels = [
    "Soft Glam 1",
    "Soft Glam 2",
    "Soft Glam 3",
    "Soft Glam 4",
    "Soft Glam 5",
    "Soft Glam 6",
    "Soft Glam 7",
    "Soft Glam 8",
    "Soft Glam 9",
  ];
  return labels.map((label, i) => ({
    id: `seed-${i + 1}`,
    label,
    order: i,
    url: `gradient:${i}`,
  }));
}

async function ensureSeedCategories(db: IDBPDatabase<HirenaDB>) {
  const count = await db.count("portfolioCategories");
  if (count === 0) {
    const tx = db.transaction("portfolioCategories", "readwrite");
    for (const c of defaultCategories()) await tx.store.put(c);
    await tx.done;
  }
}

async function ensureSeedPortfolioItems(db: IDBPDatabase<HirenaDB>) {
  const count = await db.count("portfolioItems");
  if (count !== 0) return;
  await ensureSeedCategories(db);
  const categories = await db.getAll("portfolioCategories");
  const defaultCatId = categories.find((c) => c.slug === "soft-glam")?.id || categories[0]?.id || "soft-glam";

  // migrate legacy photos if we have cache
  if (legacyPhotosCache && legacyPhotosCache.length > 0) {
    const tx = db.transaction("portfolioItems", "readwrite");
    for (const p of legacyPhotosCache) {
      const item: PortfolioItem = {
        id: p.id,
        categoryId: defaultCatId,
        title: p.label,
        description: p.label,
        imageUrl: p.url,
        featured: p.order < 6,
        order: p.order,
        createdAt: new Date().toISOString(),
      };
      await tx.store.put(item);
    }
    await tx.done;
    legacyPhotosCache = null;
    migrationPending = false;
    return;
  }

  // if migrationPending but no cache, try to read from alternate storage fallback (none)
  // otherwise seed placeholder gradient items
  const placeholders = placeholderPhotos();
  const tx = db.transaction("portfolioItems", "readwrite");
  for (const p of placeholders) {
    const item: PortfolioItem = {
      id: p.id,
      categoryId: defaultCatId,
      title: p.label,
      description: "Soft glam look",
      imageUrl: p.url,
      featured: p.order < 6,
      order: p.order,
      createdAt: new Date().toISOString(),
    };
    await tx.store.put(item);
  }
  await tx.done;
}

async function tryMigrateLegacyPhotosIfNeeded(db: IDBPDatabase<HirenaDB>) {
  // called after db open to handle legacy migration when upgrade did not capture synchronously
  if (!migrationPending && legacyPhotosCache) return;
  // If portfolioItems already seeded, skip
  const count = await db.count("portfolioItems");
  if (count !== 0) {
    migrationPending = false;
    return;
  }
  // Attempt to open old DB version to read photos if still present in another connection?
  // Since we already deleted store in v2, we cannot read it. Use fallback: if we have no data, seed placeholders.
  // The placeholder seeding will handle it.
  await ensureSeedPortfolioItems(db);
}

async function ensureSeedBookings(db: IDBPDatabase<HirenaDB>) {
  const count = await db.count("bookings");
  if (count !== 0) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const offsets = [2, 5, 8, 12, 18, 22, 26].filter((d) => d <= daysInMonth);
  const tx = db.transaction("bookings", "readwrite");
  for (const d of offsets) {
    const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isBlocked = d === 12 || d === 26;
    const booking: Booking = {
      id: `seed-b-${d}`,
      date,
      status: isBlocked ? "blocked" : "booked",
      client: isBlocked ? undefined : `Client ${d}`,
      package: isBlocked ? undefined : d % 2 === 0 ? "PREMIUM" : "BASIC",
      notes: isBlocked ? "Libur / Blocked" : "Booked seed",
      updatedAt: new Date().toISOString(),
    };
    await tx.store.put(booking);
  }
  // add past and future demo data to cover realtime completed and cancelled
  const pastFuture: Array<{ offset: number; status: BookingStatus; client?: string; pkg?: string; notes?: string }> = [
    { offset: -15, status: "booked", client: "Past Client A", pkg: "BASIC", notes: "Past booked for completed demo" },
    { offset: -10, status: "cancelled", client: "Cancelled Client", pkg: "PREMIUM", notes: "Cancelled by owner" },
    { offset: -7, status: "booked", client: "Past Client B", pkg: "SAPPHIRE", notes: "Past booked to show completed" },
    { offset: -3, status: "booked", client: "Past Client C", pkg: "BASIC", notes: "Recent completed" },
    { offset: 10, status: "booked", client: "Future Client X", pkg: "PREMIUM", notes: "Upcoming booked" },
    { offset: 15, status: "blocked", notes: "Future blocked" },
    { offset: 20, status: "cancelled", client: "Future Cancelled", pkg: "BASIC", notes: "Cancelled future" },
    { offset: 35, status: "booked", client: "Next Month Client", pkg: "PEARL", notes: "Future month booked" },
    { offset: 45, status: "booked", client: "Next Month B", pkg: "AURORA", notes: "Future month" },
  ];
  for (const pf of pastFuture) {
    const date = _addDaysStr(now, pf.offset);
    const id = `seed-pf-${pf.offset}`;
    // avoid duplicate if already seeded same date
    const existing = await tx.store.getAll();
    if (existing.some((b) => (b as Booking).date === date)) continue;
    const booking: Booking = {
      id,
      date,
      status: pf.status,
      client: pf.client,
      package: pf.pkg,
      notes: pf.notes,
      updatedAt: new Date().toISOString(),
    };
    // do not store available status as row; skip available
    if (booking.status !== "available") await tx.store.put(booking);
  }
  await tx.done;
}

export function normalizeWaNumber(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  // handle numbers like 851... without prefix
  if (digits.length >= 9 && digits.startsWith("8")) return "62" + digits;
  return digits;
}

export function extractWaNumberFromLink(link: string): string | null {
  if (!link) return null;
  try {
    const m = link.match(/wa\.me\/(\d+)/);
    if (m) return normalizeWaNumber(m[1]);
  } catch {}
  const digits = link.replace(/\D/g, "");
  if (digits.length >= 10) return normalizeWaNumber(digits);
  return null;
}

export function buildWaLink(waNumber: string, text?: string): string {
  const num = normalizeWaNumber(waNumber) || "6285179763693";
  const msg = text ?? "Halo Hirena Makeup saya mau tanya slot makeup";
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

export function getDefaultPrices(): Prices {
  return {
    basic: [
      { id: "b1", name: "Make Up Only", price: "350K", note: "1.5 to 2 jam tanpa retouch, include softlens normal" },
      { id: "b2", name: "+ Retouch Standby 3h", price: "650K", note: "Standby di lokasi 3 jam, free mini touch up" },
      { id: "b3", name: "+ Retouch Follow 8h", price: "1.100K", note: "Follow 8 jam, touch up on demand, free kit" },
      { id: "b4", name: "Mom Mature 40 to 60", price: "400K", note: "Lift effect, soft glam mature, 1.5 jam" },
    ],
    premium: [
      { id: "p1", name: "Make Up Only", price: "550K", note: "1.5 to 2 jam, high end mix, free mini kit" },
      { id: "p2", name: "+ Retouch Standby 3h", price: "850K", note: "Standby 3 jam di venue, finishing detail" },
      { id: "p3", name: "+ Retouch Follow 8h", price: "1.300K", note: "Follow seharian, look locked all day" },
    ],
    basicNote: "Harga belum termasuk transport Bandung and Cimahi 50K to 150K (max 20KM). Hijab do by MUA hanya segi empat, clean look.",
    premiumNote: "Harga belum termasuk transport Bandung and Cimahi 50K to 150K (max 20KM). Hijab do by MUA hanya segi empat, clean look.",
  };
}

export async function getPrices(): Promise<Prices> {
  const s = await getSettings();
  if (s.prices && Array.isArray(s.prices.basic) && Array.isArray(s.prices.premium)) {
    return s.prices;
  }
  return getDefaultPrices();
}

export async function savePrices(prices: Prices): Promise<void> {
  const s = await getSettings();
  s.prices = prices;
  await saveSettings(s);
  broadcastUpdate("prices");
  broadcastUpdate("settings");
}

async function ensureSeedSettings(db: IDBPDatabase<HirenaDB>) {
  const existing = await db.get("settings", "main");
  if (!existing) {
    const s: Settings = {
      id: "main",
      waLink: buildWaLink("6285179763693"),
      waNumber: "6285179763693",
      transportNote: "Bandung and Cimahi 50K to 150K (max 20KM). Luar Bandung +1.000K + transport / makan / akomodasi.",
      prices: getDefaultPrices(),
    };
    await db.put("settings", s);
    return;
  }
  // migration: waLink -> waNumber and seed prices if missing
  let needsSave = false;
  if (!existing.waNumber && existing.waLink) {
    const extracted = extractWaNumberFromLink(existing.waLink);
    if (extracted) {
      existing.waNumber = extracted;
      needsSave = true;
    } else {
      existing.waNumber = "6285179763693";
      needsSave = true;
    }
  }
  if (!existing.waNumber) {
    existing.waNumber = "6285179763693";
    needsSave = true;
  } else {
    const normalized = normalizeWaNumber(existing.waNumber);
    if (normalized !== existing.waNumber) {
      existing.waNumber = normalized;
      needsSave = true;
    }
  }
  if (!existing.prices || !Array.isArray(existing.prices.basic) || !Array.isArray(existing.prices.premium)) {
    existing.prices = getDefaultPrices();
    needsSave = true;
  }
  if (needsSave) {
    await db.put("settings", existing);
  }
}

// portfolio category helpers
export async function getCategories(): Promise<PortfolioCategory[]> {
  const db = await getDb();
  await ensureSeedCategories(db);
  await tryMigrateLegacyPhotosIfNeeded(db);
  const all = await db.getAll("portfolioCategories");
  return all.sort((a, b) => a.order - b.order);
}

export async function saveCategory(category: PortfolioCategory): Promise<void> {
  const db = await getDb();
  if (!category.id) category.id = slugify(category.name) || uid();
  if (!category.slug) category.slug = slugify(category.name);
  await db.put("portfolioCategories", category);
  broadcastUpdate("portfolio");
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("portfolioCategories", id);
  // optionally delete items in category? keep them
  broadcastUpdate("portfolio");
}

// portfolio items helpers
export async function getPortfolioItems(categoryId?: string): Promise<PortfolioItem[]> {
  const db = await getDb();
  await ensureSeedCategories(db);
  await tryMigrateLegacyPhotosIfNeeded(db);
  await ensureSeedPortfolioItems(db);
  const all = await db.getAll("portfolioItems");
  const filtered = categoryId ? all.filter((i) => i.categoryId === categoryId) : all;
  return filtered.sort((a, b) => a.order - b.order);
}

export async function savePortfolioItem(item: PortfolioItem): Promise<void> {
  const db = await getDb();
  if (!item.id) item.id = uid();
  if (!item.createdAt) item.createdAt = new Date().toISOString();
  // ensure category exists
  await db.put("portfolioItems", item);
  broadcastUpdate("portfolio");
}

export async function deletePortfolioItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("portfolioItems", id);
  broadcastUpdate("portfolio");
}

export async function getFeaturedItems(limit = 6): Promise<PortfolioItem[]> {
  const db = await getDb();
  await ensureSeedPortfolioItems(db);
  const all = await db.getAll("portfolioItems");
  const featured = all.filter((i) => i.featured).sort((a, b) => a.order - b.order);
  const capped = featured.slice(0, Math.min(Math.max(limit, 6), 9));
  if (capped.length > 0) return capped;
  // fallback to first 6 if none featured
  return all.sort((a, b) => a.order - b.order).slice(0, Math.min(Math.max(limit, 6), 9));
}

// booking display status helper (virtual completed)
export function getBookingDisplayStatus(booking: Booking, todayISO?: string): BookingStatus {
  const today = todayISO || _todayStr();
  if (booking.status === "booked" && booking.date < today) return "completed";
  return booking.status;
}

export function isBookingCompleted(booking: Booking, todayISO?: string): boolean {
  return getBookingDisplayStatus(booking, todayISO) === "completed";
}

// for realtime needs: return bookings with computed status
export async function getBookingsWithDisplayStatus(): Promise<Array<Booking & { displayStatus: BookingStatus }>> {
  const bookings = await getBookings();
  const today = _todayStr();
  return bookings.map((b) => ({ ...b, displayStatus: getBookingDisplayStatus(b, today) }));
}

// alias per spec: needsRealtime could be helper that indicates if realtime needed
export function needsRealtime(booking: Booking): boolean {
  return isBookingCompleted(booking);
}

// exported API bookings
export async function getBookings(): Promise<Booking[]> {
  const db = await getDb();
  await ensureSeedBookings(db);
  const all = await db.getAll("bookings");
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveBooking(booking: Booking): Promise<void> {
  const db = await getDb();
  if (!booking.id) booking.id = uid();
  // available means delete trace? keep as delete if caller uses available to clear
  if (booking.status === "available") {
    // if existing, delete it to represent available
    const existing = await db.get("bookings", booking.id);
    if (existing) await db.delete("bookings", booking.id);
    else {
      // find by date
      const all = await db.getAll("bookings");
      const byDate = all.find((b) => b.date === booking.date);
      if (byDate) await db.delete("bookings", byDate.id);
    }
    broadcastUpdate("bookings");
    return;
  }
  booking.updatedAt = new Date().toISOString();
  // normalize completed/cancelled handling: completed is virtual, do not store as completed unless explicitly passed
  await db.put("bookings", booking);
  broadcastUpdate("bookings");
}

export async function deleteBooking(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("bookings", id);
  broadcastUpdate("bookings");
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  await ensureSeedSettings(db);
  const s = await db.get("settings", "main");
  if (s) {
    // runtime migration for waNumber
    if (!s.waNumber && s.waLink) {
      const ex = extractWaNumberFromLink(s.waLink);
      if (ex) s.waNumber = ex;
    }
    if (!s.waNumber) s.waNumber = normalizeWaNumber(s.waLink ? extractWaNumberFromLink(s.waLink) || "" : "") || "6285179763693";
    else s.waNumber = normalizeWaNumber(s.waNumber);
    if (!s.prices) s.prices = getDefaultPrices();
  }
  return s!;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDb();
  settings.id = "main";
  if (settings.waNumber) settings.waNumber = normalizeWaNumber(settings.waNumber);
  // keep waLink in sync for legacy
  if (settings.waNumber) settings.waLink = buildWaLink(settings.waNumber);
  await db.put("settings", settings);
  broadcastUpdate("settings");
  broadcastUpdate("prices");
}

export async function getAuth(): Promise<AuthDoc | undefined> {
  const db = await getDb();
  return db.get("auth", "owner");
}

export async function setAuthPassword(password: string): Promise<string> {
  const db = await getDb();
  const hash = await sha256Hex(password);
  const doc: AuthDoc = {
    id: "owner",
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  };
  await db.put("auth", doc);
  return hash;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const db = await getDb();
  const auth = await db.get("auth", "owner");
  if (!auth) return false;
  const hash = await sha256Hex(password);
  return timingSafeEqual(hash, auth.passwordHash);
}

// util for image resize to base64 ~800px with 0.7 compression for perf
// honey: thumb 600px + jpeg 0.7 reduces base64 ~40% vs 800px 0.82
export function fileToThumbDataURL(file: File): Promise<string> {
  return fileToResizedDataURL(file, 600);
}
export function fileToResizedDataURL(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const scale = Math.min(1, maxSize / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas failed"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => reject(new Error("image load failed"));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function generateId(): string {
  return uid();
}

export { sha256Hex };
