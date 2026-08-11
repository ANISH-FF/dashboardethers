"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  quantity_num: string;   
  quantity_unit: string;  
  spice_level: 0 | 1 | 2 | 3;
  variants: string;
  base_price: string;     
  online_price: number;
  half_price: number;
  is_veg: boolean;
  has_half: boolean;
  addons: string;
  custom_columns: Record<string, string>;
}

export interface ScrapedImage {
  original_name: string;
  rel_path: string;
  url: string;
  newName?: string;
  selected?: boolean;
}

export interface GroupedDish {
  dishName: string;
  images: ScrapedImage[];
}

interface AutomationStoreContextType {
  // Menu Automation
  menuHistory: MenuItem[][];
  menuHistoryIndex: number;
  currentMenuItems: MenuItem[];
  onlineHike: number;
  halfPct: number;
  commitMenuItems: (next: MenuItem[]) => void;
  undoMenu: () => void;
  redoMenu: () => void;
  resetMenuAutomation: () => void;
  applyMenuPricingHike: (hike: number, half: number) => void;

  // Picture Automation
  picItemsText: string;
  setPicItemsText: (text: string) => void;
  picBrandName: string;
  setPicBrandName: (brand: string) => void;
  picCount: number;
  setPicCount: (count: number) => void;
  picViewState: "input" | "loading" | "gallery" | "done";
  setPicViewState: (state: "input" | "loading" | "gallery" | "done") => void;
  picGroupedDishes: GroupedDish[];
  setPicGroupedDishes: (dishes: GroupedDish[] | ((prev: GroupedDish[]) => GroupedDish[])) => void;
  picBrandSlug: string;
  setPicBrandSlug: (slug: string) => void;
  picClientId: string;
  setPicClientId: (id: string) => void;
  picDownloadZipUrl: string;
  setPicDownloadZipUrl: (url: string) => void;
  picLogs: string[];
  setPicLogs: (logs: string[] | ((prev: string[]) => string[])) => void;
  resetPictureAutomation: () => void;
  pullFromMenuAutomation: () => Promise<number>;

  // Hygiene Check
  hygieneAuditData: any;
  setHygieneAuditData: (data: any) => void;
  hygieneUrlInput: string;
  setHygieneUrlInput: (url: string) => void;
  hygieneNameInput: string;
  setHygieneNameInput: (name: string) => void;
  hygieneLocationInput: string;
  setHygieneLocationInput: (loc: string) => void;
  resetHygieneCheck: () => void;
}

const AutomationStoreContext = createContext<AutomationStoreContextType | null>(null);

export function AutomationStoreProvider({ children }: { children: ReactNode }) {
  // --- 1. Menu Automation State ---
  const [menuHistory, setMenuHistory] = useState<MenuItem[][]>([[]]);
  const [menuHistoryIndex, setMenuHistoryIndex] = useState(0);
  const [onlineHike, setOnlineHike] = useState(25);
  const [halfPct, setHalfPct] = useState(60);

  // --- 2. Picture Automation State ---
  const [picItemsText, setPicItemsText] = useState("");
  const [picBrandName, setPicBrandName] = useState("brand");
  const [picCount, setPicCount] = useState(5);
  const [picViewState, setPicViewState] = useState<"input" | "loading" | "gallery" | "done">("input");
  const [picGroupedDishes, setPicGroupedDishes] = useState<GroupedDish[]>([]);
  const [picBrandSlug, setPicBrandSlug] = useState("");
  const [picClientId, setPicClientId] = useState("");
  const [picDownloadZipUrl, setPicDownloadZipUrl] = useState("");
  const [picLogs, setPicLogs] = useState<string[]>([]);

  // --- 3. Hygiene Check State ---
  const [hygieneAuditData, setHygieneAuditData] = useState<any>(null);
  const [hygieneUrlInput, setHygieneUrlInput] = useState("");
  const [hygieneNameInput, setHygieneNameInput] = useState("");
  const [hygieneLocationInput, setHygieneLocationInput] = useState("");

  const [isHydrated, setIsHydrated] = useState(false);

  // Load state from localStorage on initial mount
  useEffect(() => {
    try {
      const savedMenuHistory = localStorage.getItem("ethers_menu_history");
      const savedMenuIndex = localStorage.getItem("ethers_menu_history_index");
      const savedHike = localStorage.getItem("ethers_menu_online_hike");
      const savedHalf = localStorage.getItem("ethers_menu_half_pct");

      const savedPicText = localStorage.getItem("ethers_pic_items_text");
      const savedPicBrand = localStorage.getItem("ethers_pic_brand");
      const savedPicCount = localStorage.getItem("ethers_pic_count");
      const savedPicViewState = localStorage.getItem("ethers_pic_view_state");
      const savedPicGroupedDishes = localStorage.getItem("ethers_pic_grouped_dishes");
      const savedPicBrandSlug = localStorage.getItem("ethers_pic_brand_slug");
      const savedPicClientId = localStorage.getItem("ethers_pic_client_id");
      const savedPicZipUrl = localStorage.getItem("ethers_pic_zip_url");
      const savedPicLogs = localStorage.getItem("ethers_pic_logs");

      const savedHygieneData = localStorage.getItem("ethers_hygiene_data");
      const savedHygieneUrl = localStorage.getItem("ethers_hygiene_url");
      const savedHygieneName = localStorage.getItem("ethers_hygiene_name");
      const savedHygieneLoc = localStorage.getItem("ethers_hygiene_loc");

      if (savedMenuHistory) setMenuHistory(JSON.parse(savedMenuHistory));
      if (savedMenuIndex) setMenuHistoryIndex(Number(savedMenuIndex));
      if (savedHike) setOnlineHike(Number(savedHike));
      if (savedHalf) setHalfPct(Number(savedHalf));

      if (savedPicText) setPicItemsText(savedPicText);
      if (savedPicBrand) setPicBrandName(savedPicBrand);
      if (savedPicCount) setPicCount(Number(savedPicCount));
      if (savedPicViewState && ["input", "gallery", "done"].includes(savedPicViewState)) {
        setPicViewState(savedPicViewState as any);
      } else {
        setPicViewState("input");
      }
      if (savedPicGroupedDishes) setPicGroupedDishes(JSON.parse(savedPicGroupedDishes));
      if (savedPicBrandSlug) setPicBrandSlug(savedPicBrandSlug);
      if (savedPicClientId) setPicClientId(savedPicClientId);
      if (savedPicZipUrl) setPicDownloadZipUrl(savedPicZipUrl);
      if (savedPicLogs) setPicLogs(JSON.parse(savedPicLogs));

      if (savedHygieneData) setHygieneAuditData(JSON.parse(savedHygieneData));
      if (savedHygieneUrl) setHygieneUrlInput(savedHygieneUrl);
      if (savedHygieneName) setHygieneNameInput(savedHygieneName);
      if (savedHygieneLoc) setHygieneLocationInput(savedHygieneLoc);
    } catch (e) {
      console.error("Error loading state from localStorage:", e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save Menu State to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem("ethers_menu_history", JSON.stringify(menuHistory));
      localStorage.setItem("ethers_menu_history_index", String(menuHistoryIndex));
      localStorage.setItem("ethers_menu_online_hike", String(onlineHike));
      localStorage.setItem("ethers_menu_half_pct", String(halfPct));
    } catch (e) {}
  }, [menuHistory, menuHistoryIndex, onlineHike, halfPct, isHydrated]);

  // Save Picture Automation State to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem("ethers_pic_items_text", picItemsText);
      localStorage.setItem("ethers_pic_brand", picBrandName);
      localStorage.setItem("ethers_pic_count", String(picCount));
      localStorage.setItem("ethers_pic_view_state", picViewState);
      localStorage.setItem("ethers_pic_grouped_dishes", JSON.stringify(picGroupedDishes));
      localStorage.setItem("ethers_pic_brand_slug", picBrandSlug);
      localStorage.setItem("ethers_pic_client_id", picClientId);
      localStorage.setItem("ethers_pic_zip_url", picDownloadZipUrl);
      localStorage.setItem("ethers_pic_logs", JSON.stringify(picLogs));
    } catch (e) {}
  }, [picItemsText, picBrandName, picCount, picViewState, picGroupedDishes, picBrandSlug, picClientId, picDownloadZipUrl, picLogs, isHydrated]);

  // Save Hygiene Check State to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (hygieneAuditData) {
        localStorage.setItem("ethers_hygiene_data", JSON.stringify(hygieneAuditData));
      } else {
        localStorage.removeItem("ethers_hygiene_data");
      }
      localStorage.setItem("ethers_hygiene_url", hygieneUrlInput);
      localStorage.setItem("ethers_hygiene_name", hygieneNameInput);
      localStorage.setItem("ethers_hygiene_loc", hygieneLocationInput);
    } catch (e) {}
  }, [hygieneAuditData, hygieneUrlInput, hygieneNameInput, hygieneLocationInput, isHydrated]);

  const currentMenuItems = menuHistory[menuHistoryIndex] ?? [];

  const commitMenuItems = useCallback(
    (next: MenuItem[]) => {
      setMenuHistory((h) => {
        const sliced = h.slice(0, menuHistoryIndex + 1);
        return [...sliced, next];
      });
      setMenuHistoryIndex((i) => i + 1);
    },
    [menuHistoryIndex]
  );

  const undoMenu = () => setMenuHistoryIndex((i) => Math.max(0, i - 1));
  const redoMenu = () => setMenuHistoryIndex((i) => Math.min(menuHistory.length - 1, i + 1));

  const resetMenuAutomation = () => {
    setMenuHistory([[]]);
    setMenuHistoryIndex(0);
    try {
      localStorage.removeItem("ethers_menu_history");
      localStorage.removeItem("ethers_menu_history_index");
    } catch (e) {}
  };

  const resetPictureAutomation = () => {
    setPicViewState("input");
    setPicGroupedDishes([]);
    setPicBrandSlug("");
    setPicClientId("");
    setPicDownloadZipUrl("");
    setPicLogs([]);
    try {
      localStorage.removeItem("ethers_pic_view_state");
      localStorage.removeItem("ethers_pic_grouped_dishes");
      localStorage.removeItem("ethers_pic_brand_slug");
      localStorage.removeItem("ethers_pic_client_id");
      localStorage.removeItem("ethers_pic_zip_url");
      localStorage.removeItem("ethers_pic_logs");
    } catch (e) {}
  };

  const applyMenuPricingHike = (hike: number, half: number) => {
    setOnlineHike(hike);
    setHalfPct(half);
    if (currentMenuItems.length > 0) {
      const next = currentMenuItems.map((item) => {
        const base = parseFloat(item.base_price || "0") || 0;
        const online = Math.round(base * (1 + hike / 100));
        const halfPrice = Math.round(online * (half / 100));
        return { ...item, online_price: online, half_price: halfPrice };
      });
      commitMenuItems(next);
    }
  };

  // Pull dish names from Menu Automation into Picture Automation
  const pullFromMenuAutomation = async (): Promise<number> => {
    let dishNames: string[] = [];

    if (currentMenuItems.length > 0) {
      dishNames = currentMenuItems.map((i) => i.name).filter(Boolean);
    } else {
      try {
        const res = await fetch("/api/menu");
        if (res.ok) {
          const data = await res.json();
          if (data.items && Array.isArray(data.items)) {
            dishNames = data.items.map((i: any) => i.name).filter(Boolean);
          }
        }
      } catch (e) {
        console.error("Error fetching menu items from API:", e);
      }
    }

    if (dishNames.length > 0) {
      const existingLines = picItemsText
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

      const combined = Array.from(new Set([...existingLines, ...dishNames])).join("\n");
      setPicItemsText(combined);
      return dishNames.length;
    }

    return 0;
  };

  const resetHygieneCheck = () => {
    setHygieneAuditData(null);
    setHygieneUrlInput("");
    setHygieneNameInput("");
    setHygieneLocationInput("");
    try {
      localStorage.removeItem("ethers_hygiene_data");
      localStorage.removeItem("ethers_hygiene_url");
      localStorage.removeItem("ethers_hygiene_name");
      localStorage.removeItem("ethers_hygiene_loc");
    } catch (e) {}
  };

  return (
    <AutomationStoreContext.Provider
      value={{
        menuHistory,
        menuHistoryIndex,
        currentMenuItems,
        onlineHike,
        halfPct,
        commitMenuItems,
        undoMenu,
        redoMenu,
        resetMenuAutomation,
        applyMenuPricingHike,
        picItemsText,
        setPicItemsText,
        picBrandName,
        setPicBrandName,
        picCount,
        setPicCount,
        picViewState,
        setPicViewState,
        picGroupedDishes,
        setPicGroupedDishes,
        picBrandSlug,
        setPicBrandSlug,
        picClientId,
        setPicClientId,
        picDownloadZipUrl,
        setPicDownloadZipUrl,
        picLogs,
        setPicLogs,
        resetPictureAutomation,
        pullFromMenuAutomation,
        hygieneAuditData,
        setHygieneAuditData,
        hygieneUrlInput,
        setHygieneUrlInput,
        hygieneNameInput,
        setHygieneNameInput,
        hygieneLocationInput,
        setHygieneLocationInput,
        resetHygieneCheck,
      }}
    >
      {children}
    </AutomationStoreContext.Provider>
  );
}

export function useAutomationStore() {
  const context = useContext(AutomationStoreContext);
  if (!context) {
    throw new Error("useAutomationStore must be used within an AutomationStoreProvider");
  }
  return context;
}
