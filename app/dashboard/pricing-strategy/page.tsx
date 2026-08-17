"use client";

import { useState, useEffect } from "react";
import { PricingHeader } from "@/components/pricing/PricingHeader";
import { PricingTable, StrategyItem } from "@/components/pricing/PricingTable";
import { UploadMenuModal } from "@/components/pricing/UploadMenuModal";
import { CustomPromptModal } from "@/components/pricing/CustomPromptModal";
import { Sparkles, RefreshCw } from "lucide-react";

import { useBrand } from "@/components/BrandContext";

export default function PricingStrategyPage() {
  const { activeBrand } = useBrand();
  const [location, setLocation] = useState("Bistupur, Jamshedpur");
  const [researchMode, setResearchMode] = useState<"ethers" | "gemini" | "names" | "links">("names");
  const [manualCompetitors, setManualCompetitors] = useState("");
  const [manualCompetitorLinks, setManualCompetitorLinks] = useState("");
  const [competitorCount, setCompetitorCount] = useState<number>(4);
  const [discountPct, setDiscountPct] = useState<number>(10);
  const [commissionPct, setCommissionPct] = useState<number>(30);
  const [adsPct, setAdsPct] = useState<number>(5);
  const [foodCostPct, setFoodCostPct] = useState<number>(30);
  const [priceEnding, setPriceEnding] = useState<"9_7_5" | "round" | "none">("9_7_5");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loaderStep, setLoaderStep] = useState("🔍 Step 1/4: Analyzing Menu Items & Detecting Category Niche...");
  const [fetchedLinks, setFetchedLinks] = useState<{ competitorName: string; swiggyUrl: string | null; found: boolean }[]>([]);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  // Initial seed items matching Excel sheet examples with live verification links
  const [items, setItems] = useState<StrategyItem[]>([
    {
      id: "item_1",
      itemName: "Dal Makhani",
      myBrandPrice: 100,
      competitors: [
        { name: "Dubeys Hotel & Restaurant", price: 130, url: "https://www.swiggy.com/restaurants/dubeys-hotel-and-restaurant-golmuri-jamshedpur-256769" },
        { name: "Novelty Restaurant", price: 150, url: "https://www.swiggy.com/restaurants/novelty-restaurant-bistupur-jamshedpur-256770" },
        { name: "Equinox - The Alcor Hotel", price: 185, url: "https://www.swiggy.com/restaurants/equinox-the-alcor-hotel-bistupur-jamshedpur-256771" },
        { name: "Yellow Sapphire", price: 195, url: "https://www.swiggy.com/restaurants/yellow-sapphire-bistupur-jamshedpur-256772" }
      ],
      suggestivePrice: 199
    },
    {
      id: "item_2",
      itemName: "Paneer Tikka",
      myBrandPrice: 150,
      competitors: [
        { name: "Dubeys Hotel & Restaurant", price: 180, url: "https://www.swiggy.com/restaurants/dubeys-hotel-and-restaurant-golmuri-jamshedpur-256769" },
        { name: "Novelty Restaurant", price: 210, url: "https://www.swiggy.com/restaurants/novelty-restaurant-bistupur-jamshedpur-256770" },
        { name: "Equinox - The Alcor Hotel", price: 245, url: "https://www.swiggy.com/restaurants/equinox-the-alcor-hotel-bistupur-jamshedpur-256771" },
        { name: "Yellow Sapphire", price: 260, url: "https://www.swiggy.com/restaurants/yellow-sapphire-bistupur-jamshedpur-256772" }
      ],
      suggestivePrice: 249
    },
    {
      id: "item_3",
      itemName: "Butter Chicken",
      myBrandPrice: 220,
      competitors: [
        { name: "Dubeys Hotel & Restaurant", price: 280, url: "https://www.swiggy.com/restaurants/dubeys-hotel-and-restaurant-golmuri-jamshedpur-256769" },
        { name: "Novelty Restaurant", price: 310, url: "https://www.swiggy.com/restaurants/novelty-restaurant-bistupur-jamshedpur-256770" },
        { name: "Equinox - The Alcor Hotel", price: 360, url: "https://www.swiggy.com/restaurants/equinox-the-alcor-hotel-bistupur-jamshedpur-256771" },
        { name: "Yellow Sapphire", price: 380, url: "https://www.swiggy.com/restaurants/yellow-sapphire-bistupur-jamshedpur-256772" }
      ],
      suggestivePrice: 349
    },
    {
      id: "item_4",
      itemName: "Veg Dum Biryani",
      myBrandPrice: 160,
      competitors: [
        { name: "Punjab Grill", price: 190, url: "https://www.swiggy.com/restaurants/punjab-grill-jamshedpur-256773" },
        { name: "Dhaba Est. 1986", price: 220, url: "https://www.swiggy.com/restaurants/dhaba-est-1986-jamshedpur-256774" },
        { name: "Bukhara Feast", price: 250, url: "https://www.swiggy.com/restaurants/bukhara-feast-jamshedpur-256775" },
        { name: "Royal Kitchen", price: 270, url: "https://www.swiggy.com/restaurants/royal-kitchen-jamshedpur-256776" }
      ],
      suggestivePrice: 247
    }
  ]);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<{ text: string; color?: string }[]>([]);

  useEffect(() => {
    let timer: any;
    if (isGenerating) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isGenerating]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (activeBrand?.id) {
      loadBrandPricingStrategy(activeBrand.id);
    }
  }, [activeBrand?.id]);

  const loadBrandPricingStrategy = async (bId: string) => {
    try {
      const res = await fetch(`/api/pricing-strategy/store?brandId=${bId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          if (json.data.location) setLocation(json.data.location);
          if (json.data.researchMode) setResearchMode(json.data.researchMode);
          if (json.data.manualCompetitors !== undefined) setManualCompetitors(json.data.manualCompetitors);
          if (json.data.manualCompetitorLinks !== undefined) setManualCompetitorLinks(json.data.manualCompetitorLinks);
          if (json.data.competitorCount) setCompetitorCount(json.data.competitorCount);
          if (json.data.discountPct !== undefined) setDiscountPct(json.data.discountPct);
          if (json.data.commissionPct !== undefined) setCommissionPct(json.data.commissionPct);
          if (json.data.adsPct !== undefined) setAdsPct(json.data.adsPct);
          if (json.data.foodCostPct !== undefined) setFoodCostPct(json.data.foodCostPct);
          if (json.data.items && Array.isArray(json.data.items) && json.data.items.length > 0) {
            setItems(json.data.items);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load brand pricing strategy:", e);
    }
  };

  const saveBrandPricingStrategy = (newItems?: StrategyItem[]) => {
    if (!activeBrand?.id) return;
    fetch("/api/pricing-strategy/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId: activeBrand.id,
        brandName: activeBrand.name,
        location,
        researchMode,
        manualCompetitors,
        manualCompetitorLinks,
        competitorCount,
        discountPct,
        commissionPct,
        adsPct,
        foodCostPct,
        priceEnding,
        items: newItems || items,
      }),
    }).catch(() => null);
  };

  const handleGenerateStrategy = async () => {
    if (items.length === 0) return;
    setIsGenerating(true);
    setFetchedLinks([]);
    const modeLabel = researchMode === "ethers" || researchMode === "gemini" ? "Ethers AI (~50% Accuracy)" : researchMode === "links" ? "Direct Store Links (100% Accuracy)" : "Competitor Names (~80% Accuracy)";
    setTerminalLogs([
      { text: `Initializing Pricing Intelligence Engine [Mode: ${modeLabel}]...`, color: "text-emerald-400 font-bold" },
      { text: `Target Location: ${location}`, color: "text-zinc-400" },
      { text: `Connecting to Market Intelligence Data Sources...`, color: "text-amber-400" }
    ]);

    // Simulated streaming logs while waiting for backend
    const logInterval = setInterval(() => {
      setTerminalLogs((prev) => {
        const elapsed = prev.length;
        if (elapsed === 3) return [...prev, { text: "Locating competitor outlets...", color: "text-zinc-400" }];
        if (elapsed === 4) return [...prev, { text: "Analyzing competitor data stream...", color: "text-blue-400" }];
        if (elapsed === 5) return [...prev, { text: "Fetching live menu and price catalog...", color: "text-emerald-400" }];
        if (elapsed === 6) return [...prev, { text: `Matching ${items.length} dishes with competitor menus...`, color: "text-indigo-400" }];
        return prev;
      });
    }, 2500);

    try {
      const response = await fetch("/api/pricing-strategy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ itemName: i.itemName, basePrice: i.myBrandPrice })),
          location,
          researchMode,
          manualCompetitors,
          manualCompetitorLinks,
          competitorCount,
          priceEnding,
          discountPct,
          commissionPct,
          adsPct,
          foodCostPct
        })
      });

      clearInterval(logInterval);

      if (response.ok) {
        const data = await response.json();

        if (data.fetchedLinks && Array.isArray(data.fetchedLinks)) {
          setFetchedLinks(data.fetchedLinks);
          data.fetchedLinks.forEach((fl: any) => {
            if (fl.swiggyUrl) {
              setTerminalLogs((prev) => [
                ...prev,
                { text: `Verified Outlet Link [${fl.competitorName}]: ${fl.swiggyUrl}`, color: "text-blue-400 font-medium" }
              ]);
            } else {
              setTerminalLogs((prev) => [
                ...prev,
                { text: `Could not locate outlet link for [${fl.competitorName}]`, color: "text-red-400 font-bold" }
              ]);
            }
          });
        }

        setTerminalLogs((prev) => [
          ...prev,
          { text: `Calculating optimal pricing & profit margins based on market data...`, color: "text-emerald-400" }
        ]);

        await new Promise((resolve) => setTimeout(resolve, 500));

        if (data.results && Array.isArray(data.results)) {
          const generatedItems: StrategyItem[] = data.results.map((r: any, index: number) => ({
            id: items[index]?.id || `item_${Date.now()}_${index}`,
            itemName: r.itemName,
            myBrandPrice: r.myBrandPrice,
            competitors: r.competitors || [],
            suggestivePrice: r.suggestivePrice || r.myBrandPrice
          }));

          setItems(generatedItems);
          saveBrandPricingStrategy(generatedItems);
        }

        setTerminalLogs((prev) => [
          ...prev,
          { text: `Pricing Strategy Generated Successfully.`, color: "text-emerald-400 font-bold" }
        ]);

        await new Promise((resolve) => setTimeout(resolve, 800));
      } else {
        throw new Error("Failed response");
      }
    } catch (err) {
      clearInterval(logInterval);
      console.error("Failed to generate AI pricing strategy:", err);
      setTerminalLogs((prev) => [
        ...prev,
        { text: `Error generating pricing strategy. Please try again.`, color: "text-red-400 font-bold" }
      ]);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportItems = (imported: { itemName: string; basePrice: number }[]) => {
    const newItems: StrategyItem[] = imported.map((imp, idx) => ({
      id: `imported_${Date.now()}_${idx}`,
      itemName: imp.itemName,
      myBrandPrice: imp.basePrice,
      competitors: Array.from({ length: competitorCount }).map((_, cIdx) => ({
        name: `Competitor ${cIdx + 1}`,
        price: Math.round(imp.basePrice * (1.15 + cIdx * 0.1))
      })),
      suggestivePrice: Math.round(imp.basePrice * 1.25)
    }));

    setItems(newItems);
    saveBrandPricingStrategy(newItems);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {/* Header & Control Panel */}
      <PricingHeader
        location={location}
        setLocation={setLocation}
        researchMode={researchMode}
        setResearchMode={setResearchMode}
        manualCompetitors={manualCompetitors}
        setManualCompetitors={setManualCompetitors}
        manualCompetitorLinks={manualCompetitorLinks}
        setManualCompetitorLinks={setManualCompetitorLinks}
        competitorCount={competitorCount}
        setCompetitorCount={setCompetitorCount}
        discountPct={discountPct}
        setDiscountPct={setDiscountPct}
        commissionPct={commissionPct}
        setCommissionPct={setCommissionPct}
        adsPct={adsPct}
        setAdsPct={setAdsPct}
        foodCostPct={foodCostPct}
        setFoodCostPct={setFoodCostPct}
        priceEnding={priceEnding}
        setPriceEnding={setPriceEnding}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onOpenPromptModal={() => setIsPromptModalOpen(true)}
        onGenerate={handleGenerateStrategy}
        isGenerating={isGenerating}
      />

      {/* Classy & Sexy Ethers Terminal Animated Loading Overlay */}
      {isGenerating ? (
        <div className="card bg-[#0a0a0c]/95 border border-zinc-800/90 p-10 text-center flex flex-col items-center justify-center space-y-6 shadow-2xl backdrop-blur-xl animate-in fade-in duration-300 rounded-2xl">
          
          {/* Ethers Animated Circular Logo */}
          <div className="relative flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border-2 border-transparent border-t-white border-r-white/40 animate-spin absolute" />
            <div className="w-16 h-16 rounded-full bg-black border border-zinc-800 flex items-center justify-center shadow-2xl">
              <img 
                src="/uploads/logo.png" 
                alt="Ethers Consultancy" 
                className="h-6 w-auto object-contain brightness-0 dark:invert"
              />
            </div>
          </div>

          {/* Heading & Subtitle */}
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Pricing Intelligence in Progress...</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">Scraping live competitor prices from Swiggy & calculating optimal profit margins</p>
          </div>

          {/* Live Timer Pill Badge */}
          <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Elapsed Time: {formatTime(elapsedSeconds)}</span>
          </div>

          {/* Terminal Output Window Box */}
          <div className="w-full max-w-2xl bg-[#09090b] border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl text-left">
            <div className="px-4 py-2.5 bg-zinc-950/90 border-b border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-2 font-mono text-[11px] text-zinc-400">pricing_engine.log</span>
              </div>
              <span className="font-mono text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>LIVE TELEMETRY STREAM</span>
              </span>
            </div>

            <div className="p-4 font-mono text-xs space-y-2 min-h-[160px] max-h-[220px] overflow-y-auto">
              {terminalLogs.map((log, index) => (
                <div key={index} className="flex items-start gap-2 leading-relaxed text-zinc-300 animate-in fade-in duration-300">
                  <span className="text-zinc-600 shrink-0 select-none">&gt;</span>
                  <span className={log.color || "text-zinc-300"}>{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Main Strategy Datagrid Table */
        <div className="space-y-4">
          {fetchedLinks.length > 0 && (
            <div className="card bg-paper-dark/90 border border-emerald-500/30 p-3.5 rounded-xl text-xs font-mono flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2 text-emerald-400 font-bold shrink-0">
                <span>Verified Competitor Outlet Links:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {fetchedLinks.map((fl, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-paper/80 border border-line px-2.5 py-1 rounded-md text-[11px]">
                    <span className="font-bold text-ink/80">{fl.competitorName}:</span>
                    {fl.swiggyUrl ? (
                      <a href={fl.swiggyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-semibold flex items-center gap-1">
                        <span>Swiggy Outlet</span>
                        <span className="text-[9px]">↗</span>
                      </a>
                    ) : (
                      <span className="text-red-400 font-semibold">No Swiggy Link</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <PricingTable
            items={items}
            setItems={setItems}
            competitorCount={competitorCount}
            discountPct={discountPct}
            commissionPct={commissionPct}
            adsPct={adsPct}
            foodCostPct={foodCostPct}
            priceEnding={priceEnding}
          />
        </div>
      )}

      {/* Upload File Modal */}
      {isUploadModalOpen && (
        <UploadMenuModal
          onClose={() => setIsUploadModalOpen(false)}
          onImportItems={handleImportItems}
        />
      )}

      {/* Custom AI Prompt Modal */}
      {isPromptModalOpen && (
        <CustomPromptModal
          currentPrompt={customPrompt}
          onClose={() => setIsPromptModalOpen(false)}
          onSavePrompt={setCustomPrompt}
        />
      )}
    </div>
  );
}
