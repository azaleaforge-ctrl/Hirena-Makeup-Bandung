"use client";

import { useEffect, useState } from "react";
import BookingCalendar from "@/components/BookingCalendar";
import {
  getBookings,
  getBookingsWithDisplayStatus,
  getCategories,
  getPortfolioItems,
  getSettings,
  getAuth,
  setAuthPassword,
  verifyPassword,
  fileToResizedDataURL,
  generateId,
  saveCategory,
  deleteCategory,
  savePortfolioItem,
  deletePortfolioItem,
  saveBooking,
  deleteBooking,
  saveSettings,
  broadcastUpdate,
  getBookingDisplayStatus,
  type Booking,
  type BookingStatus,
  type Settings,
  type PortfolioCategory,
  type PortfolioItem,
} from "@/lib/db";

const PACKAGES = ["BASIC", "PREMIUM", "SAPPHIRE", "PEARL", "HARMONIA", "AURORA"];
const SESSION_KEY = "hirena_owner_session";
const SESSION_HOURS = 12;

function getSessionValid(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const obj = JSON.parse(raw);
    if (!obj.expiry || !obj.token) return false;
    if (Date.now() > obj.expiry) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
function setSession(token: string) {
  const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiry }));
}

type Tab = "portfolio" | "calendar" | "settings";

export default function OwnerPage() {
  const [authExists, setAuthExists] = useState<boolean | null>(null);
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loginError, setLoginError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("portfolio");

  // data
  const [categories, setCategories] = useState<PortfolioCategory[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [bookings, setBookings] = useState<Array<Booking & { displayStatus: BookingStatus }>>([]);
  const [settings, setSettingsState] = useState<Settings | null>(null);

  // booking form
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<BookingStatus>("booked");
  const [formClient, setFormClient] = useState("");
  const [formPackage, setFormPackage] = useState("BASIC");
  const [formNotes, setFormNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkStart, setBulkStart] = useState("");
  const [bulkEnd, setBulkEnd] = useState("");

  // settings form
  const [waLink, setWaLink] = useState("");
  const [transportNote, setTransportNote] = useState("");
  const [priceBasic, setPriceBasic] = useState("");
  const [pricePremium, setPricePremium] = useState("");

  // portfolio kategori form
  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  // portfolio item form
  const [filterCat, setFilterCat] = useState<string>("all");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemCat, setNewItemCat] = useState<string>("");
  const [newItemFeatured, setNewItemFeatured] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemTitle, setEditItemTitle] = useState("");
  const [editItemDesc, setEditItemDesc] = useState("");
  const [editItemCat, setEditItemCat] = useState("");
  const [editItemFeatured, setEditItemFeatured] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  async function refreshAll() {
    try {
      const [cats, its, bks, s] = await Promise.all([getCategories(), getPortfolioItems(), getBookingsWithDisplayStatus(), getSettings()]);
      setCategories(cats);
      setItems(its);
      setBookings(bks);
      setSettingsState(s);
      setWaLink(s.waLink || "");
      setTransportNote(s.transportNote || "");
      setPriceBasic(s.priceBasic || "");
      setPricePremium(s.pricePremium || "");
      if (cats.length > 0 && !newItemCat) setNewItemCat(cats[0].id);
    } catch {}
  }

  useEffect(() => {
    async function initAuth() {
      try {
        const auth = await getAuth();
        setAuthExists(!!auth);
        if (!auth) {
          setChecking(false);
          return;
        }
        if (getSessionValid()) setAuthed(true);
      } catch {}
      setChecking(false);
    }
    initAuth();
  }, []);

  useEffect(() => {
    if (authed) refreshAll();
  }, [authed]);

  // keep newItemCat synced when categories load
  useEffect(() => {
    if (categories.length && !newItemCat) setNewItemCat(categories[0].id);
  }, [categories, newItemCat]);

  async function handleCreatePassword() {
    setLoginError("");
    if (!password || password.length < 6) {
      setLoginError("Password minimal 6 karakter");
      return;
    }
    if (password !== confirm) {
      setLoginError("Konfirmasi tidak cocok");
      return;
    }
    try {
      const hash = await setAuthPassword(password);
      setSession(hash);
      setAuthed(true);
      setAuthExists(true);
      showToast("Password owner dibuat");
      setPassword("");
      setConfirm("");
    } catch {
      setLoginError("Gagal membuat password");
    }
  }
  async function handleLogin() {
    setLoginError("");
    if (!password) {
      setLoginError("Masukkan password");
      return;
    }
    try {
      const ok = await verifyPassword(password);
      if (!ok) {
        setLoginError("Password salah");
        return;
      }
      const auth = await getAuth();
      if (auth) setSession(auth.passwordHash);
      setAuthed(true);
      showToast("Login berhasil");
      setPassword("");
    } catch {
      setLoginError("Gagal login");
    }
  }
  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    setAuthed(false);
    setPassword("");
    showToast("Logout berhasil");
  }

  // ---------- kategori ----------
  async function handleCreateCategory() {
    const name = newCatName.trim();
    if (!name) {
      showToast("Nama kategori wajib");
      return;
    }
    const cat: PortfolioCategory = {
      id: generateId(),
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      order: categories.length,
    };
    await saveCategory(cat);
    broadcastUpdate("portfolio");
    setNewCatName("");
    const cats = await getCategories();
    setCategories(cats);
    showToast("Kategori ditambahkan dan terpublish");
  }
  async function handleUpdateCategory(id: string) {
    const name = editingCatName.trim();
    if (!name) return;
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    const next: PortfolioCategory = { ...cat, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || cat.slug };
    await saveCategory(next);
    broadcastUpdate("portfolio");
    setEditingCatId(null);
    const cats = await getCategories();
    setCategories(cats);
    showToast("Kategori diperbarui dan terpublish");
  }
  async function handleDeleteCategory(id: string) {
    await deleteCategory(id);
    broadcastUpdate("portfolio");
    const cats = await getCategories();
    setCategories(cats);
    // keep items, but refresh items list
    const its = await getPortfolioItems();
    setItems(its);
    showToast("Kategori dihapus dan terpublish");
  }
  async function handleReorderCategory(id: string, dir: number) {
    const idx = categories.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= categories.length) return;
    const copy = [...categories];
    const a = copy[idx];
    const b = copy[newIdx];
    const tmp = a.order;
    a.order = b.order;
    b.order = tmp;
    await saveCategory(a);
    await saveCategory(b);
    broadcastUpdate("portfolio");
    const cats = await getCategories();
    setCategories(cats);
    showToast("Urutan kategori diperbarui");
  }

  // ---------- portfolio items ----------
  async function handleUploadNewItem(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToResizedDataURL(file, 800);
        const item: PortfolioItem = {
          id: generateId(),
          categoryId: newItemCat || categories[0]?.id || "soft-glam",
          title: newItemTitle.trim() || file.name.replace(/\.[^/.]+$/, "").slice(0, 32) || "Portfolio",
          description: newItemDesc.trim() || undefined,
          imageUrl: dataUrl,
          featured: newItemFeatured,
          order: items.length,
          createdAt: new Date().toISOString(),
        };
        await savePortfolioItem(item);
        broadcastUpdate("portfolio");
      } catch {
        showToast("Gagal upload foto");
      }
    }
    const its = await getPortfolioItems();
    setItems(its);
    showToast("Foto ditambahkan dan terpublish");
    setNewItemTitle("");
    setNewItemDesc("");
    e.target.value = "";
  }

  async function handleCreateItemWithDataUrl(dataUrl: string, fileName: string) {
    const item: PortfolioItem = {
      id: generateId(),
      categoryId: newItemCat || categories[0]?.id || "soft-glam",
      title: newItemTitle.trim() || fileName.replace(/\.[^/.]+$/, "").slice(0, 32) || "Portfolio",
      description: newItemDesc.trim() || undefined,
      imageUrl: dataUrl,
      featured: newItemFeatured,
      order: items.length,
      createdAt: new Date().toISOString(),
    };
    await savePortfolioItem(item);
    broadcastUpdate("portfolio");
    const its = await getPortfolioItems();
    setItems(its);
    showToast("Foto ditambahkan dan terpublish");
  }

  async function handleSaveNewItemButton() {
    if (!newItemTitle.trim()) {
      showToast("Judul wajib");
      return;
    }
    // if no image uploaded, need file; we allow placeholder gradient
    const item: PortfolioItem = {
      id: generateId(),
      categoryId: newItemCat || categories[0]?.id || "soft-glam",
      title: newItemTitle.trim(),
      description: newItemDesc.trim() || undefined,
      imageUrl: `gradient:${Date.now()}`,
      featured: newItemFeatured,
      order: items.length,
      createdAt: new Date().toISOString(),
    };
    await savePortfolioItem(item);
    broadcastUpdate("portfolio");
    const its = await getPortfolioItems();
    setItems(its);
    setNewItemTitle("");
    setNewItemDesc("");
    showToast("Item ditambahkan dan terpublish");
  }

  async function handleDeleteItem(id: string) {
    await deletePortfolioItem(id);
    broadcastUpdate("portfolio");
    const its = await getPortfolioItems();
    // reindex order
    for (let i = 0; i < its.length; i++) if (its[i].order !== i) { its[i].order = i; await savePortfolioItem(its[i]); }
    const final = await getPortfolioItems();
    setItems(final);
    showToast("Foto dihapus dan terpublish");
  }

  async function handleUpdateItem(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next: PortfolioItem = {
      ...it,
      title: editItemTitle.trim() || it.title,
      description: editItemDesc.trim() || undefined,
      categoryId: editItemCat || it.categoryId,
      featured: editItemFeatured,
    };
    await savePortfolioItem(next);
    broadcastUpdate("portfolio");
    setEditingItemId(null);
    const its = await getPortfolioItems();
    setItems(its);
    showToast("Foto diperbarui dan terpublish");
  }

  async function handleReorderItem(id: string, dir: number) {
    const filtered = filterCat === "all" ? items : items.filter((i) => i.categoryId === filterCat);
    const idxInFiltered = filtered.findIndex((p) => p.id === id);
    if (idxInFiltered < 0) return;
    const target = filtered[idxInFiltered + dir];
    if (!target) return;
    const a = items.find((x) => x.id === id)!;
    const b = items.find((x) => x.id === target.id)!;
    const tmp = a.order;
    a.order = b.order;
    b.order = tmp;
    await savePortfolioItem(a);
    await savePortfolioItem(b);
    broadcastUpdate("portfolio");
    const its = await getPortfolioItems();
    setItems(its);
    showToast("Urutan diperbarui dan terpublish");
  }

  async function handleToggleFeatured(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = { ...it, featured: !it.featured };
    await savePortfolioItem(next);
    broadcastUpdate("portfolio");
    const its = await getPortfolioItems();
    setItems(its);
    showToast(next.featured ? "Ditandai featured" : "Featured dilepas");
  }

  async function handleReplaceImage(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataURL(file, 800);
      const it = items.find((x) => x.id === id);
      if (!it) return;
      await savePortfolioItem({ ...it, imageUrl: dataUrl });
      broadcastUpdate("portfolio");
      const its = await getPortfolioItems();
      setItems(its);
      showToast("Gambar diganti dan terpublish");
    } catch {
      showToast("Gagal ganti gambar");
    }
    e.target.value = "";
  }

  function handleSimpanPublishPortfolio() {
    broadcastUpdate("portfolio");
    showToast("Tersimpan dan terpublish");
  }

  // ---------- booking ----------
  function onCalendarSelect(dateStr: string, booking?: Booking) {
    setSelectedDate(dateStr);
    if (booking) {
      const disp = getBookingDisplayStatus(booking);
      setEditingId(booking.id);
      // completed is virtual, keep original status for edit
      setFormStatus(booking.status === "completed" ? "booked" : booking.status as BookingStatus);
      void disp;
      setFormClient(booking.client || "");
      setFormPackage(booking.package || "BASIC");
      setFormNotes(booking.notes || "");
    } else {
      setEditingId(null);
      setFormStatus("booked");
      setFormClient("");
      setFormPackage("BASIC");
      setFormNotes("");
    }
    setTimeout(() => {
      const el = document.getElementById("booking-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function handleSaveBooking() {
    if (!selectedDate) {
      showToast("Pilih tanggal dulu");
      return;
    }
    if (formStatus === "cancelled" || formStatus === "completed" || formStatus === "booked" || formStatus === "blocked") {
      // completed cannot be manually saved, map to booked
      const statusToSave: BookingStatus = formStatus === "completed" ? "booked" : formStatus;
      if (statusToSave === "cancelled" || statusToSave === "booked" || statusToSave === "blocked") {
        const id = editingId || generateId();
        // available means delete, but not in new flow; support via delete button
        const b: Booking = {
          id,
          date: selectedDate,
          status: statusToSave,
          client: statusToSave === "blocked" ? undefined : formClient || undefined,
          package: statusToSave === "blocked" ? undefined : formPackage,
          notes: formNotes || undefined,
        };
        await saveBooking(b);
        broadcastUpdate("bookings");
        const updated = await getBookingsWithDisplayStatus();
        setBookings(updated);
        showToast(statusToSave === "cancelled" ? "Booking dibatalkan" : "Booking disimpan dan terpublish");
        const found = updated.find((x) => x.date === selectedDate);
        if (found) setEditingId(found.id);
        else setEditingId(null);
        return;
      }
    }
    showToast("Status tidak valid");
  }

  async function handleDeleteBooking() {
    if (!editingId) return;
    await deleteBooking(editingId);
    broadcastUpdate("bookings");
    const updated = await getBookingsWithDisplayStatus();
    setBookings(updated);
    showToast("Booking dihapus");
    setEditingId(null);
    setFormClient("");
    setFormNotes("");
    setFormStatus("booked");
  }

  async function handleCancelBookingRow(id: string) {
    const b = bookings.find((x) => x.id === id);
    if (!b) return;
    const next: Booking = { id: b.id, date: b.date, status: "cancelled", client: b.client, package: b.package, notes: b.notes || "Cancelled by owner" };
    await saveBooking(next);
    broadcastUpdate("bookings");
    const updated = await getBookingsWithDisplayStatus();
    setBookings(updated);
    showToast("Booking dibatalkan");
  }

  async function handleBulkBlock() {
    if (!bulkStart || !bulkEnd) {
      showToast("Isi rentang tanggal");
      return;
    }
    const start = new Date(bulkStart);
    const end = new Date(bulkEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      showToast("Rentang tidak valid");
      return;
    }
    const d = new Date(start);
    let count = 0;
    const existingAll = await getBookings();
    while (d <= end) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const existing = existingAll.find((b) => b.date === ds);
      const b: Booking = {
        id: existing?.id || generateId(),
        date: ds,
        status: "blocked",
        notes: "Bulk blocked",
      };
      await saveBooking(b);
      count++;
      d.setDate(d.getDate() + 1);
    }
    broadcastUpdate("bookings");
    const updated = await getBookingsWithDisplayStatus();
    setBookings(updated);
    showToast(`${count} tanggal di block dan terpublish`);
  }

  async function handleSaveSettings() {
    if (!settings) return;
    const next: Settings = {
      ...settings,
      waLink: waLink.trim(),
      transportNote: transportNote.trim(),
      priceBasic: priceBasic.trim(),
      pricePremium: pricePremium.trim(),
    };
    await saveSettings(next);
    setSettingsState(next);
    broadcastUpdate("settings");
    showToast("Pengaturan disimpan dan terpublish");
  }

  if (checking) {
    return <div className="min-h-screen bg-[#FFFCFA] flex items-center justify-center sans text-[13px] text-[#1A1A1A]/50">Memuat...</div>;
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#F6F1EB] flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] bg-[#FFFCFA] rounded-[24px] border border-[#EDE3DA] p-7 md:p-8 shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#C9A96E] text-[12px]">H</div>
            <div>
              <div className="serif text-[16px] tracking-[0.12em]">HIRENA MAKEUP</div>
              <div className="sans text-[10px] tracking-[0.16em] uppercase text-[#1A1A1A]/40">Owner Access</div>
            </div>
          </div>
          {!authExists ? (
            <>
              <h1 className="serif text-[22px] leading-[1.1]">Buat Password Owner</h1>
              <p className="sans text-[12px] leading-[1.6] text-[#1A1A1A]/50 mt-2">Belum ada password. Buat password untuk mengamankan dashboard. Disimpan lokal di perangkat ini (IndexedDB).</p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Password baru</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" className="mt-2 w-full h-11 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[13px] focus:outline-none focus:border-[#C9A96E]" />
                </div>
                <div>
                  <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Konfirmasi password</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Ulangi password" className="mt-2 w-full h-11 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[13px] focus:outline-none focus:border-[#C9A96E]" />
                </div>
                {loginError && <div className="sans text-[12px] text-red-500">{loginError}</div>}
                <button onClick={handleCreatePassword} className="w-full h-11 bg-[#1A1A1A] text-white sans text-[11px] tracking-[0.16em] uppercase hover:bg-black transition rounded-[12px]">Simpan Password</button>
                <div className="sans text-[10px] text-[#1A1A1A]/30 text-center">Hanya owner yang tahu link ini. Jangan bagikan URL.</div>
              </div>
            </>
          ) : (
            <>
              <h1 className="serif text-[22px] leading-[1.1]">Login Owner</h1>
              <p className="sans text-[12px] leading-[1.6] text-[#1A1A1A]/50 mt-2">Masukkan password owner untuk membuka dashboard.</p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="Password owner" className="mt-2 w-full h-11 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[13px] focus:outline-none focus:border-[#C9A96E]" />
                </div>
                {loginError && <div className="sans text-[12px] text-red-500">{loginError}</div>}
                <button onClick={handleLogin} className="w-full h-11 bg-[#1A1A1A] text-white sans text-[11px] tracking-[0.16em] uppercase hover:bg-black transition rounded-[12px]">Masuk</button>
                <div className="sans text-[10px] text-[#1A1A1A]/30 text-center">Sesi berlaku 12 jam di perangkat ini.</div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const filteredItems = filterCat === "all" ? items : items.filter((i) => i.categoryId === filterCat);
  const featuredCount = items.filter((i) => i.featured).length;

  return (
    <div className="min-h-screen bg-[#FFFCFA] flex flex-col md:flex-row">
      <aside className="hidden md:flex w-[260px] shrink-0 bg-[#1A1A1A] text-white flex-col sticky top-0 h-screen">
        <div className="px-7 py-7 border-b border-white/10">
          <div className="serif text-[15px] tracking-[0.16em]">HIRENA MAKEUP</div>
          <div className="sans text-[10px] tracking-[0.16em] uppercase text-[#C9A96E] mt-1">Owner Dashboard</div>
        </div>
        <nav className="px-3 py-6 space-y-1 flex-1">
          {[
            { id: "portfolio", label: "Portfolio Galeri", desc: `${categories.length} kategori · ${items.length} foto` },
            { id: "calendar", label: "Kalender", desc: `${bookings.length} booking` },
            { id: "settings", label: "Pengaturan", desc: "WA and Info" },
          ].map((it) => (
            <button key={it.id} onClick={() => setTab(it.id as Tab)} className={`w-full text-left px-4 py-3 rounded-[12px] flex items-center justify-between transition ${tab === it.id ? "bg-[#C9A96E] text-[#1A1A1A]" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
              <div>
                <div className="sans text-[13px] font-medium tracking-[0.02em]">{it.label}</div>
                <div className={`sans text-[10px] tracking-[0.08em] uppercase ${tab === it.id ? "text-[#1A1A1A]/60" : "text-white/30"}`}>{it.desc}</div>
              </div>
              <span className={`w-2 h-2 rounded-full ${tab === it.id ? "bg-[#1A1A1A]" : "bg-[#C9A96E]/50"}`} />
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={handleLogout} className="w-full h-10 border border-white/15 text-white sans text-[11px] tracking-[0.14em] uppercase hover:bg-white hover:text-black transition rounded-[12px]">Logout</button>
          <div className="sans text-[10px] text-white/25 text-center mt-3">Hirena DB lokal · v2 · auto publish</div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0">
        <div className="sticky top-0 z-20 bg-[#FFFCFA]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[#FFFCFA]/90 border-b border-[#EDE3DA] px-4 md:px-8 h-14 md:h-[64px] flex items-center justify-between">
          <div className="min-w-0">
            <div className="serif text-[16px] md:text-[20px] leading-none truncate">{tab === "portfolio" ? "Portfolio Galeri" : tab === "calendar" ? "Kelola Kalender" : "Pengaturan"}</div>
            <div className="sans text-[11px] text-[#1A1A1A]/40 hidden md:block">
              {tab === "portfolio" ? "Kategori dan foto. Setiap simpan langsung terpublish otomatis." : tab === "calendar" ? "Klik tanggal untuk tambah atau edit booking. Batal merah, selesai hijau otomatis." : "Edit WA link dan catatan transport."}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <span className="hidden md:inline-flex sans text-[11px] tracking-[0.12em] uppercase bg-[#F6F1EB] border border-[#EDE3DA] px-3 py-1.5 rounded-full">Auto Publish Aktif</span>
            <span className="inline-flex md:hidden items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="sans text-[10px] tracking-[0.12em] uppercase text-emerald-700 font-medium">Live</span>
            </span>
            <button onClick={handleLogout} aria-label="Logout" className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-[#EDE3DA] bg-white flex items-center justify-center text-[13px] hover:bg-[#F6F1EB] transition active:scale-95">⎋</button>
          </div>
        </div>

        <div className="px-4 md:px-8 py-4 md:py-8 max-w-[1100px]">
          {tab === "portfolio" && (
            <div className="space-y-8">
              {/* kategori */}
              <div className="bg-white rounded-[16px] border border-[#EDE3DA] p-4 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="serif text-[16px]">Kategori Galeri</h3>
                  <span className="sans text-[10px] tracking-[0.12em] uppercase bg-[#F6F1EB] border border-[#EDE3DA] px-3 py-1 rounded-full">{categories.length} kategori</span>
                </div>
                <p className="sans text-[11px] text-[#1A1A1A]/50 mt-1">CRUD kategori: nama, urutan, hapus. Auto publish setiap perubahan.</p>

                <div className="mt-4 flex gap-2">
                  <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()} placeholder="Nama kategori baru, misal Natural Glam" className="flex-1 h-12 px-4 bg-[#FFFCFA] border border-[#EDE3DA] rounded-[12px] sans text-[14px] focus:outline-none focus:border-[#C9A96E]" />
                  <button onClick={handleCreateCategory} className="h-12 min-h-[44px] px-6 bg-[#1A1A1A] text-white sans text-[11px] tracking-[0.12em] uppercase rounded-[12px] hover:bg-black transition shrink-0 active:scale-[0.98]">Tambah</button>
                </div>

                <div className="mt-4 space-y-3">
                  {categories.map((c, idx) => (
                    <div key={c.id} className="flex flex-col md:flex-row md:items-center gap-2 bg-[#F6F1EB]/40 border border-[#EDE3DA] rounded-[16px] p-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="sans text-[11px] bg-white border border-[#EDE3DA] px-2 py-1 rounded-full shrink-0">#{idx + 1}</span>
                        {editingCatId === c.id ? (
                          <input value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} className="flex-1 h-11 min-h-[44px] px-3 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px] focus:outline-none focus:border-[#C9A96E]" />
                        ) : (
                          <div className="flex-1 min-w-0">
                            <div className="sans text-[13px] font-medium truncate">{c.name}</div>
                            <div className="sans text-[10px] text-[#1A1A1A]/40 truncate">{c.slug} · order {c.order}</div>
                          </div>
                        )}
                      </div>
                      {editingCatId === c.id ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdateCategory(c.id)} className="flex-1 md:flex-none h-11 min-h-[44px] px-5 bg-[#C9A96E] text-[#1A1A1A] sans text-[11px] tracking-[0.12em] uppercase font-medium rounded-[12px] active:scale-[0.98]">Simpan</button>
                          <button onClick={() => setEditingCatId(null)} className="flex-1 md:flex-none h-11 min-h-[44px] px-5 bg-white border border-[#EDE3DA] sans text-[11px] rounded-[12px]">Batal</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full md:w-auto">
                          <button onClick={() => { setEditingCatId(c.id); setEditingCatName(c.name); }} className="flex-1 md:flex-none h-11 min-h-[44px] px-4 bg-white border border-[#EDE3DA] sans text-[11px] tracking-[0.12em] uppercase rounded-[12px] hover:bg-[#F6F1EB] active:scale-[0.98]">Edit</button>
                          <div className="flex gap-2">
                            <button onClick={() => handleReorderCategory(c.id, -1)} disabled={idx === 0} className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] border border-[#EDE3DA] bg-white sans text-[13px] hover:bg-[#F6F1EB] disabled:opacity-30 flex items-center justify-center">↑</button>
                            <button onClick={() => handleReorderCategory(c.id, 1)} disabled={idx === categories.length - 1} className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] border border-[#EDE3DA] bg-white sans text-[13px] hover:bg-[#F6F1EB] disabled:opacity-30 flex items-center justify-center">↓</button>
                          </div>
                          <button onClick={() => handleDeleteCategory(c.id)} className="h-11 min-h-[44px] px-4 bg-red-50 border border-red-200 text-red-600 sans text-[11px] rounded-[12px] hover:bg-red-100 active:scale-[0.98]">Hapus</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {categories.length === 0 && <div className="sans text-[12px] text-[#1A1A1A]/40 py-6 text-center border border-dashed border-[#EDE3DA] rounded-[12px] bg-[#F6F1EB]/30">Belum ada kategori.</div>}
                </div>
              </div>

              {/* tambah foto */}
              <div className="bg-white rounded-[16px] border border-[#EDE3DA] p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <h3 className="serif text-[16px]">Tambah Foto Galeri</h3>
                  <span className="sans text-[10px] tracking-[0.12em] uppercase bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full w-fit">Featured untuk hero {featuredCount}/9</span>
                </div>
                <p className="sans text-[11px] text-[#1A1A1A]/50 mt-1">Upload file otomatis resize 800px ke base64. Pilih kategori dan centang featured untuk sample hero.</p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-3 md:contents">
                    <div>
                      <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Judul</label>
                      <input value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder="Judul foto" className="mt-1.5 w-full h-12 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px] focus:outline-none focus:border-[#C9A96E]" />
                    </div>
                    <div>
                      <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Kategori</label>
                      <select value={newItemCat} onChange={(e) => setNewItemCat(e.target.value)} className="mt-1.5 w-full h-12 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px]">
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Deskripsi</label>
                    <input value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} placeholder="Deskripsi singkat" className="mt-1.5 w-full h-12 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px]" />
                  </div>
                  <div className="flex items-center gap-3 py-1">
                    <label className="flex items-center gap-2 cursor-pointer h-11">
                      <input type="checkbox" checked={newItemFeatured} onChange={(e) => setNewItemFeatured(e.target.checked)} className="w-5 h-5 accent-[#C9A96E]" />
                      <span className="sans text-[13px]">Featured untuk hero</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:flex gap-2 md:justify-end">
                    <label className="w-full md:w-auto h-12 min-h-[44px] px-6 bg-[#1A1A1A] text-white sans text-[11px] tracking-[0.12em] uppercase inline-flex items-center justify-center rounded-[12px] hover:bg-black cursor-pointer active:scale-[0.98]">
                      Pilih Foto
                      <input type="file" accept="image/*" multiple onChange={handleUploadNewItem} className="hidden" />
                    </label>
                    <button onClick={handleSaveNewItemButton} className="w-full md:w-auto h-12 min-h-[44px] px-6 border border-[#EDE3DA] bg-white sans text-[11px] tracking-[0.12em] uppercase rounded-[12px] hover:bg-[#F6F1EB] active:scale-[0.98]">Simpan Tanpa Foto</button>
                  </div>
                </div>
                <div className="mt-4 flex flex-col md:flex-row gap-2">
                  <button onClick={handleSimpanPublishPortfolio} className="w-full md:w-auto h-12 min-h-[44px] px-6 bg-[#C9A96E] text-[#1A1A1A] sans text-[11px] tracking-[0.14em] uppercase rounded-[12px] hover:bg-[#b8975a] font-medium active:scale-[0.98]">Simpan dan Publish</button>
                  <span className="sans text-[11px] text-[#1A1A1A]/40 self-center text-center md:text-left">Auto publish aktif, tombol untuk eksplisit.</span>
                </div>
              </div>

              {/* filter + grid */}
              <div className="bg-white rounded-[16px] border border-[#EDE3DA] p-4 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="serif text-[16px]">Galeri Foto ({filteredItems.length})</h3>
                  <div className="flex items-center gap-2">
                    <span className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/40">Filter</span>
                    <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="h-11 min-h-[44px] px-4 bg-[#F6F1EB] border border-[#EDE3DA] rounded-full sans text-[13px]">
                      <option value="all">Semua kategori</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {filteredItems.length === 0 ? (
                  <div className="mt-6 sans text-[13px] text-[#1A1A1A]/40 bg-[#F6F1EB] rounded-[16px] border border-dashed border-[#EDE3DA] p-10 text-center">Belum ada foto di kategori ini. Upload untuk memulai.</div>
                ) : (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.slice().sort((a,b)=>a.order-b.order).map((p, idx) => {
                      const catName = categories.find((c)=>c.id===p.categoryId)?.name || p.categoryId;
                      const isEditing = editingItemId === p.id;
                      return (
                        <div key={p.id} className="bg-[#FFFCFA] rounded-[16px] border border-[#EDE3DA] overflow-hidden group">
                          <div className="aspect-[4/3] md:aspect-[3/4] bg-[#F6F1EB] relative overflow-hidden">
                            {p.imageUrl.startsWith("gradient:") ? <div className="absolute inset-0 bg-gradient-to-br from-[#FFFCFA] via-[#F6F1EB] to-[#EDE3DA]" /> : <img src={p.imageUrl} alt={p.title} loading="lazy" decoding="async" sizes="(max-width: 768px) 100vw, 33vw" className="w-full h-full object-cover" />}
                            {p.imageUrl.startsWith("gradient:") && <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(120% 80% at 30% 20%, #C9A96E 0%, transparent 60%)` }} />}
                            <div className="absolute top-2 left-2 sans text-[10px] bg-white/90 backdrop-blur px-2.5 py-1 rounded-full border border-[#EDE3DA] font-medium">#{idx + 1}</div>
                            {p.featured && <div className="absolute top-2 right-2 sans text-[10px] bg-[#C9A96E] text-white px-2.5 py-1 rounded-full font-medium">Featured</div>}
                            <div className="absolute bottom-2 left-2 sans text-[10px] bg-[#1A1A1A] text-white px-2.5 py-1 rounded-full truncate max-w-[70%]">{catName}</div>
                          </div>
                          <div className="p-3 md:p-3 space-y-3">
                            {isEditing ? (
                              <>
                                <input value={editItemTitle} onChange={(e)=>setEditItemTitle(e.target.value)} placeholder="Judul" className="w-full sans text-[14px] px-4 h-11 min-h-[44px] border border-[#EDE3DA] rounded-[12px] focus:outline-none focus:border-[#C9A96E] bg-white" />
                                <input value={editItemDesc} onChange={(e)=>setEditItemDesc(e.target.value)} placeholder="Deskripsi" className="w-full sans text-[14px] px-4 h-11 min-h-[44px] border border-[#EDE3DA] rounded-[12px] bg-white" />
                                <select value={editItemCat} onChange={(e)=>setEditItemCat(e.target.value)} className="w-full h-11 min-h-[44px] px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px]">
                                  {categories.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <label className="flex items-center gap-2 h-11">
                                  <input type="checkbox" checked={editItemFeatured} onChange={(e)=>setEditItemFeatured(e.target.checked)} className="w-5 h-5 accent-[#C9A96E]" />
                                  <span className="sans text-[12px]">Featured</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  <button onClick={()=>handleUpdateItem(p.id)} className="h-11 min-h-[44px] rounded-[12px] bg-[#1A1A1A] text-white sans text-[11px] tracking-[0.12em] uppercase font-medium active:scale-[0.98]">Simpan</button>
                                  <button onClick={()=>setEditingItemId(null)} className="h-11 min-h-[44px] rounded-[12px] border border-[#EDE3DA] bg-white sans text-[11px] tracking-[0.12em] uppercase active:scale-[0.98]">Batal</button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <div className="sans text-[13px] font-medium truncate">{p.title}</div>
                                  <div className="sans text-[11px] text-[#1A1A1A]/50 truncate">{p.description || "Tanpa deskripsi"}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button onClick={()=>{setEditingItemId(p.id); setEditItemTitle(p.title); setEditItemDesc(p.description||""); setEditItemCat(p.categoryId); setEditItemFeatured(p.featured);}} className="h-11 min-h-[44px] rounded-[12px] border border-[#EDE3DA] bg-white sans text-[11px] tracking-[0.12em] uppercase font-medium hover:bg-[#F6F1EB] active:scale-[0.98]">Edit</button>
                                  <button onClick={()=>handleToggleFeatured(p.id)} className={`h-11 min-h-[44px] rounded-[12px] border sans text-[11px] tracking-[0.12em] uppercase font-medium active:scale-[0.98] ${p.featured?"bg-[#C9A96E] border-[#C9A96E] text-[#1A1A1A]":"bg-white border-[#EDE3DA] hover:bg-[#F6F1EB]"}`}>{p.featured?"Unfeat":"Feat"}</button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <button onClick={()=>handleReorderItem(p.id,-1)} className="h-11 min-h-[44px] rounded-[12px] border border-[#EDE3DA] bg-white sans text-[11px] hover:bg-[#F6F1EB] flex items-center justify-center gap-1 active:scale-[0.98]"><span>↑</span> <span className="hidden sm:inline">Up</span></button>
                                  <button onClick={()=>handleReorderItem(p.id,1)} className="h-11 min-h-[44px] rounded-[12px] border border-[#EDE3DA] bg-white sans text-[11px] hover:bg-[#F6F1EB] flex items-center justify-center gap-1 active:scale-[0.98]"><span>↓</span> <span className="hidden sm:inline">Down</span></button>
                                  <button onClick={()=>handleDeleteItem(p.id)} className="h-11 min-h-[44px] rounded-[12px] bg-[#1A1A1A] text-white sans text-[11px] tracking-[0.12em] uppercase hover:bg-black active:scale-[0.98]">Hapus</button>
                                </div>
                                <label className="flex items-center justify-center w-full h-11 min-h-[44px] rounded-[12px] border border-dashed border-[#EDE3DA] bg-[#F6F1EB]/40 sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/70 hover:bg-[#F6F1EB] cursor-pointer active:scale-[0.98]">
                                  Ganti gambar
                                  <input type="file" accept="image/*" onChange={(e)=>handleReplaceImage(p.id,e)} className="hidden" />
                                </label>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "calendar" && (
            <div className="space-y-6">
              <BookingCalendar mode="admin" onSelectDate={onCalendarSelect} />

              <div id="booking-form" className="bg-white rounded-[16px] border border-[#EDE3DA] p-4 md:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="serif text-[16px]">Detail Tanggal</h3>
                  <span className="sans text-[11px] tracking-[0.12em] uppercase bg-[#F6F1EB] border border-[#EDE3DA] px-3 py-1.5 rounded-full shrink-0">{selectedDate || "Pilih tanggal"}</span>
                </div>
                {!selectedDate ? (
                  <div className="sans text-[13px] text-[#1A1A1A]/40 py-8 text-center border border-dashed border-[#EDE3DA] rounded-[12px] bg-[#F6F1EB]/30">Klik salah satu tanggal di kalender untuk mengelola.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Tanggal</label>
                      <input value={selectedDate} readOnly className="mt-1.5 w-full h-12 px-4 bg-[#F6F1EB] border border-[#EDE3DA] rounded-[12px] sans text-[14px]" />
                    </div>
                    <div>
                      <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Status</label>
                      <select value={formStatus} onChange={(e)=>setFormStatus(e.target.value as BookingStatus)} className="mt-1.5 w-full h-12 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px]">
                        <option value="booked">Terisi (Booked)</option>
                        <option value="blocked">Blocked</option>
                        <option value="cancelled">Batal (Cancelled) - merah</option>
                        <option value="completed" disabled>Selesai (Completed) - otomatis hijau</option>
                      </select>
                      <div className="sans text-[10px] text-[#1A1A1A]/40 mt-1">Completed otomatis untuk tanggal lewat yang booked.</div>
                    </div>
                    <div>
                      <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Client</label>
                      <input value={formClient} onChange={(e)=>setFormClient(e.target.value)} placeholder="Nama client" disabled={formStatus==="blocked"} className="mt-1.5 w-full h-12 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px] disabled:bg-[#F6F1EB] disabled:text-[#1A1A1A]/40" />
                    </div>
                    <div>
                      <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Package</label>
                      <select value={formPackage} onChange={(e)=>setFormPackage(e.target.value)} disabled={formStatus==="blocked"} className="mt-1.5 w-full h-12 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px] disabled:bg-[#F6F1EB]">
                        {PACKAGES.map((p)=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Catatan</label>
                      <textarea value={formNotes} onChange={(e)=>setFormNotes(e.target.value)} placeholder="Catatan internal" rows={3} className="mt-1.5 w-full px-4 py-3 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px] resize-none" />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 md:flex gap-2 pt-2">
                      <button onClick={handleSaveBooking} className="w-full md:w-auto bg-[#1A1A1A] text-white sans text-[11px] tracking-[0.14em] uppercase px-6 h-12 min-h-[44px] rounded-[12px] hover:bg-black transition active:scale-[0.98]">Simpan dan Publish</button>
                      {editingId && <button onClick={handleDeleteBooking} className="w-full md:w-auto sans text-[11px] tracking-[0.14em] uppercase border border-red-200 text-red-600 bg-white px-6 h-12 min-h-[44px] rounded-[12px] hover:bg-red-50 transition active:scale-[0.98]">Hapus Slot</button>}
                      <button onClick={()=>{setSelectedDate(null); setEditingId(null);}} className="w-full md:w-auto sans text-[11px] tracking-[0.14em] uppercase border border-[#EDE3DA] bg-white px-6 h-12 min-h-[44px] rounded-[12px] hover:bg-[#F6F1EB] transition active:scale-[0.98]">Batal</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[16px] border border-[#EDE3DA] p-4 md:p-6">
                <h3 className="sans text-[13px] font-medium tracking-[0.04em]">Bulk Block Tanggal</h3>
                <p className="sans text-[11px] text-[#1A1A1A]/50 mt-1">Block rentang tanggal sekaligus, misal libur atau cuti.</p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <div>
                    <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Dari</label>
                    <input type="date" value={bulkStart} onChange={(e)=>setBulkStart(e.target.value)} className="mt-1.5 w-full h-12 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px]" />
                  </div>
                  <div>
                    <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Sampai</label>
                    <input type="date" value={bulkEnd} onChange={(e)=>setBulkEnd(e.target.value)} className="mt-1.5 w-full h-12 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px]" />
                  </div>
                  <button onClick={handleBulkBlock} className="w-full md:w-auto h-12 min-h-[44px] bg-[#C9A96E] text-[#1A1A1A] sans text-[11px] tracking-[0.14em] uppercase px-6 rounded-[12px] hover:bg-[#b8975a] transition font-medium active:scale-[0.98]">Block Rentang</button>
                </div>
              </div>

              <div className="bg-white rounded-[16px] border border-[#EDE3DA] overflow-hidden">
                <div className="px-4 md:px-5 py-4 border-b border-[#EDE3DA] flex items-center justify-between gap-3">
                  <h3 className="sans text-[13px] font-medium">Daftar Booking ({bookings.length})</h3>
                  <span className="sans text-[10px] tracking-[0.12em] uppercase text-[#1A1A1A]/40 hidden md:inline">Hijau selesai, merah batal</span>
                </div>
                {/* desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full sans text-[12px]">
                    <thead className="bg-[#F6F1EB]/60">
                      <tr className="text-left text-[#1A1A1A]/50">
                        <th className="px-4 py-3 font-medium">Tanggal</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Display</th>
                        <th className="px-4 py-3 font-medium">Client</th>
                        <th className="px-4 py-3 font-medium">Package</th>
                        <th className="px-4 py-3 font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.length===0 ? (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-[#1A1A1A]/40">Belum ada booking. Data seed akan muncul otomatis.</td></tr>
                      ) : (
                        bookings.slice().sort((a,b)=>a.date.localeCompare(b.date)).map((b)=> (
                          <tr key={b.id} className="border-t border-[#EDE3DA]/60 hover:bg-[#F6F1EB]/30">
                            <td className="px-4 py-3 whitespace-nowrap">{b.date}</td>
                            <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] tracking-[0.06em] uppercase border ${b.status==="cancelled"?"bg-red-500 text-white border-red-500":b.status==="blocked"?"bg-[#1A1A1A] text-white border-[#1A1A1A]":b.status==="booked"?"bg-[#C9A96E] text-white border-[#C9A96E]":"bg-white border-[#EDE3DA]"}`}>{b.status}</span></td>
                            <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] tracking-[0.06em] uppercase border font-medium ${b.displayStatus==="cancelled"?"bg-red-50 text-red-700 border-red-200":b.displayStatus==="completed"?"bg-emerald-500 text-white border-emerald-500":b.displayStatus==="blocked"?"bg-[#EDE3DA] text-[#1A1A1A] border-[#EDE3DA]":b.displayStatus==="booked"?"bg-white border-[#C9A96E] text-[#1A1A1A]":"bg-white border-[#EDE3DA]"}`}>{b.displayStatus}</span></td>
                            <td className="px-4 py-3">{b.client||"-"}</td>
                            <td className="px-4 py-3">{b.package||"-"}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2 flex-wrap">
                                <button onClick={()=>onCalendarSelect(b.date, b)} className="px-4 h-11 min-h-[44px] rounded-full border border-[#EDE3DA] bg-white hover:bg-[#F6F1EB] sans text-[12px]">Edit</button>
                                {b.status!=="cancelled" && b.displayStatus!=="completed" && <button onClick={()=>handleCancelBookingRow(b.id)} className="px-4 h-11 min-h-[44px] rounded-full bg-red-500 text-white sans text-[12px] hover:bg-red-600">Batal</button>}
                                <button onClick={async()=>{await deleteBooking(b.id); broadcastUpdate("bookings"); const updated=await getBookingsWithDisplayStatus(); setBookings(updated); showToast("Dihapus");}} className="px-4 h-11 min-h-[44px] rounded-full bg-[#1A1A1A] text-white sans text-[12px] hover:bg-black">Hapus</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {/* mobile cards */}
                <div className="md:hidden p-3">
                  {bookings.length===0 ? (
                    <div className="sans text-[13px] text-[#1A1A1A]/40 bg-[#F6F1EB] rounded-[16px] border border-dashed border-[#EDE3DA] p-8 text-center">Belum ada booking.</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {bookings.slice().sort((a,b)=>a.date.localeCompare(b.date)).map((b)=> (
                        <div key={b.id} className="bg-[#FFFCFA] rounded-[16px] border border-[#EDE3DA] p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="sans text-[13px] font-medium">{b.date}</span>
                            <span className={`inline-flex px-3 py-1 rounded-full text-[10px] tracking-[0.12em] uppercase border font-medium ${b.displayStatus==="cancelled"?"bg-red-50 text-red-700 border-red-200":b.displayStatus==="completed"?"bg-emerald-500 text-white border-emerald-500":b.displayStatus==="blocked"?"bg-[#EDE3DA] text-[#1A1A1A] border-[#EDE3DA]":b.displayStatus==="booked"?"bg-white border-[#C9A96E] text-[#1A1A1A]":"bg-white border-[#EDE3DA]"}`}>{b.displayStatus}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="sans text-[12px] font-medium truncate">{b.client || "Tanpa nama"}</div>
                              <div className="sans text-[11px] text-[#1A1A1A]/50">{b.package || "-"} · <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] tracking-[0.06em] uppercase border ${b.status==="cancelled"?"bg-red-500 text-white border-red-500":b.status==="blocked"?"bg-[#1A1A1A] text-white border-[#1A1A1A]":b.status==="booked"?"bg-[#C9A96E] text-white border-[#C9A96E]":"bg-white border-[#EDE3DA]"}`}>{b.status}</span></div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button onClick={()=>onCalendarSelect(b.date, b)} className="h-11 min-h-[44px] rounded-[12px] border border-[#EDE3DA] bg-white sans text-[11px] tracking-[0.12em] uppercase font-medium hover:bg-[#F6F1EB] active:scale-[0.98]">Edit</button>
                            {b.status!=="cancelled" && b.displayStatus!=="completed" ? (
                              <button onClick={()=>handleCancelBookingRow(b.id)} className="h-11 min-h-[44px] rounded-[12px] bg-red-500 text-white sans text-[11px] tracking-[0.12em] uppercase font-medium hover:bg-red-600 active:scale-[0.98]">Batal</button>
                            ) : (
                              <span className="h-11 min-h-[44px] rounded-[12px] bg-[#F6F1EB] border border-[#EDE3DA] flex items-center justify-center sans text-[11px] text-[#1A1A1A]/30">Batal</span>
                            )}
                            <button onClick={async()=>{await deleteBooking(b.id); broadcastUpdate("bookings"); const updated=await getBookingsWithDisplayStatus(); setBookings(updated); showToast("Dihapus");}} className="h-11 min-h-[44px] rounded-[12px] bg-[#1A1A1A] text-white sans text-[11px] tracking-[0.12em] uppercase hover:bg-black active:scale-[0.98]">Hapus</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div className="space-y-6 max-w-[640px]">
              <div className="bg-white rounded-[16px] border border-[#EDE3DA] p-4 md:p-6 space-y-5">
                <div>
                  <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">WA Link</label>
                  <input value={waLink} onChange={(e)=>setWaLink(e.target.value)} placeholder="https://wa.me/..." className="mt-1.5 w-full h-12 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px] focus:outline-none focus:border-[#C9A96E]" />
                  <div className="sans text-[11px] text-[#1A1A1A]/40 mt-1.5">Link yang dipakai tombol Book via WA di landing.</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Harga Basic</label>
                    <input value={priceBasic} onChange={(e)=>setPriceBasic(e.target.value)} placeholder="350K" className="mt-1.5 w-full h-12 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px]" />
                  </div>
                  <div>
                    <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Harga Premium</label>
                    <input value={pricePremium} onChange={(e)=>setPricePremium(e.target.value)} placeholder="550K" className="mt-1.5 w-full h-12 px-4 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px]" />
                  </div>
                </div>
                <div>
                  <label className="sans text-[11px] tracking-[0.12em] uppercase text-[#1A1A1A]/60">Catatan Transport</label>
                  <textarea value={transportNote} onChange={(e)=>setTransportNote(e.target.value)} rows={3} placeholder="Info transport" className="mt-1.5 w-full px-4 py-3 bg-white border border-[#EDE3DA] rounded-[12px] sans text-[14px] resize-none focus:outline-none focus:border-[#C9A96E]" />
                </div>
                <button onClick={handleSaveSettings} className="w-full md:w-auto bg-[#1A1A1A] text-white sans text-[11px] tracking-[0.14em] uppercase px-6 h-12 min-h-[44px] rounded-[12px] hover:bg-black transition active:scale-[0.98]">Simpan dan Publish</button>
              </div>
              <div className="bg-[#F6F1EB] border border-[#EDE3DA] rounded-[16px] p-5">
                <div className="sans text-[12px] font-medium">Info Penyimpanan</div>
                <div className="sans text-[12px] leading-[1.7] text-[#1A1A1A]/60 mt-2">Semua data disimpan lokal di browser via IndexedDB (hirena-db). Setiap simpan langsung auto publish via BroadcastChannel dan storage event. Tidak ada backend.</div>
                <div className="mt-4 sans text-[11px] text-[#1A1A1A]/40">DB: hirena-db v2 · stores: portfolioCategories, portfolioItems, bookings, settings, auth · session 12 jam</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#FFFCFA]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[#FFFCFA]/90 border-t border-[#EDE3DA] px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              id: "portfolio",
              label: "Galeri",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 15l5-5 4 4 3-3 6 6" />
                  <circle cx="9" cy="8" r="1.6" />
                </svg>
              ),
            },
            {
              id: "calendar",
              label: "Kalender",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="17" rx="2" />
                  <path d="M16 2v4M8 2v4M3 9h18" />
                </svg>
              ),
            },
            {
              id: "settings",
              label: "Setting",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3.2" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a1 1 0 1 1-1.4 1.4l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.6v.2a1 1 0 1 1-2 0v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a1 1 0 1 1-1.4-1.4l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.6-1h-.2a1 1 0 1 1 0-2h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a1 1 0 1 1 1.4-1.4l.1.1a1.7 1.7 0 0 0 1.9.4h.1a1.7 1.7 0 0 0 1-1.6v-.2a1 1 0 1 1 2 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.4l.1-.1a1 1 0 1 1 1.4 1.4l-.1.1a1.7 1.7 0 0 0-.4 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a1 1 0 1 1 0 2h-.2a1.7 1.7 0 0 0-1.6 1z" />
                </svg>
              ),
            },
          ].map((it) => (
            <button key={it.id} onClick={() => setTab(it.id as Tab)} className={`h-14 min-h-[56px] rounded-[16px] flex flex-col items-center justify-center gap-1 transition active:scale-[0.98] ${tab === it.id ? "bg-[#C9A96E] text-[#1A1A1A] shadow-[0_4px_12px_rgba(201,169,110,0.3)]" : "text-[#1A1A1A]/50 hover:bg-[#F6F1EB] hover:text-[#1A1A1A]"}`}>
              <span className={`w-5 h-5 flex items-center justify-center rounded-full ${tab === it.id ? "bg-[#1A1A1A] text-[#C9A96E]" : "bg-[#1A1A1A]/5 text-[#1A1A1A]/70"}`}>{it.icon}</span>
              <span className="sans text-[10px] tracking-[0.12em] uppercase font-medium">{it.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {toast && <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1A1A1A] text-white sans text-[13px] px-6 py-3.5 rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.2)] border border-white/10 whitespace-nowrap mb-[env(safe-area-inset-bottom)]">{toast}</div>}
    </div>
  );
}
