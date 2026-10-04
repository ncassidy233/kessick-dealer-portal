import { usePortalProjects } from "@/hooks/use-portal-v2";
import { Loader2, Briefcase, AlertTriangle, FileText, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import demoRoomImg from '@assets/kessick-room-demo.jpg';
import { Button } from "@/components/ui/button";

export default function PortalProjects() {
  const { data: projectsData, isLoading, error } = usePortalProjects();

  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-sidebar-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="border border-destructive/30 bg-destructive/10 p-4 text-destructive flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Unable to load projects</h3>
            <p className="text-sm mt-1">There was a problem retrieving your published design projects.</p>
          </div>
        </div>
      </div>
    );
  }

  const projects = projectsData?.content || [];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full space-y-8">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-light tracking-tight flex items-center gap-3 text-foreground">
          <Briefcase className="w-8 h-8 text-sidebar-primary" />
          Active Projects
        </h1>
        <p className="text-muted-foreground">Manage your published design projects and architectural proposals.</p>
      </div>

      {projects.length === 0 ? (
        <div className="space-y-8">
          <div className="border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            No published projects available at this time.
          </div>
          
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Sample Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "Smith Residence Cellar", desc: "Estate series custom L-shaped configuration with tasting peninsula." },
                { title: "The Onyx Restaurant", desc: "Elevation series metal and glass commercial display." }
              ].map((proj, idx) => (
                <div key={idx} className="group border border-border bg-card p-6 flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-sidebar-primary text-primary-foreground text-[9px] uppercase tracking-widest px-2 py-1 font-semibold">
                    DEMO
                  </div>
                  <div className="w-full h-32 mb-4 bg-muted overflow-hidden relative">
                    <img src={demoRoomImg} alt={proj.title} className="w-full h-full object-cover opacity-80" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-lg text-foreground leading-tight">{proj.title}</h3>
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{proj.desc}</p>
                  </div>
                  <Button variant="outline" className="w-full mt-6 rounded-none border-border">View Proposal</Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <div key={proj.id} className="group border border-border bg-card p-6 hover:border-sidebar-primary/50 transition-colors flex flex-col overflow-hidden relative">
              <div className="w-full h-32 mb-4 bg-muted flex items-center justify-center overflow-hidden relative">
                {proj.payload?.imageUrl ? (
                  <img src={proj.payload.imageUrl} alt={proj.title} className="w-full h-full object-cover" />
                ) : (
                  <FileText className="w-8 h-8 text-muted-foreground/30" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-medium text-lg text-foreground leading-tight">{proj.title}</h3>
                </div>
                {proj.description && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{proj.description}</p>
                )}
                <div className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
                  Updated {formatDistanceToNow(new Date(proj.updatedAt), { addSuffix: true })}
                </div>
              </div>
              <div className="mt-4 pt-2">
                {proj.payload?.url ? (
                  <Button asChild variant="outline" className="w-full rounded-none border-border">
                    <a href={proj.payload.url} target="_blank" rel="noopener noreferrer">
                      Open Project
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" disabled className="w-full rounded-none border-border">
                    No Link Available
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
