"use client";

import { ImageIcon, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ThumbnailPreviewProps = {
  src?: string;
  title?: string;
};

export function ThumbnailPreview({ src, title }: ThumbnailPreviewProps) {
  if (!src) return <span>-</span>;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto justify-start px-0 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <img
                src={src}
                alt={title || "Video thumbnail"}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="line-clamp-2">
            {title || "Thumbnail Preview"}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <img
            src={src}
            alt={title || "Video thumbnail"}
            className="max-h-[70vh] w-full object-contain"
          />
        </div>

        <Button asChild variant="outline" className="w-fit">
          <a href={src} target="_blank" rel="noreferrer">
            Open image
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}