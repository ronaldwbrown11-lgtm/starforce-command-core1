import { useMemo, useState } from "react";
import type { StarData, StarCategory } from "./galaxyData";
import { STAR_CATEGORIES, CATEGORY_LIST } from "./galaxyData";
import { X, Search, Star, FileText, Filter } from "lucide-react";

interface LoreSidebarProps {
  stars: StarData[];
  starNames: Record<string, string>;
  loreNotes: Record<string, string>;
  starCategories: Record<string, StarCategory>;
  onSelectStar: (star: StarData) => void;
  onClose: () => void;
}

export function LoreSidebar({
  stars,
  starNames,
  loreNotes,
  starCategories,
  onSelectStar,
  onClose,
}: LoreSidebarProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<StarCategory | "all">("all");

  const namedStars = useMemo(() => {
    return stars
      .map((star) => {
        const cat = starCategories[star.id] || "none";
        return {
          star,
          displayName: starNames[star.id] || star.defaultName,
          hasLore: !!loreNotes[star.id],
          notes: loreNotes[star.id] || "",
          category: cat,
          categoryCfg: STAR_CATEGORIES[cat],
        };
      })
      .filter((s) => {
        const matchesSearch =
          s.displayName.toLowerCase().includes(search.toLowerCase()) ||
          s.star.id.toLowerCase().includes(search.toLowerCase()) ||
          s.categoryCfg.label.toLowerCase().includes(search.toLowerCase());

        const matchesCategory =
          activeFilter === "all" || s.category === activeFilter;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        // Categorized first, then custom names, then alphabetical
        const aCategorized = a.category !== "none";
        const bCategorized = b.category !== "none";
        if (aCategorized !== bCategorized) return aCategorized ? -1 : 1;

        const aCustom = !!starNames[a.star.id];
        const bCustom = !!starNames[b.star.id];
        if (aCustom !== bCustom) return aCustom ? -1 : 1;

        return a.displayName.localeCompare(b.displayName);
      });
  }, [stars, starNames, loreNotes, starCategories, search, activeFilter]);

  // Count stars per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: stars.length };
    CATEGORY_LIST.forEach((cat) => {
      counts[cat] = 0;
    });
    stars.forEach((star) => {
      const cat = starCategories[star.id] || "none";
      if (counts[cat] !== undefined) counts[cat]++;
    });
    return counts;
  }, [stars, starCategories]);

  return (
    <div className="absolute top-4 right-4 z-20 w-72 max-h-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900/95 via-slate-900/95 to-gray-900/95 backdrop-blur-xl shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">
              Star Lore
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stars..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-white text-xs
              placeholder:text-white/20 focus:outline-none focus:border-yellow-500/30 transition-all"
          />
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveFilter("all")}
            className={`
              flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all
              ${
                activeFilter === "all"
                  ? "bg-white/10 text-white"
                  : "text-white/30 hover:text-white/50 hover:bg-white/5"
              }
            `}
          >
            <Filter className="w-2.5 h-2.5" />
            All
            <span className="text-white/20 ml-0.5">({categoryCounts.all})</span>
          </button>
          {CATEGORY_LIST.map((cat) => {
            const cfg = STAR_CATEGORIES[cat];
            const count = categoryCounts[cat] || 0;
            const isActive = activeFilter === cat;
            return (
              <button
                key={cat}
                onClick={() =>
                  setActiveFilter(isActive ? "all" : cat)
                }
                className={`
                  flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all border
                  ${
                    isActive
                      ? "text-white"
                      : "text-white/30 hover:text-white/50"
                  }
                `}
                style={{
                  backgroundColor: isActive ? `${cfg.color}20` : "transparent",
                  borderColor: isActive ? `${cfg.color}40` : "transparent",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                {cfg.label}
                {count > 0 && (
                  <span className="opacity-50 ml-0.5">({count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Star list */}
      <div className="overflow-y-auto max-h-[calc(100vh-14rem)]">
        {namedStars.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-xs text-white/30">No stars found</p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {namedStars.map(
              ({ star, displayName, hasLore, notes, category, categoryCfg }) => (
                <button
                  key={star.id}
                  onClick={() => onSelectStar(star)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all text-left group"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/10 relative"
                    style={{ background: star.color }}
                  >
                    {/* Category indicator dot */}
                    {category !== "none" && (
                      <span
                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full ring-1 ring-gray-900"
                        style={{ backgroundColor: categoryCfg.color }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
                        {displayName}
                      </p>
                      {category !== "none" && (
                        <span
                          className="text-[9px] font-medium px-1 py-0.5 rounded shrink-0"
                          style={{
                            backgroundColor: `${categoryCfg.color}20`,
                            color: categoryCfg.color,
                          }}
                        >
                          {categoryCfg.icon}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/30 truncate">
                      {hasLore ? (
                        <span className="flex items-center gap-1">
                          <FileText className="w-2.5 h-2.5" />
                          {notes.slice(0, 40)}...
                        </span>
                      ) : (
                        "No lore written yet"
                      )}
                    </p>
                  </div>
                  {hasLore && (
                    <span className="text-[10px] text-yellow-400/60 font-medium shrink-0">
                      Lore
                    </span>
                  )}
                </button>
              ),
            )}
          </div>
        )}

        {/* Footer stats */}
        <div className="px-4 py-2.5 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between text-[10px] text-white/30">
            <span>
              {Object.keys(starNames).length} custom names
            </span>
            <span>
              {Object.keys(loreNotes).length} with lore
            </span>
            <span>{stars.length} total</span>
          </div>
        </div>
      </div>
    </div>
  );
}
