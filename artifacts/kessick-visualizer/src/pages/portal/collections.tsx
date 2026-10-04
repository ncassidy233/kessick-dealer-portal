import { usePortalContent } from "@/hooks/use-portal-v2";
import { Loader2, Layers, AlertTriangle, Image as ImageIcon } from "lucide-react";
import demoRoomImg from '@assets/kessick-room-demo.jpg';

export default function PortalCollections() {
  const { data: seriesData, isLoading: seriesLoading, error: seriesError } = usePortalContent("product_series");
  const { data: finishData, isLoading: finishesLoading, error: finishError } = usePortalContent("finish");

  if (seriesLoading || finishesLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-sidebar-primary" />
      </div>
    );
  }

  const error = seriesError || finishError;
  if (error) {
    return (
      <div className="p-8">
        <div className="border border-destructive/30 bg-destructive/10 p-4 text-destructive flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Unable to load collections</h3>
            <p className="text-sm mt-1">Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  const series = seriesData?.content || [];
  const finishes = finishData?.content || [];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full space-y-12">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-light tracking-tight flex items-center gap-3 text-foreground">
          <Layers className="w-8 h-8 text-sidebar-primary" />
          Collections & Finishes
        </h1>
        <p className="text-muted-foreground">Explore Kessick's Estate, Reserve, Elevation, and Parallel series alongside premium finishes.</p>
      </div>

      <div className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Product Series</h2>
        {series.length === 0 ? (
          <div className="space-y-6">
            <div className="border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
              No custom series content published for your account. Displaying Kessick standard gallery.
            </div>
            {/* DEMO SHOWCASE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: "Estate Series", desc: "The standard for professional wine storage. Fully assembled, frameless box construction." },
                { title: "Reserve Series", desc: "Premium bespoke enclosures featuring solid wood fronts and custom millwork." },
                { title: "Elevation Series", desc: "Contemporary metal and glass displays for a minimalist presentation." },
                { title: "Parallel Series", desc: "Floating, wall-mounted display racks maximizing label visibility." },
                { title: "Wine As Art", desc: "Showcase wine as a masterpiece with these illuminated, specialized enclosures." }
              ].map((item, idx) => (
                <div key={idx} className="border border-border bg-card overflow-hidden group">
                  <div className="w-full h-48 bg-muted relative overflow-hidden">
                    <img src={demoRoomImg} alt="Kessick Demo Room" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-[9px] uppercase tracking-widest px-2 py-1 text-foreground font-semibold">DEMO</div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-light text-foreground">{item.title}</h3>
                    <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {series.map(item => (
              <div key={item.id} className="border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow">
                <div className="w-full h-48 bg-muted flex items-center justify-center relative">
                  {item.payload?.imageUrl ? (
                    <img src={item.payload.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-light text-foreground">{item.title}</h3>
                  {item.description && <p className="text-foreground/70 mt-3 text-sm leading-relaxed">{item.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Premium Finishes</h2>
        {finishes.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground italic">No custom finishes published. Displaying standard finishes.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['White Oak', 'Walnut', 'Sapele', 'Alder'].map((finish, idx) => (
                <div key={idx} className="border border-border bg-card p-4">
                  <div className="w-full aspect-square bg-muted mb-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-sidebar-primary/20 mix-blend-multiply" />
                    <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-[9px] uppercase tracking-widest px-2 py-1 text-foreground font-semibold">DEMO</div>
                  </div>
                  <h4 className="font-medium text-sm text-foreground truncate">{finish}</h4>
                  <p className="text-xs text-muted-foreground mt-1 truncate">Standard Finish Option</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {finishes.map(item => (
              <div key={item.id} className="border border-border bg-card p-4">
                <div className="w-full aspect-square bg-muted mb-4 flex items-center justify-center overflow-hidden">
                  {item.payload?.imageUrl ? (
                    <img src={item.payload.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                  )}
                </div>
                <h4 className="font-medium text-sm text-foreground truncate">{item.title}</h4>
                {item.description && <p className="text-xs text-muted-foreground mt-1 truncate">{item.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
