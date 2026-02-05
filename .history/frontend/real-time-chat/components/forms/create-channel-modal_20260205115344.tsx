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
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-indigo-500" />
              Créer un channel
            </DialogTitle>
            <DialogDescription>
              Les channels sont des espaces de discussion au sein de votre serveur.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="channel-name">Nom du channel</Label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">#</span>
                <Input
                  id="channel-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="général"
                  disabled={loading}
                  autoFocus
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-zinc-500">
                Utilisez des lettres minuscules et des tirets
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !serverId}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
