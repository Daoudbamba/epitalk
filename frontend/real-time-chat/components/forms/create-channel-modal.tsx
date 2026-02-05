"use client";

import { useState } from "react";
import { Hash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { channelsApi } from "@/lib/api";

interface CreateChannelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string | null;
  onSuccess: () => Promise<void>;
}

export function CreateChannelModal({ 
  open, 
  onOpenChange, 
  serverId, 
  onSuccess 
}: CreateChannelModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serverId) {
      setError("Aucun serveur sélectionné");
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Le nom du channel est requis");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await channelsApi.create(serverId, trimmed);
      await onSuccess();
      setName("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName("");
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl border-0 overflow-hidden p-0">
        {/* Decorative header bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#023BFC] via-[#3D6AFF] to-[#023BFC]" />
        
        <form onSubmit={handleSubmit} className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-[#1A1A2E]">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] flex items-center justify-center shadow-lg">
                <Hash className="h-5 w-5 text-white" />
              </div>
              Créer un channel
            </DialogTitle>
            <DialogDescription className="text-[#6B7280] mt-2">
              Les channels sont des espaces de discussion au sein de votre serveur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="channel-name" className="text-sm font-medium text-[#1A1A2E]">
                Nom du channel
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-[#023BFC] font-bold text-lg">#</span>
                <Input
                  id="channel-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="général"
                  disabled={loading}
                  autoFocus
                  className="flex-1 h-12 px-4 rounded-xl border-[#E5E7EB] focus:border-[#023BFC] focus:ring-[#023BFC]/20 transition-all duration-200 bg-[#F7F8FA]"
                />
              </div>
              <p className="text-xs text-[#6B7280]">
                Utilisez des lettres minuscules et des tirets
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-red-500 text-xs">!</span>
                </div>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="h-11 px-6 rounded-xl border-[#E5E7EB] hover:bg-[#F7F8FA] transition-all duration-200"
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !name.trim() || !serverId}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#023BFC] to-[#3D6AFF] hover:from-[#0235E0] hover:to-[#3560E8] text-white shadow-lg shadow-[#023BFC]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer le channel"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
