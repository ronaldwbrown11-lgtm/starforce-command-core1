import { Share2, Twitter, Facebook, Link as LinkIcon, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SITE_URL = "https://starforcebase1198.com";

interface ShareButtonsProps {
  title: string;
  path: string;
  description?: string;
}

export function ShareButtons({ title, path, description }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}${path}`;
  const text = `${title} — Star Force Base 1198`;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-[0.12em] text-gray-300 mr-1 hidden sm:inline">
        <Share2 className="h-3.5 w-3.5 inline mr-1" />
        Share
      </span>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X / Twitter"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-cyan-800/40 text-gray-300 hover:text-white hover:bg-[rgba(0,229,255,0.12)] transition-colors"
      >
        <Twitter className="h-4 w-4" />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-cyan-800/40 text-gray-300 hover:text-white hover:bg-[rgba(0,229,255,0.12)] transition-colors"
      >
        <Facebook className="h-4 w-4" />
      </a>
      <a
        href={`https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Reddit"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-cyan-800/40 text-gray-300 hover:text-white hover:bg-[rgba(0,229,255,0.12)] transition-colors"
      >
        <span className="text-xs font-bold">R</span>
      </a>
      <button
        type="button"
        onClick={copyLink}
        aria-label={copied ? "Link copied" : "Copy link"}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-cyan-800/40 text-gray-300 hover:text-white hover:bg-[rgba(0,229,255,0.12)] transition-colors"
      >
        {copied ? <Check className="h-4 w-4 text-uf-green" /> : <LinkIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}
