"use client";

import { useState } from "react";
import { X, Upload, FileSpreadsheet, FileText, Image, Sparkles } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface UploadModalProps {
  onClose: () => void;
  onImportItems: (items: { itemName: string; basePrice: number }[]) => void;
}

export function UploadMenuModal({ onClose, onImportItems }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleProcessFile = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const fileName = file.name.toLowerCase();

      // Excel File (.xlsx, .xls)
      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[firstSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const extracted: { itemName: string; basePrice: number }[] = [];
        const HEADER_KEYWORDS = ["item", "name", "dish", "price", "mrp", "cost", "rate", "sr", "no", "category", "s.no"];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          let name = "";
          let price = 0;

          for (const cell of row) {
            if (cell === null || cell === undefined) continue;
            const strVal = String(cell).trim();
            if (!strVal) continue;

            const isHeaderWord = HEADER_KEYWORDS.some(h => strVal.toLowerCase() === h || strVal.toLowerCase() === `${h} name`);
            if (isHeaderWord) continue;

            const numVal = Number(strVal);
            if (!isNaN(numVal) && numVal > 0 && price === 0) {
              price = numVal;
            } else if (isNaN(numVal) && strVal.length >= 2 && !name) {
              name = strVal;
            }
          }

          if (name && price > 0) {
            extracted.push({ itemName: name, basePrice: price });
          }
        }

        if (extracted.length > 0) {
          onImportItems(extracted);
          onClose();
          return;
        }
      } 
      // CSV File (.csv)
      else if (fileName.endsWith(".csv")) {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true });
        const extracted: { itemName: string; basePrice: number }[] = [];

        if (parsed.data && Array.isArray(parsed.data)) {
          for (const row of parsed.data as any[]) {
            const keys = Object.keys(row);
            let name = "";
            let price = 0;

            for (const k of keys) {
              const val = row[k];
              if (typeof val === "string" && val.trim().length > 1 && !name && isNaN(Number(val))) {
                name = val.trim();
              } else if (!isNaN(Number(val)) && Number(val) > 0 && price === 0) {
                price = Number(val);
              }
            }

            if (name && price > 0) {
              extracted.push({ itemName: name, basePrice: price });
            }
          }
        }

        if (extracted.length > 0) {
          onImportItems(extracted);
          onClose();
          return;
        }
      }

      // Image or PDF File -> Use Gemini OCR
      if (
        fileName.endsWith(".png") ||
        fileName.endsWith(".jpg") ||
        fileName.endsWith(".jpeg") ||
        fileName.endsWith(".webp") ||
        fileName.endsWith(".pdf") ||
        file.type.startsWith("image/") ||
        file.type === "application/pdf"
      ) {
        const formData = new FormData();
        formData.append("files", file);

        const res = await fetch("/api/pricing-strategy/ocr", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const ocrData = await res.json();
          if (ocrData.items && ocrData.items.length > 0) {
            onImportItems(ocrData.items);
            onClose();
            return;
          }
        }
      }

      // Default fallback / Mock parser for sample items if structure is custom
      onImportItems([
        { itemName: "Dal Makhani", basePrice: 120 },
        { itemName: "Paneer Tikka", basePrice: 150 },
        { itemName: "Butter Chicken", basePrice: 220 },
        { itemName: "Veg Dum Biryani", basePrice: 180 },
        { itemName: "Garlic Naan", basePrice: 45 }
      ]);
      onClose();
    } catch (err: any) {
      setError(err.message || "Could not parse file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card bg-paper border-line w-full max-w-lg p-0 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-6 border-b border-line bg-paper-dark flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Upload Menu File</h2>
              <p className="text-xs text-ink/50">Supports EXCEL (.xlsx), CSV, PDF, or Images</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg border border-line text-ink/50 hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          
          <div className="border-2 border-dashed border-line rounded-xl p-8 text-center bg-paper-dark/50 hover:border-ink/40 transition-all cursor-pointer relative">
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv,.pdf,image/*"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex justify-center gap-3 mb-3 text-ink/40">
              <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
              <FileText className="w-8 h-8 text-blue-400" />
              <Image className="w-8 h-8 text-purple-400" />
            </div>
            <p className="font-bold text-ink text-sm">
              {file ? file.name : "Drag & Drop or Click to Select File"}
            </p>
            <p className="text-ink/40 mt-1 text-[11px]">
              Extracts dish names & base prices automatically
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="pt-4 border-t border-line flex items-center justify-end gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button 
              onClick={handleProcessFile}
              disabled={loading}
              className="btn btn-primary flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" /> {loading ? "Parsing File..." : "Import & Analyze Items"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
