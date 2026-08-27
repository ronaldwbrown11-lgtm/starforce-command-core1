import { Share2, Twitter, Facebook, Link as LinkIcon, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SITE_URL = "https://starforcebase1198.com";

interface ShareButtonsProps {
  title: string;
  path: string;
  description?: string;
}

export function ShareButtons({ title, path }: ShareButtonsProps) {
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
    <div className="flex items-center gap-3" style={{ background: "rgba(10,15,30,0.6)", borderRadius: 10, padding: "10px 14px", border: "1px solid rgba(0,229,255,0.15)" }}>
      <Share2 className="h-7 w-7 text-cyan-400 mr-1 shrink-0" />
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X / Twitter"
        className="inline-flex h-[88px] w-[88px] items-center justify-center rounded-lg text-gray-200 hover:text-white hover:bg-[rgba(0,229,255,0.15)] transition-colors"
      >
        <Twitter className="h-10 w-10" />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook"
        className="inline-flex h-[88px] w-[88px] items-center justify-center rounded-lg text-gray-200 hover:text-white hover:bg-[rgba(0,229,255,0.15)] transition-colors"
      >
        <Facebook className="h-10 w-10" />
      </a>
      <a
        href={`https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Reddit"
        className="inline-flex h-[88px] w-[88px] items-center justify-center rounded-lg text-gray-200 hover:text-white hover:bg-[rgba(0,229,255,0.15)] transition-colors"
      >
        <span className="text-3xl font-bold">R</span>
      </a>
      <button
        type="button"
        onClick={copyLink}
        aria-label={copied ? "Link copied" : "Copy link"}
        className="inline-flex h-[88px] w-[88px] items-center justify-center rounded-lg text-gray-200 hover:text-white hover:bg-[rgba(0,229,255,0.15)] transition-colors"
      >
        {copied ? <Check className="h-10 w-10 text-green-400" /> : <LinkIcon className="h-10 w-10" />}
      </button>
    </div>
  );
}
