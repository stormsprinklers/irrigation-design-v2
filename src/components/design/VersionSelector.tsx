"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  activateDesignVersion,
  createDesignVersion,
} from "@/lib/actions/design";
import type { DesignVersion } from "@prisma/client";
import { ShareMenu } from "./ShareMenu";
import { NativeSelect } from "@/components/ui/native-select";

type Props = {
  projectId: string;
  versions: DesignVersion[];
  activeVersionId: string;
};

export function VersionSelector({ projectId, versions, activeVersionId }: Props) {
  const router = useRouter();
  const [label, setLabel] = useState("");

  async function handleSaveVersion() {
    if (!label.trim()) return;
    await createDesignVersion(projectId, {
      label,
      kind: "CUSTOMER_REVISION",
    });
    setLabel("");
    router.refresh();
  }

  async function handleRestore(versionId: string) {
    await activateDesignVersion(projectId, versionId);
    router.refresh();
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 lg:flex-nowrap"
      data-tour="tour-versions"
    >
      <NativeSelect
        className="h-11 w-full min-w-0 py-1 sm:h-8 sm:w-auto"
        value={activeVersionId}
        onChange={(e) => handleRestore(e.target.value)}
      >
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label} ({v.kind})
          </option>
        ))}
      </NativeSelect>
      <Input
        className="h-11 w-full min-w-0 sm:h-8 sm:w-40"
        placeholder="Version label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <Button size="sm" variant="outline" onClick={handleSaveVersion}>
        Save version
      </Button>
      <ShareMenu projectId={projectId} />
    </div>
  );
}
