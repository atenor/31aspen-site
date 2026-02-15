import { EstimateCategory, LaborType } from "@prisma/client";

export type EstimateInputLine = {
  category: EstimateCategory;
  quantity: number;
  unitCostCents?: number | null;
  unitPriceCents?: number | null;
  laborHours?: number | null;
  laborType?: LaborType | null;
};

export type EstimateRateConfig = {
  bodyLaborRateCents: number;
  paintLaborRateCents: number;
  mechLaborRateCents: number;
  detailLaborRateCents: number;
  partsMarkupRule: { tiers: Array<{ min: number; max: number | null; markupPercent: number }> };
  subletMarkupPercent: number;
  taxRatePercent?: number;
};

export type EstimateTotals = {
  laborByType: Record<LaborType, number>;
  laborSubtotalCents: number;
  partsSubtotalCents: number;
  subletSubtotalCents: number;
  materialsFeesSubtotalCents: number;
  taxCents: number;
  grandTotalCents: number;
};

const defaultLabor: Record<LaborType, number> = {
  BODY: 0,
  PAINT: 0,
  MECH: 0,
  DETAIL: 0
};

function applyTierMarkup(costCents: number, tiers: EstimateRateConfig["partsMarkupRule"]["tiers"]) {
  const tier = tiers.find((item) => costCents >= item.min && (item.max === null || costCents <= item.max));
  if (!tier) return costCents;
  return Math.round(costCents * (1 + tier.markupPercent / 100));
}

function laborRateByType(type: LaborType, config: EstimateRateConfig) {
  if (type === "BODY") return config.bodyLaborRateCents;
  if (type === "PAINT") return config.paintLaborRateCents;
  if (type === "MECH") return config.mechLaborRateCents;
  return config.detailLaborRateCents;
}

export function computeEstimateTotals(lines: EstimateInputLine[], config: EstimateRateConfig): EstimateTotals {
  const laborByType: Record<LaborType, number> = { ...defaultLabor };
  let partsSubtotalCents = 0;
  let subletSubtotalCents = 0;
  let materialsFeesSubtotalCents = 0;
  let taxBaseCents = 0;

  for (const line of lines) {
    const quantity = line.quantity || 0;
    if (line.category === "LABOR") {
      const laborType = line.laborType || "BODY";
      const hours = line.laborHours ?? quantity;
      const lineTotal = Math.round((hours || 0) * laborRateByType(laborType, config));
      laborByType[laborType] += lineTotal;
      taxBaseCents += lineTotal;
      continue;
    }

    const fallback = line.unitPriceCents ?? line.unitCostCents ?? 0;
    const rawTotal = Math.round(quantity * fallback);

    if (line.category === "PARTS") {
      const markedUp = applyTierMarkup(rawTotal, config.partsMarkupRule.tiers);
      partsSubtotalCents += markedUp;
      taxBaseCents += markedUp;
      continue;
    }

    if (line.category === "SUBLET") {
      const markedUp = Math.round(rawTotal * (1 + config.subletMarkupPercent / 100));
      subletSubtotalCents += markedUp;
      taxBaseCents += markedUp;
      continue;
    }

    if (["MATERIALS", "FEE", "STORAGE", "DISCOUNT"].includes(line.category)) {
      const signed = line.category === "DISCOUNT" ? -Math.abs(rawTotal) : rawTotal;
      materialsFeesSubtotalCents += signed;
      taxBaseCents += signed;
      continue;
    }

    if (line.category === "TAX") {
      materialsFeesSubtotalCents += rawTotal;
    }
  }

  const laborSubtotalCents = Object.values(laborByType).reduce((acc, value) => acc + value, 0);
  const autoTaxCents = Math.max(0, Math.round(taxBaseCents * ((config.taxRatePercent ?? 0) / 100)));
  const grandTotalCents = laborSubtotalCents + partsSubtotalCents + subletSubtotalCents + materialsFeesSubtotalCents + autoTaxCents;

  return {
    laborByType,
    laborSubtotalCents,
    partsSubtotalCents,
    subletSubtotalCents,
    materialsFeesSubtotalCents,
    taxCents: autoTaxCents,
    grandTotalCents
  };
}
