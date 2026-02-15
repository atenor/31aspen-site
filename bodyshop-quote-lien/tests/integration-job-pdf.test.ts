import { describe, expect, it } from "vitest";
import { createJobSchema } from "@/lib/validators/job";
import { generateEstimatePdf } from "@/lib/pdf/templates";

describe("integration: create job payload + estimate PDF", () => {
  it("validates a job payload and generates a non-empty estimate PDF", async () => {
    const parsed = createJobSchema.safeParse({
      customer: {
        name: "John Doe",
        phone: "555-555-1212",
        email: "john@example.com"
      },
      vehicle: {
        year: 2022,
        make: "Toyota",
        model: "Camry"
      },
      jobType: "CUSTOMER_PAY"
    });

    expect(parsed.success).toBe(true);

    const pdf = await generateEstimatePdf({
      jobNumber: "BS-000001",
      customerName: "John Doe",
      vehicle: "2022 Toyota Camry",
      totalWritten: "$1250.00"
    });

    expect(pdf.byteLength).toBeGreaterThan(200);
  });
});
