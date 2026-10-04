import { usePortalContent } from "@/hooks/use-portal-v2";
import { Loader2, GraduationCap, PlayCircle, BookOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeWebUrl } from "@/lib/content-links";

export default function PortalTraining() {
  const { data: trainingData, isLoading: trainingLoading, error: trainingError } = usePortalContent("training");
  const { data: launchData, isLoading: launchLoading, error: launchError } = usePortalContent("launch_kit");

  if (trainingLoading || launchLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-sidebar-primary" />
      </div>
    );
  }

  const error = trainingError || launchError;
  if (error) {
    return (
      <div className="p-8">
        <div className="border border-destructive/30 bg-destructive/10 p-4 text-destructive flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Unable to load training materials</h3>
            <p className="text-sm mt-1">Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  const training = trainingData?.content || [];
  const launchKits = launchData?.content || [];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full space-y-12">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-light tracking-tight flex items-center gap-3 text-foreground">
          <GraduationCap className="w-8 h-8 text-sidebar-primary" />
          Training & Onboarding
        </h1>
        <p className="text-muted-foreground">Access certification courses, installation guides, and new product launch kits.</p>
      </div>

      <div className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Launch Kits</h2>
        {launchKits.length === 0 ? (
          <div className="border border-border bg-card p-6 text-sm text-muted-foreground">No launch kits are available to your account yet. Check back later or ask your Kessick contact for access.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {launchKits.map(item => (
              <div key={item.id} className="border border-sidebar-primary/30 bg-sidebar-primary/5 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-sidebar-primary" />
                    <span className="text-[10px] uppercase tracking-widest text-sidebar-primary font-semibold">New Release</span>
                  </div>
                  <h3 className="text-xl font-light text-foreground">{item.title}</h3>
                  {item.description && <p className="text-muted-foreground mt-2 text-sm">{item.description}</p>}
                </div>
                <div className="mt-6 pt-2">
                  {safeWebUrl(item.payload?.url) ? (
                    <Button asChild variant="outline" className="w-fit rounded-none border-sidebar-primary/50 text-sidebar-primary">
                      <a href={safeWebUrl(item.payload?.url)!} target="_blank" rel="noopener noreferrer">
                        View Launch Kit
                      </a>
                    </Button>
                  ) : (
                    <Button disabled variant="outline" className="w-fit rounded-none border-border">
                      No valid link available
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Training Modules</h2>
        {training.length === 0 ? (
          <div className="border border-border bg-card p-6 text-sm text-muted-foreground">No training modules are available to your account yet. Check back later or ask your Kessick contact for access.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {training.map(item => {
              const url = safeWebUrl(item.payload?.url);
              const image = safeWebUrl(item.payload?.imageUrl);
              const InnerContent = (
                <>
                  <div className="aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
                    {image ? (
                      <>
                        <img src={image} alt={item.title} className="w-full h-full object-cover opacity-80" />
                        <PlayCircle className="w-12 h-12 text-sidebar-primary absolute z-10 drop-shadow-md" />
                      </>
                    ) : (
                      <PlayCircle className="w-12 h-12 text-muted-foreground/30 group-hover:text-sidebar-primary transition-colors" />
                    )}
                  </div>
                  <div className="p-4">
                    <h4 className="font-medium text-foreground line-clamp-1">{item.title}</h4>
                    {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
                  </div>
                </>
              );

               const className = "border border-border bg-card group hover:border-sidebar-primary/50 transition-colors block";

              if (url) {
                return (
                   <a key={item.id} href={url} target="_blank" rel="noopener noreferrer" className={`${className} cursor-pointer`}>
                    {InnerContent}
                  </a>
                );
              }
              return (
                <div key={item.id} className={className}>
                  {InnerContent}
                   <p className="px-4 pb-4 text-xs text-muted-foreground">No valid link available. Ask your Kessick contact for the module.</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
