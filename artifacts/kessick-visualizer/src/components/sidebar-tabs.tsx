import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarCatalog } from "./sidebar-catalog";
import { SurveyTab } from "./survey-tab";
import { ProjectTab } from "./project-tab";
import { PipelineTab } from "./pipeline-tab";
import { DesignTab } from "./design-tab";
import { EstimatingTab } from "./estimating-tab";
import { Ruler, Package, FileText, Palette, Calculator, GitMerge } from "lucide-react";
import { useAppStore } from "@/store";
import { useEffect, useState } from "react";

export function SidebarTabs() {
  const [tab, setTab] = useState("survey");
  const { entities, instances } = useAppStore();

  return (
    <div className="w-full h-[42%] border-b border-border bg-sidebar flex flex-col shrink-0 z-10 shadow-xl lg:w-[340px] lg:h-full lg:border-b-0 lg:border-r">
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col h-full w-full">
        <div className="px-3 pt-3 shrink-0 lg:px-4 lg:pt-4">
          <TabsList className="grid w-full grid-cols-6 bg-background border border-border h-10 p-1">
            <TabsTrigger value="survey" className="text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5" title="Survey">
              <Ruler className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Survey</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5" title="Products">
              <Package className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add</span>
            </TabsTrigger>
            <TabsTrigger value="design" className="text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5" title="Design">
              <Palette className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Design</span>
            </TabsTrigger>
            <TabsTrigger value="estimating" className="text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5" title="Estimate">
              <Calculator className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Quote</span>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5" title="Pipeline">
              <GitMerge className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pipe</span>
            </TabsTrigger>
            <TabsTrigger value="project" className="text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5" title="Project">
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">File</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="survey" className="h-full m-0 border-none outline-none">
            <SurveyTab />
          </TabsContent>
          <TabsContent value="products" className="h-full m-0 border-none outline-none">
            <SidebarCatalog />
          </TabsContent>
          <TabsContent value="design" className="h-full m-0 border-none outline-none">
            <DesignTab />
          </TabsContent>
          <TabsContent value="estimating" className="h-full m-0 border-none outline-none">
            <EstimatingTab />
          </TabsContent>
          <TabsContent value="pipeline" className="h-full m-0 border-none outline-none">
            <PipelineTab />
          </TabsContent>
          <TabsContent value="project" className="h-full m-0 border-none outline-none overflow-y-auto">
            <ProjectTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
