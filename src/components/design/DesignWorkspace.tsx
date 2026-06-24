"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import Link from "next/link";
import { saveDesignDocument } from "@/lib/actions/design";
import { useDesignStore } from "@/lib/stores/design-store";
import { DesignToolbar } from "./DesignToolbar";
import { InspectorPanel } from "./InspectorPanel";
import { ValidationDrawer } from "./ValidationDrawer";
import { VersionSelector } from "./VersionSelector";
import { ExportToCrmDialog } from "./ExportToCrmDialog";
import { MaterialsPanel } from "./MaterialsPanel";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { placeHeads, pointInPolygon } from "@/lib/domain/placement";
import { resolveHeadAssembly } from "@/lib/catalog/compat";
import { validateDesign } from "@/lib/domain/validation";
import { buildMaterialList, calculateQuoteTotals } from "@/lib/domain/materials";
import { generateId, distanceBetweenPoints, POLYGON_CLOSE_RADIUS } from "@/lib/utils";
import type { CatalogItemData, DesignDocument, Point, PricingProfileData } from "@/lib/domain/types";
import { DEFAULT_PRESSURE_PSI, DEFAULT_WATER_SOURCE } from "@/lib/domain/types";
import type { DesignVersion, Project } from "@prisma/client";
import { DesignTour, TourHelpButton } from "./tour/DesignTour";
import type { TourStatus } from "@/lib/actions/tour";
import { Button } from "@/components/ui/button";
import { blobProxyUrl } from "@/lib/blob/urls";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { refineDesignHeadsWithMl } from "@/lib/actions/placement-ml";
import type { PlacementMlStatus } from "@/lib/actions/placement-ml";
import { DesignHeadEditorPanel } from "./DesignHeadEditorPanel";
import { useDesignHeadKeyboard } from "@/lib/hooks/use-design-head-keyboard";
import { ClipboardList, Package, Settings2, Pencil } from "lucide-react";

const DesignCanvas = dynamic(() => import("./DesignCanvas").then((m) => m.DesignCanvas), {
  ssr: false,
});

type Props = {
  project: Project;
  version: DesignVersion;
  versions: DesignVersion[];
  catalog: CatalogItemData[];
  pricing: PricingProfileData;
  imageUrl?: string;
  tourStatus: TourStatus;
  mlStatus: PlacementMlStatus;
};

export function DesignWorkspace({
  project,
  version,
  versions,
  catalog,
  pricing,
  imageUrl,
  tourStatus,
  mlStatus,
}: Props) {
  const isMobile = useIsMobile();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [headEditorOpen, setHeadEditorOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [mlRefinementEnabled, setMlRefinementEnabled] = useState(
    mlStatus.enabled && mlStatus.serviceHealthy && mlStatus.modelLoaded
  );
  const [autoPlacing, setAutoPlacing] = useState(false);
  const store = useDesignStore();
  const {
    init,
    document,
    setDocument,
    activeTool,
    pendingSiteFeatureType,
    pendingExclusionType,
    equipmentPlacementType,
    drawingVertices,
    addDrawingVertex,
    clearDrawing,
    scalePointA,
    scalePointB,
    setScalePointA,
    setScalePointB,
    isDirty,
    setValidationIssues,
    markSaved,
    setSaving,
    projectId,
    versionId,
    setSelected,
    setLastCanvasClick,
  } = store;

  useDesignHeadKeyboard({ catalog });

  useEffect(() => {
    init(project.id, version.id, version.kind, version.designData as DesignDocument);
  }, [project.id, version.id, version.kind, version.designData, init]);

  useEffect(() => {
    if (!isDirty || !projectId || !versionId) return;
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await saveDesignDocument(projectId, versionId, document);
        markSaved();
      } catch {
        toast.error("Failed to save design");
        setSaving(false);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [document, isDirty, projectId, versionId, markSaved, setSaving]);

  const quoteTier = document.metadata?.quoteTier ?? "STANDARD";

  const materials = useMemo(
    () => buildMaterialList(document, catalog, pricing, quoteTier),
    [document, catalog, pricing, quoteTier]
  );
  const materialTotals = useMemo(
    () => calculateQuoteTotals(document, materials, pricing),
    [document, materials, pricing]
  );

  const setQuoteTier = useCallback(
    (tier: "STANDARD" | "PREMIUM") => {
      setDocument({
        ...document,
        metadata: { ...document.metadata, quoteTier: tier },
      });
    },
    [document, setDocument]
  );

  const displayImageUrl = useMemo(() => {
    const path = document.propertyImage?.blobPath;
    if (path) return blobProxyUrl(path);
    return imageUrl;
  }, [document.propertyImage?.blobPath, imageUrl]);

  const finishPolygon = useCallback(() => {
    if (drawingVertices.length < 3) {
      toast.error("Need at least 3 points");
      return;
    }

    if (activeTool === "hydrozone") {
      let zoneId = document.zones[0]?.id;
      if (!zoneId) {
        zoneId = generateId("zone");
        const zone = { id: zoneId, name: "Zone 1", hydrozoneIds: [] };
        const hydrozone = {
          id: generateId("hz"),
          name: `Hydrozone ${document.hydrozones.length + 1}`,
          vertices: drawingVertices,
          zoneId,
          hydrozoneType: "TURF" as const,
          sunExposure: "FULL_SUN" as const,
          slopePercent: 0,
          soilType: "LOAM" as const,
          waterPriority: 3,
          headPreference: "SPRAY" as const,
        };
        setDocument({
          ...document,
          zones: [...document.zones, { ...zone, hydrozoneIds: [hydrozone.id] }],
          hydrozones: [...document.hydrozones, hydrozone],
        });
      } else {
        const hydrozone = {
          id: generateId("hz"),
          name: `Hydrozone ${document.hydrozones.length + 1}`,
          vertices: drawingVertices,
          zoneId,
          hydrozoneType: "TURF" as const,
          sunExposure: "FULL_SUN" as const,
          slopePercent: 0,
          soilType: "LOAM" as const,
          waterPriority: 3,
          headPreference: "SPRAY" as const,
        };
        setDocument({
          ...document,
          hydrozones: [...document.hydrozones, hydrozone],
          zones: document.zones.map((z) =>
            z.id === zoneId ? { ...z, hydrozoneIds: [...z.hydrozoneIds, hydrozone.id] } : z
          ),
        });
      }
    } else if (activeTool === "exclusion") {
      const exclusion = {
        id: generateId("ex"),
        name: `Exclusion ${document.exclusionZones.length + 1}`,
        vertices: drawingVertices,
        exclusionType: pendingExclusionType,
      };
      setDocument({ ...document, exclusionZones: [...document.exclusionZones, exclusion] });
    } else if (activeTool === "siteFeature") {
      const feature = {
        id: generateId("sf"),
        name: `${pendingSiteFeatureType.replace(/_/g, " ")} ${(document.siteFeatures?.length ?? 0) + 1}`,
        vertices: drawingVertices,
        featureType: pendingSiteFeatureType,
      };
      setDocument({
        ...document,
        siteFeatures: [...(document.siteFeatures ?? []), feature],
      });
    } else if (activeTool === "sod" || activeTool === "topsoil") {
      const area = {
        id: generateId("la"),
        name: `${activeTool === "sod" ? "Sod" : "Topsoil"} ${(document.landscapeAreas?.length ?? 0) + 1}`,
        vertices: drawingVertices,
        areaType: activeTool === "sod" ? ("SOD" as const) : ("TOPSOIL" as const),
        depthInches: activeTool === "topsoil" ? 4 : undefined,
      };
      setDocument({
        ...document,
        landscapeAreas: [...(document.landscapeAreas ?? []), area],
      });
    }
    clearDrawing();
    toast.success("Polygon added");
  }, [activeTool, drawingVertices, document, setDocument, clearDrawing, pendingExclusionType, pendingSiteFeatureType]);

  const handleCanvasClick = useCallback(
    (point: Point) => {
      setLastCanvasClick(point);

      if (activeTool === "scale") {
        if (!scalePointA) {
          setScalePointA(point);
        } else if (!scalePointB) {
          setScalePointB(point);
        }
        return;
      }

      if (
        activeTool === "hydrozone" ||
        activeTool === "exclusion" ||
        activeTool === "siteFeature" ||
        activeTool === "sod" ||
        activeTool === "topsoil"
      ) {
        if (drawingVertices.length >= 3) {
          const dist = distanceBetweenPoints(point, drawingVertices[0]);
          if (dist <= POLYGON_CLOSE_RADIUS) {
            finishPolygon();
            return;
          }
        }
        addDrawingVertex(point);
        return;
      }

      if (activeTool === "head") {
        const zoneId = document.zones[0]?.id;
        if (!zoneId) {
          toast.error("Create a zone first");
          return;
        }
        const hydrozone = document.hydrozones.find((h) =>
          pointInPolygon(point, h.vertices)
        );
        const assembly = resolveHeadAssembly(
          catalog,
          hydrozone?.headPreference ?? "SPRAY",
          document.waterSource?.staticPressurePsi ?? DEFAULT_PRESSURE_PSI
        );
        if (!assembly) {
          toast.error("No compatible head/nozzle in catalog");
          return;
        }
        const head = {
          id: generateId("head"),
          zoneId,
          hydrozoneId: hydrozone?.id,
          position: point,
          headBodyId: assembly.headBodyId,
          catalogItemId: assembly.nozzleId,
          arcDegrees: assembly.arcDegrees,
          radiusFeet: assembly.radiusFeet,
          rotationDegrees: assembly.rotationDegrees,
          gpm: assembly.gpm,
          precipInPerHr: assembly.precipInPerHr,
          locked: false,
        };
        setDocument({ ...document, heads: [...document.heads, head] });
        setSelected(head.id, "head");
        return;
      }

      if (activeTool === "valve") {
        const zoneId = document.zones[0]?.id;
        if (!zoneId) {
          toast.error("Create a zone first");
          return;
        }
        const valveItem = catalog.find((c) => c.category === "VALVE");
        const valve = {
          id: generateId("valve"),
          zoneId,
          position: point,
          catalogItemId: valveItem?.id ?? "cat_valve",
        };
        setDocument({ ...document, valves: [...document.valves, valve] });
        setSelected(valve.id, "valve");
        return;
      }

      if (activeTool === "equipment") {
        const zoneId = document.zones[0]?.id;
        const equip = {
          id: generateId("equip"),
          equipmentType: equipmentPlacementType,
          position: point,
          zoneId,
        };
        const nextDoc = {
          ...document,
          equipment: [...(document.equipment ?? []), equip],
        };
        if (equipmentPlacementType === "POC") {
          nextDoc.waterSource = {
            ...DEFAULT_WATER_SOURCE,
            ...document.waterSource,
            poc: point,
          };
        }
        setDocument(nextDoc);
        setSelected(equip.id, "equipment");
        return;
      }

      if (activeTool === "pipe") {
        const zoneId = document.zones[0]?.id;
        if (!zoneId) {
          toast.error("Create a zone first");
          return;
        }
        const pipeItem = catalog.find((c) => c.category === "PIPE");
        const newVertices = [...drawingVertices, point];
        if (newVertices.length >= 2) {
          const pipe = {
            id: generateId("pipe"),
            zoneId,
            catalogItemId: pipeItem?.id ?? "cat_pipe_1pvc",
            points: newVertices,
            diameterInches: 1,
            material: "PVC",
          };
          setDocument({ ...document, pipes: [...document.pipes, pipe] });
          clearDrawing();
        } else {
          addDrawingVertex(point);
        }
      }
    },
    [
      activeTool,
      scalePointA,
      scalePointB,
      setScalePointA,
      setScalePointB,
      addDrawingVertex,
      document,
      catalog,
      setDocument,
      setSelected,
      setLastCanvasClick,
      equipmentPlacementType,
      drawingVertices,
      clearDrawing,
      finishPolygon,
    ]
  );

  function handleScaleCalibrate(feet: number) {
    if (!scalePointA || !scalePointB) return;
    setDocument({
      ...document,
      scale: { pointA: scalePointA, pointB: scalePointB, realWorldFeet: feet },
    });
    setScalePointA(null);
    setScalePointB(null);
    toast.success(`Scale set: ${feet} ft`);
  }

  async function handleAutoPlace(hydrozoneId: string) {
    const hydrozone = document.hydrozones.find((h) => h.id === hydrozoneId);
    if (!hydrozone) return;
    let zoneId = hydrozone.zoneId ?? document.zones[0]?.id;
    if (!zoneId) {
      zoneId = generateId("zone");
      setDocument({
        ...document,
        zones: [...document.zones, { id: zoneId!, name: "Zone 1", hydrozoneIds: [hydrozoneId] }],
      });
    }
    setAutoPlacing(true);
    try {
      const result = placeHeads({
        hydrozone,
        zoneId: zoneId!,
        catalog,
        scale: document.scale,
        exclusionZones: document.exclusionZones,
        pressurePsi: document.waterSource?.staticPressurePsi,
      });

      let heads = result.heads;
      if (mlRefinementEnabled && mlStatus.serviceHealthy && mlStatus.modelLoaded) {
        const catalogItemIds = [...new Set(heads.map((h) => h.catalogItemId))];
        const refined = await refineDesignHeadsWithMl({
          hydrozone,
          zoneId: zoneId!,
          baselineHeads: heads,
          catalog,
          placementContext: {
            headPreference: hydrozone.headPreference,
            pressurePsi: document.waterSource?.staticPressurePsi ?? DEFAULT_PRESSURE_PSI,
            pattern: result.pattern,
            nozzleModel: result.nozzleModel,
            catalogItemIds,
          },
          forceMl: true,
        });
        if (refined.usedMl) {
          heads = refined.heads;
          toast.success("ML refinement applied");
        } else if (refined.error) {
          toast.message("Using heuristic placement", { description: refined.error });
        }
      }

      const unlockedHeads = document.heads.filter(
        (h) => h.hydrozoneId !== hydrozoneId || h.locked
      );
      setDocument({
        ...document,
        heads: [...unlockedHeads, ...heads],
      });
      setValidationIssues([...store.validationIssues, ...result.warnings]);
      const patternLabel = result.pattern === "triangular" ? "triangular" : "square";
      const nozzleLabel = result.nozzleModel ?? "nozzle";
      const overlap = result.overlapPercent ?? result.coveragePercent;
      toast.success(
        `Placed ${heads.length} heads · ${patternLabel} · ${nozzleLabel} · R ${result.radiusFeet?.toFixed(0) ?? "?"} ft · ${overlap}% overlap`
      );
    } finally {
      setAutoPlacing(false);
    }
  }

  function handleValidate() {
    const issues = validateDesign(document, catalog);
    setValidationIssues(issues);
    toast.info(`${issues.length} validation item(s)`);
  }

  async function handleUploadImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", project.id);
    const res = await fetch("/api/upload/property-image", { method: "POST", body: formData });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Upload failed");
      return;
    }
    const data = await res.json();
    const img = new window.Image();
    img.src = URL.createObjectURL(file);
    await new Promise((r) => {
      img.onload = r;
      img.onerror = r;
    });
    setDocument({
      ...document,
      propertyImage: {
        blobPath: data.blobPath,
        width: img.naturalWidth || img.width || 1200,
        height: img.naturalHeight || img.height || 800,
      },
    });
    toast.success("Property image uploaded");
  }

  const inspectorProps = {
    catalog,
    onUploadImage: handleUploadImage,
    onAutoPlace: handleAutoPlace,
    onValidate: handleValidate,
    onScaleCalibrate: handleScaleCalibrate,
    autoPlacing,
    mlRefinementEnabled,
    mlAvailable: mlStatus.serviceHealthy && mlStatus.modelLoaded,
    onMlRefinementChange: setMlRefinementEnabled,
  };

  return (
    <div className="flex h-dvh flex-col">
      <DesignTour initialStatus={tourStatus} />
      <header className="safe-top shrink-0 border-b bg-card px-3 py-2 sm:px-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href="/projects">← Projects</Link>
            </Button>
            <TourHelpButton />
            <div className="min-w-0">
              <h1 className="truncate font-semibold">{project.name}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {version.label}
                {version.kind === "AS_BUILT" && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    As-built
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle compact />
            <VersionSelector
              projectId={project.id}
              versions={versions}
              activeVersionId={version.id}
            />
            <ExportToCrmDialog
              projectId={project.id}
              versionId={version.id}
              defaultCustomerId={project.crmCustomerId}
              defaultPropertyId={project.crmPropertyId}
            />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${project.id}/settings`}>CRM link</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {!isMobile && <DesignToolbar />}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {(activeTool === "hydrozone" || activeTool === "exclusion") && drawingVertices.length > 0 && (
            <div className="border-b bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
              Click to place points.{" "}
              {drawingVertices.length >= 3
                ? "Click the first point to close the shape."
                : `Add ${3 - drawingVertices.length} more point(s) to close.`}
            </div>
          )}
          <div className="min-h-0 flex-1" data-tour="tour-canvas">
            <DesignCanvas
              imageUrl={displayImageUrl}
              catalog={catalog}
              onCanvasClick={handleCanvasClick}
            />
          </div>
          {!isMobile && (
            <>
              <ValidationDrawer />
              <MaterialsPanel
                items={materials}
                totals={materialTotals}
                quoteTier={quoteTier}
                onQuoteTierChange={setQuoteTier}
              />
            </>
          )}
        </div>
        {!isMobile && (
          <aside className="flex w-80 min-h-0 shrink-0 flex-col overflow-hidden border-l bg-card">
            <div className="max-h-[min(50%,28rem)] shrink-0 overflow-y-auto border-b">
              <DesignHeadEditorPanel catalog={catalog} />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <InspectorPanel {...inspectorProps} className="h-full w-full border-l-0" />
            </div>
          </aside>
        )}
      </div>

      {isMobile && (
        <>
          <div className="flex shrink-0 border-t bg-card">
            <Button
              variant="ghost"
              className="h-11 flex-1 flex-col gap-0.5 rounded-none py-1 text-[10px]"
              onClick={() => setHeadEditorOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              Head
            </Button>
            <Button
              variant="ghost"
              className="h-11 flex-1 flex-col gap-0.5 rounded-none py-1 text-[10px]"
              onClick={() => setInspectorOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
              Properties
            </Button>
            <Button
              variant="ghost"
              className="h-11 flex-1 flex-col gap-0.5 rounded-none py-1 text-[10px]"
              onClick={() => setValidationOpen(true)}
            >
              <ClipboardList className="h-4 w-4" />
              Issues
            </Button>
            <Button
              variant="ghost"
              className="h-11 flex-1 flex-col gap-0.5 rounded-none py-1 text-[10px]"
              onClick={() => setMaterialsOpen(true)}
            >
              <Package className="h-4 w-4" />
              Materials
            </Button>
          </div>
          <DesignToolbar layout="dock" />
        </>
      )}

      <Sheet open={headEditorOpen} onOpenChange={setHeadEditorOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Head editor</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto">
            <DesignHeadEditorPanel catalog={catalog} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <SheetContent side="right" className="w-full max-w-md p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Inspector</SheetTitle>
          </SheetHeader>
          <InspectorPanel {...inspectorProps} variant="sheet" className="h-full" />
        </SheetContent>
      </Sheet>

      <Sheet open={validationOpen} onOpenChange={setValidationOpen}>
        <SheetContent side="bottom" className="p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Validation report</SheetTitle>
          </SheetHeader>
          <div className="max-h-[70dvh] overflow-y-auto">
            <ValidationDrawer />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={materialsOpen} onOpenChange={setMaterialsOpen}>
        <SheetContent side="bottom" className="p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Material estimate</SheetTitle>
          </SheetHeader>
          <div className="max-h-[70dvh] overflow-y-auto">
            <MaterialsPanel
              items={materials}
              totals={materialTotals}
              quoteTier={quoteTier}
              onQuoteTierChange={setQuoteTier}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
