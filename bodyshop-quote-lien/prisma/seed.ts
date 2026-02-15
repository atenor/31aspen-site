import bcrypt from "bcryptjs";
import { PrismaClient, Role, StorageApplies } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = "owner@bodyshop.local";
  const password = "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      name: "Shop Owner",
      passwordHash,
      role: Role.OWNER
    },
    create: {
      name: "Shop Owner",
      email: ownerEmail,
      passwordHash,
      role: Role.OWNER
    }
  });

  await prisma.shopSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      defaultBodyLaborRateCents: 7500,
      defaultPaintLaborRateCents: 8000,
      defaultMechLaborRateCents: 9800,
      defaultDetailLaborRateCents: 5500,
      partsMarkupRuleJson: {
        tiers: [
          { min: 0, max: 10000, markupPercent: 30 },
          { min: 10001, max: 50000, markupPercent: 20 },
          { min: 50001, max: null, markupPercent: 12 }
        ]
      },
      subletMarkupPercent: 15,
      materialsFormulaJson: {
        refinishHourRateCents: 4500,
        fixedFeeCents: 2500
      },
      defaultShopFeesJson: {
        environmentalFeeCents: 3500,
        hazardousFeeCents: 1800,
        adminFeeCents: 1200
      },
      defaultTaxRatePercent: 8,
      storagePolicyDefaultsJson: {
        dailyRateCents: 6500,
        graceDays: 3,
        applies: StorageApplies.UNPAID_ONLY
      },
      lienFlagRulesJson: {
        overdueDays: 15,
        storageDays: 10,
        pickupDays: 7
      },
      releaseControlEnabled: true
    }
  });

  await prisma.storagePolicy.upsert({
    where: { id: "default-storage" },
    update: {},
    create: {
      id: "default-storage",
      name: "Default Outdoor Storage",
      dailyRateCents: 6500,
      graceDays: 3,
      applies: StorageApplies.UNPAID_ONLY
    }
  });

  console.log("Seed complete");
  console.log(`Owner login: ${ownerEmail} / ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
