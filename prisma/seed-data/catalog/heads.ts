import type { CatalogSeedItem } from "./chart";

const hunterRotorHead = (
  id: string,
  model: string,
  headFamily: string,
  opts: {
    popUpInches: number | "shrub";
    inlet: string;
    arcMin?: number;
    arcMax?: number;
    pressurePsiMin: number;
    pressurePsiMax: number;
    pressurePsiRecommended?: [number, number];
    checkValve?: boolean;
    prsPsi?: number;
  }
): CatalogSeedItem => ({
  id,
  category: "ROTOR_BODY",
  manufacturer: "Hunter",
  model,
  specs: {
    itemRole: "body",
    headFamily,
    popUpInches: opts.popUpInches,
    inlet: opts.inlet,
    arcDegreesMin: opts.arcMin ?? 40,
    arcDegreesMax: opts.arcMax ?? 360,
    acceptedNozzleCategories: ["ROTOR"],
    rotationAdjustable: true,
    pressurePsiMin: opts.pressurePsiMin,
    pressurePsiMax: opts.pressurePsiMax,
    pressurePsiRecommended: opts.pressurePsiRecommended,
    checkValve: opts.checkValve ?? false,
    prsPsi: opts.prsPsi,
  },
});

const hunterSprayHead = (
  id: string,
  model: string,
  headFamily: string,
  opts: {
    popUpInches: number | "shrub";
    inlet?: string;
    pressurePsiMin?: number;
    pressurePsiMax?: number;
    prsPsi?: number;
    checkValve?: boolean;
    sam?: boolean;
  }
): CatalogSeedItem => ({
  id,
  category: "SPRAY_BODY",
  manufacturer: "Hunter",
  model,
  specs: {
    itemRole: "body",
    headFamily,
    popUpInches: opts.popUpInches,
    inlet: opts.inlet ?? '1/2" NPT',
    pressurePsiMin: opts.pressurePsiMin ?? 15,
    pressurePsiMax: opts.pressurePsiMax ?? 100,
    acceptedNozzleCategories: ["SPRAY", "MP_ROTATOR"],
    rotationAdjustable: true,
    prsPsi: opts.prsPsi,
    checkValve: opts.checkValve ?? false,
    sam: opts.sam ?? false,
  },
});

const rainBirdSprayHead = (
  id: string,
  model: string,
  headFamily: string,
  opts: {
    popUpInches: number;
    prsPsi?: number;
    sam?: boolean;
    sku?: string;
  }
): CatalogSeedItem => ({
  id,
  category: "SPRAY_BODY",
  manufacturer: "Rain Bird",
  model,
  specs: {
    itemRole: "body",
    headFamily,
    popUpInches: opts.popUpInches,
    inlet: '1/2" NPT',
    pressurePsiMin: 15,
    pressurePsiMax: 70,
    acceptedNozzleCategories: ["SPRAY", "MP_ROTATOR"],
    rotationAdjustable: true,
    prsPsi: opts.prsPsi,
    sam: opts.sam ?? false,
    sku: opts.sku,
  },
});

const rainBirdRotorHead = (
  id: string,
  model: string,
  headFamily: string,
  opts: {
    popUpInches: number | "shrub";
    pressurePsiMin: number;
    pressurePsiMax: number;
    sam?: boolean;
  }
): CatalogSeedItem => ({
  id,
  category: "ROTOR_BODY",
  manufacturer: "Rain Bird",
  model,
  specs: {
    itemRole: "body",
    headFamily,
    popUpInches: opts.popUpInches,
    inlet: '1/2" NPT',
    arcDegreesMin: 40,
    arcDegreesMax: 360,
    acceptedNozzleCategories: ["ROTOR"],
    rotationAdjustable: true,
    pressurePsiMin: opts.pressurePsiMin,
    pressurePsiMax: opts.pressurePsiMax,
    sam: opts.sam ?? false,
  },
});

export const HEAD_ITEMS: CatalogSeedItem[] = [
  // Hunter PGP-ADJ
  hunterRotorHead("head_hunter_pgp_adj_4", "PGP-ADJ 4\"", "hunter_pgp_adj", {
    popUpInches: 4,
    inlet: '3/4" NPT',
    pressurePsiMin: 20,
    pressurePsiMax: 100,
    pressurePsiRecommended: [25, 70],
  }),

  // Hunter PGP Ultra
  hunterRotorHead("head_hunter_pgp_ultra_4", "PGP Ultra 4\"", "hunter_pgp_ultra", {
    popUpInches: 4,
    inlet: '3/4" NPT',
    pressurePsiMin: 20,
    pressurePsiMax: 100,
    pressurePsiRecommended: [25, 70],
  }),
  hunterRotorHead("head_hunter_pgp_ultra_6", "PGP Ultra 6\"", "hunter_pgp_ultra", {
    popUpInches: 6,
    inlet: '3/4" NPT',
    pressurePsiMin: 20,
    pressurePsiMax: 100,
    pressurePsiRecommended: [25, 70],
  }),

  // Hunter PGJ
  hunterRotorHead("head_hunter_pgj_04", "PGJ-04 4\"", "hunter_pgj", {
    popUpInches: 4,
    inlet: '1/2" NPT',
    pressurePsiMin: 20,
    pressurePsiMax: 100,
    pressurePsiRecommended: [30, 50],
  }),
  hunterRotorHead("head_hunter_pgj_06", "PGJ-06 6\"", "hunter_pgj", {
    popUpInches: 6,
    inlet: '1/2" NPT',
    pressurePsiMin: 20,
    pressurePsiMax: 100,
    pressurePsiRecommended: [30, 50],
  }),
  hunterRotorHead("head_hunter_pgj_12", "PGJ-12 12\"", "hunter_pgj", {
    popUpInches: 12,
    inlet: '1/2" NPT',
    pressurePsiMin: 20,
    pressurePsiMax: 100,
    pressurePsiRecommended: [30, 50],
  }),
  hunterRotorHead("head_hunter_pgj_00", "PGJ-00 Shrub", "hunter_pgj", {
    popUpInches: "shrub",
    inlet: '1/2" NPT',
    pressurePsiMin: 20,
    pressurePsiMax: 100,
    pressurePsiRecommended: [30, 50],
  }),

  // Hunter I-20
  hunterRotorHead("head_hunter_i20_04", "I-20 4\"", "hunter_i20", {
    popUpInches: 4,
    inlet: '3/4" NPT',
    pressurePsiMin: 20,
    pressurePsiMax: 100,
    pressurePsiRecommended: [25, 70],
  }),
  hunterRotorHead("head_hunter_i20_06", "I-20 6\"", "hunter_i20", {
    popUpInches: 6,
    inlet: '3/4" NPT',
    pressurePsiMin: 20,
    pressurePsiMax: 100,
    pressurePsiRecommended: [25, 70],
  }),
  hunterRotorHead("head_hunter_i20_12", "I-20 12\"", "hunter_i20", {
    popUpInches: 12,
    inlet: '3/4" NPT',
    pressurePsiMin: 20,
    pressurePsiMax: 100,
    pressurePsiRecommended: [25, 70],
  }),

  // Hunter Pro-Spray
  hunterSprayHead("head_hunter_pros_04", "Pro-Spray PROS-04 4\"", "hunter_pro_spray", {
    popUpInches: 4,
  }),
  hunterSprayHead("head_hunter_pros_06", "Pro-Spray PROS-06 6\"", "hunter_pro_spray", {
    popUpInches: 6,
  }),
  hunterSprayHead("head_hunter_pros_12", "Pro-Spray PROS-12 12\"", "hunter_pro_spray", {
    popUpInches: 12,
  }),

  // Hunter Pro-Spray PRS40
  hunterSprayHead("head_hunter_pros_prs40_04", "Pro-Spray PRS40 PROS-04-PRS40 4\"", "hunter_pro_spray_prs40", {
    popUpInches: 4,
    prsPsi: 40,
  }),
  hunterSprayHead("head_hunter_pros_prs40_06", "Pro-Spray PRS40 PROS-06-PRS40 6\"", "hunter_pro_spray_prs40", {
    popUpInches: 6,
    prsPsi: 40,
  }),

  // Rain Bird 1800 Series
  rainBirdSprayHead("head_rb_1802", "1802 2\" Spray Body", "rainbird_1800", { popUpInches: 2 }),
  rainBirdSprayHead("head_rb_1804", "1804 4\" Spray Body", "rainbird_1800", { popUpInches: 4 }),
  rainBirdSprayHead("head_rb_1806", "1806 6\" Spray Body", "rainbird_1800", { popUpInches: 6 }),
  rainBirdSprayHead("head_rb_1812", "1812 12\" Spray Body", "rainbird_1800", { popUpInches: 12 }),

  // Rain Bird 1800 PRS (adjustable pattern with regulator)
  rainBirdSprayHead("head_rb_1804_prs", "1804 PRS-30 Adjustable Pattern", "rainbird_1800_prs", {
    popUpInches: 4,
    prsPsi: 30,
  }),
  rainBirdSprayHead("head_rb_1806_prs", "1806 PRS-30 Adjustable Pattern", "rainbird_1800_prs", {
    popUpInches: 6,
    prsPsi: 30,
  }),

  // Rain Bird 1804 SAM
  rainBirdSprayHead("head_rb_1804_sam", "1804SAM 4\" SAM Spray Body", "rainbird_1800_sam", {
    popUpInches: 4,
    sam: true,
    sku: "A43905",
  }),
  rainBirdSprayHead("head_rb_1806_sam", "1806SAM 6\" SAM Spray Body", "rainbird_1800_sam", {
    popUpInches: 6,
    sam: true,
  }),

  // Rain Bird 3500 Series
  rainBirdRotorHead("head_rb_3504", "3504-PC 4\" Rotor", "rainbird_3500", {
    popUpInches: 4,
    pressurePsiMin: 25,
    pressurePsiMax: 55,
  }),
  rainBirdRotorHead("head_rb_3504_sam", "3504-PC-SAM 4\" Rotor SAM", "rainbird_3500", {
    popUpInches: 4,
    pressurePsiMin: 25,
    pressurePsiMax: 55,
    sam: true,
  }),

  // Rain Bird 5000 Series
  rainBirdRotorHead("head_rb_5004", "5004-PC 4\" Rotor", "rainbird_5000", {
    popUpInches: 4,
    pressurePsiMin: 25,
    pressurePsiMax: 65,
  }),
  rainBirdRotorHead("head_rb_5006", "5006-PC 6\" Rotor", "rainbird_5000", {
    popUpInches: 6,
    pressurePsiMin: 25,
    pressurePsiMax: 65,
  }),
  rainBirdRotorHead("head_rb_5012", "5012+PCSAMR 12\" Rotor PRS SAM", "rainbird_5000", {
    popUpInches: 12,
    pressurePsiMin: 25,
    pressurePsiMax: 65,
    sam: true,
  }),
];
