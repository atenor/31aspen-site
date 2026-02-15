"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JobType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const jobTypes: JobType[] = ["INSURANCE", "CUSTOMER_PAY", "MIXED", "TOW_STORAGE"];

export function NewJobForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payload, setPayload] = useState({
    customer: { name: "", phone: "", email: "", address: "" },
    vehicle: { year: new Date().getFullYear(), make: "", model: "", vin: "", trim: "", mileage: undefined as number | undefined },
    jobType: "CUSTOMER_PAY" as JobType,
    notesInternal: "",
    claim: { carrierName: "", claimNumber: "", adjusterName: "", adjusterEmail: "", adjusterPhone: "" }
  });

  function patch(section: "customer" | "vehicle" | "claim", key: string, value: string | number | undefined) {
    setPayload((previous) => ({
      ...previous,
      [section]: {
        ...(previous as any)[section],
        [key]: value
      }
    }));
  }

  async function submitJob() {
    setLoading(true);
    setError(null);

    const body: any = {
      customer: payload.customer,
      vehicle: {
        ...payload.vehicle,
        mileage: payload.vehicle.mileage ?? null,
        vin: payload.vehicle.vin || null,
        trim: payload.vehicle.trim || null
      },
      jobType: payload.jobType,
      notesInternal: payload.notesInternal
    };

    if (payload.jobType === "INSURANCE" || payload.jobType === "MIXED") {
      body.claim = {
        carrierName: payload.claim.carrierName,
        claimNumber: payload.claim.claimNumber,
        adjusterName: payload.claim.adjusterName || undefined,
        adjusterEmail: payload.claim.adjusterEmail || undefined,
        adjusterPhone: payload.claim.adjusterPhone || undefined
      };
    }

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    setLoading(false);
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Unable to create job");
      return;
    }

    const data = await response.json();
    router.push(`/jobs/${data.job.id}`);
    router.refresh();
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`rounded px-2 py-1 ${step === n ? "bg-primary text-white" : "bg-muted"}`}>Step {n}</span>
        ))}
      </div>

      {step === 1 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1"><label>Customer Name</label><Input value={payload.customer.name} onChange={(e) => patch("customer", "name", e.target.value)} /></div>
          <div className="space-y-1"><label>Phone</label><Input value={payload.customer.phone} onChange={(e) => patch("customer", "phone", e.target.value)} /></div>
          <div className="space-y-1"><label>Email</label><Input value={payload.customer.email} onChange={(e) => patch("customer", "email", e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><label>Address</label><Input value={payload.customer.address} onChange={(e) => patch("customer", "address", e.target.value)} /></div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1"><label>Year</label><Input type="number" value={payload.vehicle.year} onChange={(e) => patch("vehicle", "year", Number(e.target.value))} /></div>
          <div className="space-y-1"><label>Make</label><Input value={payload.vehicle.make} onChange={(e) => patch("vehicle", "make", e.target.value)} /></div>
          <div className="space-y-1"><label>Model</label><Input value={payload.vehicle.model} onChange={(e) => patch("vehicle", "model", e.target.value)} /></div>
          <div className="space-y-1"><label>VIN</label><Input value={payload.vehicle.vin} onChange={(e) => patch("vehicle", "vin", e.target.value)} /></div>
          <div className="space-y-1"><label>Job Type</label><select className="w-full rounded-md border px-3 py-2" value={payload.jobType} onChange={(e) => setPayload((p) => ({ ...p, jobType: e.target.value as JobType }))}>{jobTypes.map((type) => <option key={type}>{type}</option>)}</select></div>
          <div className="space-y-1"><label>Mileage</label><Input type="number" value={payload.vehicle.mileage ?? ""} onChange={(e) => patch("vehicle", "mileage", e.target.value ? Number(e.target.value) : undefined)} /></div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          {(payload.jobType === "INSURANCE" || payload.jobType === "MIXED") ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><label>Carrier Name</label><Input value={payload.claim.carrierName} onChange={(e) => patch("claim", "carrierName", e.target.value)} /></div>
              <div className="space-y-1"><label>Claim Number</label><Input value={payload.claim.claimNumber} onChange={(e) => patch("claim", "claimNumber", e.target.value)} /></div>
              <div className="space-y-1"><label>Adjuster Name</label><Input value={payload.claim.adjusterName} onChange={(e) => patch("claim", "adjusterName", e.target.value)} /></div>
              <div className="space-y-1"><label>Adjuster Email</label><Input value={payload.claim.adjusterEmail} onChange={(e) => patch("claim", "adjusterEmail", e.target.value)} /></div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No claim info required for this job type.</p>
          )}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-2">
          <label>Internal Notes</label>
          <Textarea value={payload.notesInternal} onChange={(e) => setPayload((p) => ({ ...p, notesInternal: e.target.value }))} rows={4} />
          <p className="text-sm text-muted-foreground">Estimate builder, photos, PDF, and signature are available after job creation.</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>Back</Button>
        {step < 4 ? (
          <Button onClick={() => setStep((s) => Math.min(4, s + 1))}>Next</Button>
        ) : (
          <Button onClick={submitJob} disabled={loading}>{loading ? "Creating..." : "Create Job"}</Button>
        )}
      </div>
    </Card>
  );
}
