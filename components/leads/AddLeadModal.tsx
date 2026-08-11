"use client";

import { useState } from "react";
import { LeadItem, FollowUpStatus, LeadStatus } from "@/lib/db";
import { X, Plus, Building2, Phone, User, MapPin, DollarSign } from "lucide-react";

interface AddLeadModalProps {
  onClose: () => void;
  onAddLead: (lead: Partial<LeadItem>) => Promise<void>;
}

export function AddLeadModal({ onClose, onAddLead }: AddLeadModalProps) {
  const [brandName, setBrandName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [poc, setPoc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [comments, setComments] = useState("");
  const [followUp1, setFollowUp1] = useState<FollowUpStatus>("In Talks");
  const [followUp2, setFollowUp2] = useState<FollowUpStatus>("Pending");
  const [followUp3, setFollowUp3] = useState<FollowUpStatus>("Pending");
  const [scheduledMeeting, setScheduledMeeting] = useState("");
  const [status, setStatus] = useState<LeadStatus>("In Talks");
  const [estimatedValue, setEstimatedValue] = useState<number>(50000);
  const [category, setCategory] = useState("QSR & Cloud Kitchen");
  const [location, setLocation] = useState("Mumbai");
  const [assignedTo, setAssignedTo] = useState("Anish M.");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) return;

    setLoading(true);
    try {
      await onAddLead({
        brandName,
        ownerPhone,
        poc,
        date,
        comments,
        followUp1,
        followUp2,
        followUp3,
        scheduledMeeting,
        status,
        estimatedValue,
        category,
        location,
        assignedTo
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card bg-paper border-line w-full max-w-xl max-h-[90vh] flex flex-col p-0 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-line bg-paper-dark flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Add New Lead</h2>
              <p className="text-xs text-ink/50">Enter brand contact details and follow-up track</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg border border-line bg-paper text-ink/50 hover:text-ink hover:bg-paper-dark transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 no-scrollbar text-xs">
          
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Brand / Lead Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Burger Kraft"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Owner Phone No</label>
              <input
                type="text"
                placeholder="e.g. +91 98200 12345"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                className="input font-mono"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Point of Contact (POC)</label>
              <input
                type="text"
                placeholder="e.g. Rajesh Shah (Founder)"
                value={poc}
                onChange={(e) => setPoc(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input font-mono"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Follow up 1</label>
              <select
                value={followUp1}
                onChange={(e) => setFollowUp1(e.target.value as FollowUpStatus)}
                className="input"
              >
                <option value="In Talks">In Talks</option>
                <option value="Not Responded">Not Responded</option>
                <option value="Scheduled a meeting">Scheduled a meeting</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="label">Follow up 2</label>
              <select
                value={followUp2}
                onChange={(e) => setFollowUp2(e.target.value as FollowUpStatus)}
                className="input"
              >
                <option value="In Talks">In Talks</option>
                <option value="Not Responded">Not Responded</option>
                <option value="Scheduled a meeting">Scheduled a meeting</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="label">Follow up 3</label>
              <select
                value={followUp3}
                onChange={(e) => setFollowUp3(e.target.value as FollowUpStatus)}
                className="input"
              >
                <option value="In Talks">In Talks</option>
                <option value="Not Responded">Not Responded</option>
                <option value="Scheduled a meeting">Scheduled a meeting</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Scheduled Meeting Date & Time</label>
              <input
                type="datetime-local"
                value={scheduledMeeting ? scheduledMeeting.replace(" ", "T") : ""}
                onChange={(e) => setScheduledMeeting(e.target.value.replace("T", " "))}
                className="input font-mono"
              />
            </div>

            <div>
              <label className="label">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="input font-bold"
              >
                <option value="In Talks">In Talks</option>
                <option value="Converted">Converted</option>
                <option value="Not Converted">Not Converted</option>
                <option value="Not Responding">Not Responding</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Category</label>
              <input
                type="text"
                placeholder="e.g. Fine Dining"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Location / City</label>
              <input
                type="text"
                placeholder="e.g. Mumbai, Bandra"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Est. Value (₹)</label>
              <input
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(Number(e.target.value))}
                className="input font-mono"
              />
            </div>
          </div>

          <div>
            <label className="label">Comments & Remarks</label>
            <textarea
              rows={3}
              placeholder="Initial discussion notes..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="input font-mono"
            />
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "Creating..." : "Create Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
