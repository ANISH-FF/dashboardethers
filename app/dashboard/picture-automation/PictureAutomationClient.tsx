"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAutomationStore, GroupedDish, ScrapedImage } from "@/components/AutomationStoreContext";
import { 
  Camera, 
  Upload, 
  Download, 
  FolderArchive, 
  ExternalLink, 
  Check, 
  Utensils, 
  Maximize2,
  Trash2,
  RotateCcw
} from "lucide-react";

export default function PictureAutomationClient({ userId }: { userId: string }) {
  // Store Context for Route Persistence & State Isolation
  const { 
    currentMenuItems, 
    picItemsText: itemsText, 
    setPicItemsText: setItemsText, 
    picBrandName: brandName, 
    setPicBrandName: setBrandName, 
    picCount: count, 
    setPicCount: setCount,
    picViewState: viewState,
    setPicViewState: setViewState,
    picGroupedDishes: groupedDishes,
    setPicGroupedDishes: setGroupedDishes,
    picBrandSlug: currentBrandSlug,
    setPicBrandSlug: setCurrentBrandSlug,
    picClientId,
    setPicClientId,
    picDownloadZipUrl: downloadZipUrl,
    setPicDownloadZipUrl: setDownloadZipUrl,
    picLogs: logs,
    setPicLogs: setLogs,
    resetPictureAutomation
  } = useAutomationStore();

  const [platform, setPlatform] = useState<"zomato" | "swiggy" | "both" | "google">("both");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Drag / Upload state
  const [dragging, setDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logTerminalRef = useRef<HTMLPreElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto scroll terminal logs
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Set stable user-based client_id on mount & check for existing session to auto-resume
  useEffect(() => {
    const init = async () => {
      const activeClientId = userId || "user";
      setPicClientId(activeClientId);

      // Check server for existing session if viewState is input
      if (viewState === "input") {
        try {
          const res = await fetch(`/api/picture-automation/session_status/${activeClientId}`);
          if (res.ok) {
            const info = await res.json();
            if (info.status === "done" && info.brand_slug) {
              // Session completed — auto-restore gallery without re-running
              setCurrentBrandSlug(info.brand_slug);
              await fetchGallery(info.brand_slug);
            } else if (info.status === "active" && info.brand_slug) {
              // Session still running — reconnect to log stream
              setCurrentBrandSlug(info.brand_slug);
              setViewState("loading");
              setLogs(["🔄 Reconnecting to active extraction session...\n"]);
              startTimer();
              reconnectToStream(activeClientId, info.brand_slug);
            }
          }
        } catch {}
      }
    };

    init();
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [userId]);

  // Reconnect to an active SSE log stream (used when navigating back)
  const reconnectToStream = useCallback((clientId: string, brandSlug: string) => {
    const eventSource = new EventSource(`/api/picture-automation/stream_logs/${clientId}`);
    eventSource.onmessage = (event) => {
      if (event.data === "__DONE__") {
        eventSource.close();
        stopTimer();
        setLogs((prev) => [...prev, "\n✅ Extraction Complete! Loading Image Gallery..."]);
        setTimeout(() => { fetchGallery(brandSlug); }, 1200);
      } else {
        setLogs((prev) => [...prev, event.data]);
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
      stopTimer();
      fetchGallery(brandSlug);
    };
  }, []);

  // ─── Helper Functions ────────────────────────────────────────────────────
  const startTimer = () => {
    setElapsedSeconds(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const startTime = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const formatTimer = (totalSecs: number) => {
    const mins = String(Math.floor(totalSecs / 60)).padStart(2, "0");
    const secs = String(totalSecs % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  };

  // Pull items from Menu Automation
  const pullFromMenuAutomation = async () => {
    try {
      setErrorMsg(null);
      let dishNames: string[] = [];

      if (currentMenuItems && currentMenuItems.length > 0) {
        dishNames = currentMenuItems.map((i: any) => i.name).filter(Boolean);
      } else {
        const res = await fetch("/api/menu");
        if (!res.ok) throw new Error("Could not fetch menu items.");
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          dishNames = data.items.map((i: any) => i.name).filter(Boolean);
        }
      }

      if (dishNames.length > 0) {
        const combined = Array.from(new Set([...itemsText.split("\n").filter((x) => x.trim()), ...dishNames])).join("\n");
        setItemsText(combined);
      } else {
        setErrorMsg("No items found in Menu Automation.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to load menu items.");
    }
  };

  // Upload and parse file (.xlsx, .csv, .txt)
  const processFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsParsing(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/picture-automation/parse_file", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "File parsing failed.");

      if (data.items && Array.isArray(data.items)) {
        const existing = itemsText.trim();
        const additions = data.items.join("\n");
        setItemsText(existing ? existing + "\n" + additions : additions);
      }
    } catch (err: any) {
      setErrorMsg("File parse error: " + err.message);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Scrape Execution ────────────────────────────────────────────────────
  const handleStartScraping = async () => {
    const lines = itemsText.split("\n").map((x) => x.trim()).filter(Boolean);
    if (lines.length === 0) {
      setErrorMsg("Please enter at least one food dish item.");
      return;
    }

    setErrorMsg(null);
    setViewState("loading");
    setLogs(["Initializing Food Image Extraction engine...\n"]);
    startTimer();

    const activeClientId = userId || picClientId || "user";
    setPicClientId(activeClientId);

    try {
      const res = await fetch("/api/picture-automation/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items_text: lines.join("\n"),
          platform: platform,
          count: count,
          brand: brandName,
          client_id: activeClientId,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to launch scraper.");

      setCurrentBrandSlug(data.brand_slug);

      // Connect EventSource to stream logs
      const eventSource = new EventSource(`/api/picture-automation/stream_logs/${activeClientId}`);
      eventSource.onmessage = (event) => {
        if (event.data === "__DONE__") {
          eventSource.close();
          stopTimer();
          setLogs((prev) => [...prev, "\n✅ Extraction Complete! Loading Image Gallery..."]);
          setTimeout(() => {
            fetchGallery(data.brand_slug);
          }, 1200);
        } else if (event.data === "__CAPTCHA__") {
          setLogs((prev) => [
            ...prev,
            "\n⚠️ ROBOT VERIFICATION TRIGGERED! Scraping will resume automatically once solved.\n"
          ]);
        } else if (event.data === "__CAPTCHA_SOLVED__") {
          setLogs((prev) => [
            ...prev,
            "\n✅ CAPTCHA SOLVED! Resuming scraping...\n"
          ]);
        } else {
          setLogs((prev) => [...prev, event.data]);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE stream reconnecting...", err);
      };
    } catch (err: any) {
      stopTimer();
      setErrorMsg("Scraper initialization failed: " + err.message);
      setViewState("input");
    }
  };

  // ─── Gallery Fetch & Data Structure ──────────────────────────────────────
  const fetchGallery = async (brandSlug: string) => {
    try {
      const res = await fetch(`/api/picture-automation/get_images?brand_slug=${brandSlug}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server connection failed (${res.status}): ${text.slice(0, 60)}`);
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Server returned HTML instead of JSON: ${text.slice(0, 60)}`);
      }
      const data = await res.json();

      const rawImages: { original_name: string; rel_path: string; url: string }[] = data.images || [];

      // Group images by parent folder (dish name)
      const groupsMap: Record<string, ScrapedImage[]> = {};

      rawImages.forEach((img) => {
        const parts = img.rel_path.replace(/\\/g, "/").split("/");
        const folder = parts.length > 1 ? parts[0] : "General";
        const cleanDishTitle = folder.replace(/_/g, " ").trim();
        
        const cleanRelUrl = img.rel_path.replace(/\\/g, "/");
        const proxyUrl = `/api/picture-automation/downloads/${brandSlug}/${cleanRelUrl}`;

        if (!groupsMap[folder]) {
          groupsMap[folder] = [];
        }
        
        const extMatch = img.original_name.match(/\.[0-9a-z]+$/i);
        const ext = extMatch ? extMatch[0] : ".jpg";

        const cardDefaultName = `${cleanDishTitle}${ext}`;

        groupsMap[folder].push({
          original_name: img.original_name,
          rel_path: img.rel_path,
          url: proxyUrl,
          newName: cardDefaultName,
          selected: false,
        });
      });

      const grouped: GroupedDish[] = Object.entries(groupsMap).map(([folder, imgs]) => ({
        dishName: folder.replace(/_/g, " ").toUpperCase(),
        images: imgs,
      }));

      setGroupedDishes(grouped);
      setViewState("gallery");
    } catch (err: any) {
      setErrorMsg("Gallery load error: " + err.message);
      setViewState("input");
    }
  };

  // ─── Batch Select / Deselect Actions ─────────────────────────────────────
  const selectAllImages = () => {
    setGroupedDishes((prev) =>
      prev.map((dish) => ({
        ...dish,
        images: dish.images.map((img) => ({ ...img, selected: true })),
      }))
    );
  };

  const deselectAllImages = () => {
    setGroupedDishes((prev) =>
      prev.map((dish) => ({
        ...dish,
        images: dish.images.map((img) => ({ ...img, selected: false })),
      }))
    );
  };

  // ─── Image Toggle / Rename Actions ────────────────────────────────────────
  const toggleImageSelection = (dishIndex: number, imgIndex: number) => {
    setGroupedDishes((prev) => {
      const next = [...prev];
      const targetDish = { ...next[dishIndex] };
      const nextImages = [...targetDish.images];
      nextImages[imgIndex] = {
        ...nextImages[imgIndex],
        selected: !nextImages[imgIndex].selected,
      };
      targetDish.images = nextImages;
      next[dishIndex] = targetDish;
      return next;
    });
  };

  const updateImageName = (dishIndex: number, imgIndex: number, newName: string) => {
    setGroupedDishes((prev) => {
      const next = [...prev];
      const targetDish = { ...next[dishIndex] };
      const nextImages = [...targetDish.images];
      nextImages[imgIndex] = {
        ...nextImages[imgIndex],
        newName: newName,
      };
      targetDish.images = nextImages;
      next[dishIndex] = targetDish;
      return next;
    });
  };

  const deleteImageCard = (dishIndex: number, imgIndex: number) => {
    setGroupedDishes((prev) => {
      const next = [...prev];
      const targetDish = { ...next[dishIndex] };
      targetDish.images = targetDish.images.filter((_, i) => i !== imgIndex);
      next[dishIndex] = targetDish;
      return next.filter((d) => d.images.length > 0);
    });
  };

  // ─── Package to ZIP & Clear ──────────────────────────────────────────────
  const handleClearBatch = async () => {
    try {
      const activeClientId = userId || picClientId || "user";
      await fetch("/api/picture-automation/clear_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_slug: currentBrandSlug, client_id: activeClientId }),
      });
    } catch (err) {
      console.error("Failed to clear backend session files", err);
    }
    resetPictureAutomation();
  };

  const handleCreateZip = async () => {
    setIsZipping(true);
    setErrorMsg(null);

    const payloadImages: { original: string; dish_name: string; new: string; rel_path: string }[] = [];

    groupedDishes.forEach((dish) => {
      dish.images.forEach((img) => {
        if (img.selected) {
          let name = (img.newName || dish.dishName || img.original_name).trim();
          const extMatch = img.original_name.match(/\.[0-9a-z]+$/i);
          const ext = extMatch ? extMatch[0] : ".jpg";
          if (!name.endsWith(ext)) name += ext;

          payloadImages.push({
            original: img.original_name,
            dish_name: dish.dishName,
            new: name,
            rel_path: img.rel_path,
          });
        }
      });
    });

    if (payloadImages.length === 0) {
      setErrorMsg("Please select at least one image to include in the ZIP package.");
      setIsZipping(false);
      return;
    }

    try {
      const res = await fetch("/api/picture-automation/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_slug: currentBrandSlug,
          images: payloadImages,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ZIP service connection failed (${res.status}): ${text.slice(0, 60)}`);
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`ZIP service returned HTML instead of JSON: ${text.slice(0, 60)}`);
      }
      const data = await res.json();
      if (data.status !== "success") {
        throw new Error(data.error || "ZIP generation failed.");
      }

      const downloadPath = data.download_url.replace("/api/download_zip/", "");
      setDownloadZipUrl(`/api/picture-automation/download_zip/${downloadPath}`);
      setViewState("done");
    } catch (err: any) {
      setErrorMsg("ZIP packaging failed: " + err.message);
    } finally {
      setIsZipping(false);
    }
  };

  const totalSelectedCount = groupedDishes.reduce(
    (acc, d) => acc + d.images.filter((img) => img.selected).length,
    0
  );
  const totalImagesCount = groupedDishes.reduce((acc, d) => acc + d.images.length, 0);

  return (
    <div className="-m-4 md:-m-6 digitizer-vars text-ink">
      <style>{`
        .digitizer-vars {
          --bg-primary:    #0a0a0a;
          --bg-secondary:  #111111;
          --bg-card:       #161616;
          --bg-hover:      #1c1c1c;
          --bg-input:      #0f0f0f;
          --border:        #272727;
          --border-subtle: #1a1a1a;
          --text-primary:  #f5f5f5;
          --text-secondary:#a3a3a3;
          --text-muted:    #555555;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .digitizer-vars input, .digitizer-vars select, .digitizer-vars textarea {
          color: var(--text-primary);
          background: transparent;
          border: none;
          outline: none;
          font-family: inherit;
        }
        .digitizer-vars input::placeholder, .digitizer-vars textarea::placeholder { color: var(--text-muted); }
      `}</style>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 1. INPUT / SETUP VIEW                                            */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {viewState === "input" && (
        <div style={{ padding: "2rem 1rem 2rem 1rem", background: "var(--bg-primary)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.85rem", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
              <Image 
                src="/uploads/logo.png" 
                alt="Ethers Consultancy" 
                width={56} 
                height={56} 
                style={{ objectFit: "contain" }} 
                className="brightness-0 dark:invert" 
              />
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>
              Picture Automation
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.35rem", fontSize: "0.88rem", maxWidth: 480, lineHeight: 1.5 }}>
              Automated high-resolution food photo extraction with smart batch downloading and instant ZIP packaging.
            </p>
          </div>

          <div style={{ width: "100%", maxWidth: 560, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            {errorMsg && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "0.75rem 1rem", color: "#f87171", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Food Items (One dish per line)
                </label>
                <button 
                  onClick={pullFromMenuAutomation}
                  style={{ background: "none", border: "none", color: "#4ade80", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Utensils size={13} /> Pull from Menu Automation
                </button>
              </div>

              <textarea 
                rows={5}
                value={itemsText}
                onChange={(e) => setItemsText(e.target.value)}
                placeholder={"Paneer Butter Masala\nChicken Biryani\nMasala Dosa\nDal Makhani\nButter Naan"}
                style={{
                  width: "100%",
                  padding: "0.75rem 0.9rem",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  color: "var(--text-primary)",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                  resize: "vertical",
                }}
              />

              <div
                onDrop={(e) => { e.preventDefault(); setDragging(false); processFileUpload(e.dataTransfer.files); }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? "#fff" : "var(--border)"}`,
                  borderRadius: 10,
                  padding: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.65rem",
                  cursor: "pointer",
                  background: dragging ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
                  transition: "all 0.15s",
                }}
              >
                <Upload size={16} style={{ color: "var(--text-secondary)" }} />
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  {isParsing ? "Parsing uploaded file..." : "Or upload an Excel (.xlsx), CSV, or TXT file"}
                </span>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.txt" style={{ display: "none" }} onChange={(e) => processFileUpload(e.target.files)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                  Brand / Folder Name
                </label>
                <input 
                  type="text" 
                  value={brandName} 
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. MyRestaurant"
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Images per item
                  </label>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff" }}>{count}</span>
                </div>
                <input 
                  type="range" 
                  min={1} 
                  max={20} 
                  value={count} 
                  onChange={(e) => setCount(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#fff", cursor: "pointer" }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                Extraction Engine
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setPlatform("google")}
                  style={{
                    padding: "0.6rem 0.85rem",
                    borderRadius: 8,
                    border: `1px solid #3b82f6`,
                    background: "rgba(59,130,246,0.12)",
                    color: "#60a5fa",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6" }} />
                  High-Resolution Image Extraction Engine
                </button>
              </div>
            </div>

            <button
              onClick={handleStartScraping}
              style={{
                marginTop: "0.25rem",
                width: "100%",
                padding: "0.75rem 1rem",
                background: "#fff",
                color: "#000",
                border: "none",
                borderRadius: 10,
                fontWeight: 800,
                fontSize: "0.95rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                boxShadow: "0 4px 20px rgba(255,255,255,0.12)",
                transition: "all 0.2s",
              }}
            >
              <Camera size={18} />
              Start Extraction Engine
            </button>

          </div>

          {/* Inline Watermark Footer */}
          <div style={{ marginTop: "1.5rem", paddingBottom: "0.5rem", textAlign: "center", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.05em", color: "rgba(255,255,255,0.2)", userSelect: "none" }}>
            Designed &amp; Developed by{" "}
            <span style={{ fontWeight: 800, background: "linear-gradient(to right, #e4e4e7, #fff, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Anish Srivastava
            </span>
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 2. LOADING / LIVE MONITOR VIEW                                   */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {viewState === "loading" && (
        <div style={{ height: "calc(100vh - 4rem)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", background: "var(--bg-primary)" }}>
          
          <div style={{ position: "relative", width: 96, height: 96, marginBottom: "1.5rem" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid var(--border)" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#fff", animation: "spin 0.9s linear infinite" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Image 
                src="/uploads/logo.png" 
                alt="Loading" 
                width={48} 
                height={48} 
                style={{ objectFit: "contain" }} 
                className="brightness-0 dark:invert" 
              />
            </div>
          </div>

          <h2 style={{ fontWeight: 800, fontSize: "1.5rem", color: "#fff" }}>Magic in Progress...</h2>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.35rem", fontSize: "0.9rem" }}>
            Fetching high-resolution food photos for your menu items...
          </p>

          <div style={{ marginTop: "1rem", padding: "0.4rem 1rem", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, fontSize: "0.85rem", fontWeight: 700, color: "#4ade80" }}>
            Elapsed Time: {formatTimer(elapsedSeconds)}
          </div>

          <div style={{ width: "100%", maxWidth: 740, marginTop: "1.5rem", background: "#050505", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ background: "var(--bg-secondary)", padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#eab308" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginLeft: 8, fontFamily: "monospace" }}>scraper_output.log</span>
              </div>
              <button
                onClick={() => { stopTimer(); setViewState("input"); }}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "#fff",
                  borderRadius: 6,
                  padding: "0.2rem 0.6rem",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <RotateCcw size={12} /> ← Back to Input / Options
              </button>
            </div>

            <pre 
              ref={logTerminalRef}
              style={{
                height: 240,
                padding: "1rem",
                overflowY: "auto",
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: "0.8rem",
                color: "#4ade80",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {logs.join("\n")}
            </pre>
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 3. GALLERY / REVIEW VIEW                                         */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {viewState === "gallery" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
          
          <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", padding: "1rem 1.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", position: "sticky", top: 0, zIndex: 20 }}>
            
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <Image 
                src="/uploads/logo.png" 
                alt="Ethers Logo" 
                width={36} 
                height={36} 
                style={{ objectFit: "contain" }} 
                className="brightness-0 dark:invert" 
              />
              <div>
                <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#fff", margin: 0 }}>Review Extracted Images</h2>
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: 0 }}>Uncheck to exclude photos, or edit filenames before packaging</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ padding: "0.4rem 0.85rem", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>
                Selected: <span style={{ color: "#4ade80" }}>{totalSelectedCount}</span> / {totalImagesCount}
              </div>

              <button
                type="button"
                onClick={selectAllImages}
                style={{
                  padding: "0.35rem 0.65rem",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#fff",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Select All
              </button>

              <button
                type="button"
                onClick={deselectAllImages}
                style={{
                  padding: "0.35rem 0.65rem",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.05)",
                  color: "var(--text-secondary)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Deselect All
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <button
                onClick={handleClearBatch}
                style={{
                  padding: "0.55rem 1rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <RotateCcw size={14} /> Clear & Start New Batch
              </button>

              <button
                onClick={handleCreateZip}
                disabled={isZipping || totalSelectedCount === 0}
                style={{
                  padding: "0.55rem 1.25rem",
                  borderRadius: 8,
                  border: "none",
                  background: "#fff",
                  color: "#000",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  cursor: isZipping ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 0 16px rgba(255,255,255,0.1)",
                }}
              >
                <FolderArchive size={16} />
                {isZipping ? "Packaging ZIP..." : "Package to ZIP"}
              </button>
            </div>

          </div>

          <div style={{ flex: 1, padding: "1.75rem", overflowY: "auto" }}>
            {groupedDishes.map((dishGroup, dIdx) => (
              <div key={dIdx} style={{ marginBottom: "2.5rem" }}>
                
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.04em", color: "#fff" }}>
                    {dishGroup.dishName}
                  </h3>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-secondary)" }}>
                    {dishGroup.images.length} photos
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.25rem" }}>
                  {dishGroup.images.map((img, iIdx) => (
                    <div 
                      key={iIdx}
                      style={{
                        background: "var(--bg-secondary)",
                        border: `2px solid ${img.selected ? "#4ade80" : "var(--border)"}`,
                        borderRadius: 14,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        transition: "all 0.15s",
                        opacity: 1,
                        boxShadow: img.selected ? "0 0 12px rgba(74,222,128,0.2)" : "none",
                      }}
                    >
                      <div style={{ position: "relative", height: 160, background: "#000", overflow: "hidden" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={img.url} 
                          alt={img.original_name} 
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />

                        <button
                          onClick={() => toggleImageSelection(dIdx, iIdx)}
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            border: `2px solid ${img.selected ? "#4ade80" : "rgba(255,255,255,0.4)"}`,
                            background: img.selected ? "#4ade80" : "rgba(0,0,0,0.6)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {img.selected && <Check size={16} style={{ color: "#000", strokeWidth: 3 }} />}
                        </button>

                        <button
                          onClick={() => setPreviewImage(img.url)}
                          style={{
                            position: "absolute",
                            bottom: 8,
                            right: 8,
                            padding: "4px",
                            borderRadius: 6,
                            background: "rgba(0,0,0,0.6)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <Maximize2 size={13} />
                        </button>
                      </div>

                      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <input 
                            type="text"
                            value={img.newName || img.original_name}
                            onChange={(e) => updateImageName(dIdx, iIdx, e.target.value)}
                            style={{
                              flex: 1,
                              padding: "0.35rem 0.5rem",
                              background: "var(--bg-input)",
                              border: "1px solid var(--border)",
                              borderRadius: 6,
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              fontFamily: "monospace",
                            }}
                          />
                          <button
                            onClick={() => deleteImageCard(dIdx, iIdx)}
                            title="Remove photo card"
                            style={{
                              padding: "0.35rem",
                              background: "none",
                              border: "none",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              borderRadius: 4,
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 4. COMPLETED / DONE VIEW                                         */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {viewState === "done" && (
        <div style={{ minHeight: "calc(100vh - 4rem)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", background: "var(--bg-primary)", textAlign: "center" }}>
          
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(74,222,128,0.1)", border: "2px solid #4ade80", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
            <Check size={32} style={{ color: "#4ade80", strokeWidth: 3 }} />
          </div>

          <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "#fff" }}>ZIP Download Ready</h2>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem", fontSize: "0.95rem", maxWidth: 460 }}>
            Your custom renamed food photo archive has been packaged successfully.
          </p>

          <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
            <a
              href={downloadZipUrl}
              download
              style={{
                padding: "0.85rem 2rem",
                background: "#fff",
                color: "#000",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: "0.95rem",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                boxShadow: "0 4px 20px rgba(255,255,255,0.15)",
              }}
            >
              <Download size={18} /> Download ZIP Archive
            </a>

            <button
              onClick={() => window.open("https://drive.google.com/drive/my-drive", "_blank")}
              style={{
                padding: "0.85rem 1.5rem",
                background: "var(--bg-secondary)",
                color: "#fff",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <ExternalLink size={16} /> Open Google Drive
            </button>
          </div>

          <button
            onClick={resetPictureAutomation}
            style={{ marginTop: "2.5rem", background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer" }}
          >
            ← Clear & Start New Batch
          </button>
        </div>
      )}

      {/* Lightbox / Zoom Preview Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImage} alt="Full view" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, objectFit: "contain" }} />
            <button 
              onClick={() => setPreviewImage(null)}
              style={{ position: "absolute", top: -16, right: -16, width: 32, height: 32, borderRadius: "50%", background: "#fff", border: "none", color: "#000", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
