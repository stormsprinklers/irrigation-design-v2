"use client";

import { useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import Link from "next/link";
import { saveDesignDocument } from "@/lib/actions/design";
import { useDesignStore } from "@/lib/stores/design-store";
import { DesignToolbar } from "./DesignToolbar";
import { InspectorPanel } from "./InspectorPanel";
import { ValidationDrawer } from "./ValidationDrawer";
import { VersionSelector } from "./VersionSelector";
import { MaterialsPanel } from "./MaterialsPanel";
import { placeHeads, pointInPolygon } from "@/lib/domain/placement";
import { resolveHeadAssembly } from "@/lib/catalog/compat";
import { validateDesign } from "@/lib/domain/validation";
import { buildMaterialList, calculateMaterialTotal } from "@/lib/domain/materials";
import { generateId, distanceBetweenPoints, POLYGON_CLOSE_RADIUS } from "@/lib/utils";
import type { CatalogItemData, DesignDocument, Point, PricingProfileData } from "@/lib/domain/types";
import { DEFAULT_PRESSURE_PSI } from "@/lib/domain/types";
import type { DesignVersion, Project } from "@prisma/client";
import { DesignTour, TourHelpButton } from "./tour/DesignTour";
import type { TourStatus } from "@/lib/actions/tour";
import { Button } from "@/components/ui/button";
import { blobProxyUrl } from "@/lib/blob/urls";

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
};

export function DesignWorkspace({
  project,
  version,
  versions,
  catalog,
  pricing,
  imageUrl,
  tourStatus,
}: Props) {
  const store = useDesignStore();
  const {
    init,
    document,
    setDocument,
    activeTool,
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
  } = store;

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

  const materials = useMemo(
    () => buildMaterialList(document, catalog, pricing),
    [document, catalog, pricing]
  );
  const materialTotals = useMemo(
    () => calculateMaterialTotal(materials, pricing),
    [materials, pricing]
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
        exclusionType: "BUILDING" as const,
      };
      setDocument({ ...document, exclusionZones: [...document.exclusionZones, exclusion] });
    }
    clearDrawing();
    toast.success("Polygon added");
  }, [activeTool, drawingVertices, document, setDocument, clearDrawing]);

  const handleCanvasClick = useCallback(
    (point: Point) => {
      if (activeTool === "scale") {
        if (!scalePointA) {
          setScalePointA(point);
        } else if (!scalePointB) {
          setScalePointB(point);
        }
        return;
      }

      if (activeTool === "hydrozone" || activeTool === "exclusion") {
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

  function handleAutoPlace(hydrozoneId: string) {
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
    const result = placeHeads({
      hydrozone,
      zoneId: zoneId!,
      catalog,
      scale: document.scale,
      exclusionZones: document.exclusionZones,
      pressurePsi: document.waterSource?.staticPressurePsi,
    });
    const unlockedHeads = document.heads.filter(
      (h) => h.hydrozoneId !== hydrozoneId || h.locked
    );
    setDocument({
      ...document,
      heads: [...unlockedHeads, ...result.heads],
    });
    setValidationIssues([...store.validationIssues, ...result.warnings]);
    const patternLabel = result.pattern === "triangular" ? "triangular" : "square";
    const nozzleLabel = result.nozzleModel ?? "nozzle";
    const overlap = result.overlapPercent ?? result.coveragePercent;
    toast.success(
      `Placed ${result.heads.length} heads · ${patternLabel} · ${nozzleLabel} · R ${result.radiusFeet?.toFixed(0) ?? "?"} ft · ${overlap}% overlap`
    );
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

  return (
    <div className="flex h-screen flex-col">
      <DesignTour initialStatus={tourStatus} />
      <header className="flex items-center justify-between border-b bg-card px-4 py-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/projects">← Projects</Link>
          </Button>
          <TourHelpButton />
          <div>
            <h1 className="font-semibold">{project.name}</h1>
            <p className="text-xs text-muted-foreground">
              {version.label}
              {version.kind === "AS_BUILT" && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                  As-built
                </span>
              )}
            </p>
          </div>
        </div>
        <VersionSelector
          projectId={project.id}
          versions={versions}
          activeVersionId={version.id}
        />
      </header>

      <div className="flex min-h-0 flex-1">
        <DesignToolbar />
        <div className="flex min-h-0 flex-1 flex-col">
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
              onCanvasClick={handleCanvasClick}
              onClosePolygon={finishPolygon}
            />
          </div>
          <ValidationDrawer />
          <MaterialsPanel items={materials} totals={materialTotals} />
        </div>
        <InspectorPanel
          catalog={catalog}
          onUploadImage={handleUploadImage}
          onAutoPlace={handleAutoPlace}
          onValidate={handleValidate}
          onScaleCalibrate={handleScaleCalibrate}
        />
      </div>
    </div>
  );
}
