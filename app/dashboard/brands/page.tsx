"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, ChevronRight, Trash2, X, RefreshCw, Store } from "lucide-react";
import { useBrand, Brand } from "@/components/BrandContext";

export default function BrandsDirectory() {
  const { brands, addBrand, deleteBrand } = useBrand();

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandType, setNewBrandType] = useState("Multi Cuisine");
  const [newBrandStatus, setNewBrandStatus] = useState("Active");
  const [isAdding, setIsAdding] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    brand.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleAddBrand(e: React.FormEvent) {
    e.preventDefault();
    if (!newBrandName.trim()) return;

    setIsAdding(true);
    setErrorMsg(null);
    try {
      const created = await addBrand({
        name: newBrandName.trim(),
        type: newBrandType.trim() || "Multi Cuisine",
        status: newBrandStatus,
      });

      if (created) {
        setNewBrandName("");
        setNewBrandType("Multi Cuisine");
        setNewBrandStatus("Active");
        setIsAddModalOpen(false);
      } else {
        setErrorMsg("Failed to add brand. Please try again.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add brand.");
    } finally {
      setIsAdding(false);
    }
  }

  async function confirmDeleteBrand() {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await deleteBrand(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete brand:", err);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Brands Directory</h1>
          <p className="mt-1 text-sm text-ink/50">Manage all your onboarded restaurant partners.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn btn-primary self-start sm:self-auto flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Brand
        </button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="p-4 border-b border-line bg-paper flex items-center justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search brands by name or cuisine..."
              className="w-full bg-paper-dark border border-line rounded-lg pl-9 pr-4 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:border-ink"
            />
          </div>

          <div className="text-xs font-semibold text-ink/50">
            Total Brands: <span className="text-ink font-bold">{brands.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-paper-dark border-b border-line">
              <tr>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-ink/60">Brand Name</th>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-ink/60">Cuisine</th>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-ink/60">Status</th>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-ink/60 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-paper">
              {filteredBrands.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-ink/40 text-sm">
                    No brands found matching "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredBrands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-paper-dark/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-bold text-ink hover:text-emerald-400 transition-colors text-sm">{brand.name}</span>
                    </td>
                    <td className="px-6 py-4 text-ink/60">{brand.type}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                          brand.status === "Active"
                            ? "bg-white text-zinc-900 border-zinc-200"
                            : "bg-zinc-800 text-zinc-300 border-zinc-700"
                        }`}
                      >
                        {brand.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setDeleteTarget(brand)}
                          className="p-1.5 rounded-md text-ink/40 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title={`Delete ${brand.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/dashboard/brands/${brand.id}`}
                          className="p-1.5 rounded-md text-ink/40 hover:text-ink hover:bg-line transition-colors"
                          title="View Details"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Brand Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#111111] border border-[#272727] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative text-[#f5f5f5]">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-[#555555] hover:text-[#f5f5f5] p-1 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Add New Restaurant Brand</h3>
                <p className="text-xs text-[#a3a3a3]">Onboard a new restaurant partner</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddBrand} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#a3a3a3] mb-1.5">
                  Brand Name *
                </label>
                <input
                  type="text"
                  required
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Spice & Coal"
                  className="w-full rounded-lg border border-[#272727] bg-[#161616] px-3.5 py-2.5 text-sm text-[#f5f5f5] outline-none focus:border-emerald-500 transition-all placeholder:text-[#555]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#a3a3a3] mb-1.5">
                  Cuisine Type
                </label>
                <input
                  type="text"
                  value={newBrandType}
                  onChange={(e) => setNewBrandType(e.target.value)}
                  placeholder="e.g. North Indian, Asian, Bakery"
                  className="w-full rounded-lg border border-[#272727] bg-[#161616] px-3.5 py-2.5 text-sm text-[#f5f5f5] outline-none focus:border-emerald-500 transition-all placeholder:text-[#555]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#a3a3a3] mb-1.5">
                  Status
                </label>
                <select
                  value={newBrandStatus}
                  onChange={(e) => setNewBrandStatus(e.target.value)}
                  className="w-full rounded-lg border border-[#272727] bg-[#161616] px-3.5 py-2.5 text-sm text-[#f5f5f5] outline-none focus:border-emerald-500 transition-all"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#181818] hover:bg-[#222222] border border-[#2d2d2d] text-xs font-medium text-[#cccccc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding || !newBrandName.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {isAdding ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Brand</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Brand Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#111111] border border-[#272727] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative text-[#f5f5f5]">
            <button
              onClick={() => setDeleteTarget(null)}
              className="absolute top-4 right-4 text-[#555555] hover:text-[#f5f5f5] p-1 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold">Remove Restaurant Brand?</h3>
                <p className="text-xs text-red-400/90 font-medium mt-0.5">This will update all brand selectors globally</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#161616] border border-[#222222] space-y-1 text-xs">
              <p className="text-[#a3a3a3]">Are you sure you want to remove:</p>
              <p className="text-sm font-bold text-[#f5f5f5]">
                {deleteTarget.name} <span className="text-[#888] font-normal">({deleteTarget.type})</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-[#181818] hover:bg-[#222222] border border-[#2d2d2d] text-xs font-medium text-[#cccccc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteBrand}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Remove Brand</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
