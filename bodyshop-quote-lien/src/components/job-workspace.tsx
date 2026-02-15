"use client";

import { useMemo, useRef, useState } from "react";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type JobPayload = any;

const tabList = ["Overview", "Estimate", "Insurance/Claim", "Payments", "Docs", "Tasks", "Lien"] as const;

type Tab = (typeof tabList)[number];

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function JobWorkspace({ role, initial }: { role: Role; initial: { job: JobPayload; balanceCents: number; paidBreakdown: any } }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [job, setJob] = useState(initial.job);
  const [balanceCents, setBalanceCents] = useState(initial.balanceCents);
  const [message, setMessage] = useState<string | null>(null);
  const [storageStartDate, setStorageStartDate] = useState(
    job.storageStartDate ? new Date(job.storageStartDate).toISOString().slice(0, 10) : ""
  );

  const [lines, setLines] = useState(
    (initial.job.estimate?.lineItems || []).map((line: any) => ({
      ...line,
      laborHours: line.laborHours || 0,
      quantity: line.quantity || 1,
      unitCostCents: line.unitCostCents || 0,
      unitPriceCents: line.unitPriceCents || 0
    }))
  );

  const [statusOverride, setStatusOverride] = useState("");
  const [claimForm, setClaimForm] = useState({
    carrierName: job.claim?.carrierName || "",
    claimNumber: job.claim?.claimNumber || "",
    adjusterName: job.claim?.adjusterName || "",
    adjusterEmail: job.claim?.adjusterEmail || "",
    adjusterPhone: job.claim?.adjusterPhone || "",
    approvedAmountCents: job.claim?.approvedAmountCents || 0,
    nextFollowUpAt: ""
  });

  const [paymentForm, setPaymentForm] = useState({ payerType: "CUSTOMER", method: "CARD", amountCents: 0, reference: "", note: "" });
  const [taskForm, setTaskForm] = useState({ type: "FOLLOW_UP_CUSTOMER", dueAt: "", note: "" });
  const [authForm, setAuthForm] = useState({ signerName: "", signerEmail: "", signatureTyped: "" });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const quickAddButtons = [
    { label: "Body Labor", category: "LABOR", laborType: "BODY", quantity: 1, laborHours: 1 },
    { label: "Paint Labor", category: "LABOR", laborType: "PAINT", quantity: 1, laborHours: 1 },
    { label: "Parts", category: "PARTS", quantity: 1, unitCostCents: 10000 },
    { label: "Sublet", category: "SUBLET", quantity: 1, unitCostCents: 10000 },
    { label: "Shop Fee", category: "FEE", quantity: 1, unitPriceCents: 3500 },
    { label: "Storage", category: "STORAGE", quantity: 1, unitPriceCents: 6500 }
  ];

  const totals = useMemo(() => {
    const computed = lines.reduce(
      (acc: any, line: any) => {
        let price = Number(line.unitPriceCents || line.unitCostCents || 0);
        if (line.category === "LABOR") {
          const rate = line.laborType === "PAINT" ? job.estimate.paintLaborRateCents : line.laborType === "MECH" ? job.estimate.mechLaborRateCents : line.laborType === "DETAIL" ? job.estimate.detailLaborRateCents : job.estimate.bodyLaborRateCents;
          price = Math.round(Number(line.laborHours || line.quantity || 0) * rate);
          acc.labor += price;
        } else if (line.category === "PARTS") {
          acc.parts += Math.round(Number(line.quantity || 0) * price);
        } else if (line.category === "SUBLET") {
          acc.sublet += Math.round(Number(line.quantity || 0) * price);
        } else {
          acc.other += Math.round(Number(line.quantity || 0) * price);
        }
        return acc;
      },
      { labor: 0, parts: 0, sublet: 0, other: 0 }
    );

    const tax = Math.round((computed.labor + computed.parts + computed.sublet + computed.other) * ((job.estimate?.taxRatePercent || 0) / 100));
    const total = computed.labor + computed.parts + computed.sublet + computed.other + tax;

    return { ...computed, tax, total };
  }, [lines, job.estimate]);

  function addLine(seed: any) {
    setLines((previous: any[]) => [
      ...previous,
      {
        id: `new-${Date.now()}`,
        category: seed.category,
        description: seed.label,
        quantity: seed.quantity ?? 1,
        unit: seed.category === "LABOR" ? "hr" : "ea",
        laborHours: seed.laborHours ?? 0,
        laborType: seed.laborType ?? null,
        unitCostCents: seed.unitCostCents ?? null,
        unitPriceCents: seed.unitPriceCents ?? null,
        isCustomerFacing: true,
        sortOrder: previous.length
      }
    ]);
  }

  async function refreshJob() {
    const response = await fetch(`/api/jobs/${job.id}`);
    const data = await response.json();
    setJob(data.job);
    setBalanceCents(data.balanceCents);
    setLines(
      (data.job.estimate?.lineItems || []).map((line: any) => ({
        ...line,
        laborHours: line.laborHours || 0,
        quantity: line.quantity || 1,
        unitCostCents: line.unitCostCents || 0,
        unitPriceCents: line.unitPriceCents || 0
      }))
    );
  }

  async function saveEstimate() {
    setMessage(null);
    const payload = {
      lines: lines.map((line: any, index: number) => ({
        category: line.category,
        description: line.description,
        quantity: Number(line.quantity || 0),
        unit: line.unit || "ea",
        unitCostCents: line.unitCostCents ? Number(line.unitCostCents) : null,
        unitPriceCents: line.unitPriceCents ? Number(line.unitPriceCents) : null,
        laborHours: line.laborHours ? Number(line.laborHours) : null,
        laborType: line.laborType || null,
        isCustomerFacing: line.isCustomerFacing !== false,
        sortOrder: index
      }))
    };

    const response = await fetch(`/api/jobs/${job.id}/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setMessage("Estimate save failed");
      return;
    }

    setMessage("Estimate saved");
    await refreshJob();
  }

  async function uploadPhoto(file?: File | null) {
    if (!file) return;
    const base64 = await toBase64(file);
    const response = await fetch(`/api/jobs/${job.id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, caption: file.name })
    });

    if (response.ok) {
      setMessage("Photo uploaded");
      await refreshJob();
    }
  }

  async function sendEstimate() {
    const response = await fetch(`/api/jobs/${job.id}/email-estimate`, { method: "POST" });
    setMessage(response.ok ? "Estimate PDF sent" : "Unable to send estimate");
    await refreshJob();
  }

  async function saveClaim() {
    const response = await fetch(`/api/jobs/${job.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...claimForm,
        approvedAmountCents: Number(claimForm.approvedAmountCents || 0),
        nextFollowUpAt: claimForm.nextFollowUpAt ? new Date(claimForm.nextFollowUpAt).toISOString() : undefined
      })
    });

    setMessage(response.ok ? "Claim updated" : "Claim update failed");
    await refreshJob();
  }

  async function sendInsurancePacket() {
    const response = await fetch(`/api/jobs/${job.id}/email-insurance`, { method: "POST" });
    setMessage(response.ok ? "Insurance packet sent" : "Unable to send insurance packet");
    await refreshJob();
  }

  async function addPayment() {
    const response = await fetch(`/api/jobs/${job.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...paymentForm, amountCents: Number(paymentForm.amountCents || 0) })
    });

    setMessage(response.ok ? "Payment added" : "Payment failed");
    await refreshJob();
  }

  async function addTask() {
    const response = await fetch(`/api/jobs/${job.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...taskForm, dueAt: new Date(taskForm.dueAt).toISOString() })
    });

    setMessage(response.ok ? "Task created" : "Task failed");
    await refreshJob();
  }

  async function generateLienNotice() {
    const response = await fetch(`/api/jobs/${job.id}/lien-notice`, { method: "POST" });
    setMessage(response.ok ? "Lien notice generated" : "Lien notice failed");
    await refreshJob();
  }

  function beginDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    const rect = canvas.getBoundingClientRect();
    ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    ctx.stroke();
  }

  function endDraw() {
    drawingRef.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function saveAuthorization() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureBase64 = canvas.toDataURL("image/png");

    const response = await fetch(`/api/jobs/${job.id}/authorization`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "REPAIR_AUTH",
        signerName: authForm.signerName,
        signerEmail: authForm.signerEmail,
        signatureTyped: authForm.signatureTyped,
        signatureBase64
      })
    });

    setMessage(response.ok ? "Authorization captured" : "Authorization failed");
    await refreshJob();
  }

  async function updateStatus(status: string) {
    const response = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        overrideReason: statusOverride,
        storageStartDate: storageStartDate ? new Date(storageStartDate).toISOString() : undefined
      })
    });

    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error || "Status update failed");
      return;
    }

    setMessage(`Status changed to ${status}`);
    await refreshJob();
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Job #</p>
            <p className="font-bold">{job.jobNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Customer</p>
            <p className="font-bold">{job.customer.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vehicle</p>
            <p className="font-bold">{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className={`font-bold ${balanceCents > 0 ? "text-red-700" : "text-green-700"}`}>${(balanceCents / 100).toFixed(2)}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {["DRAFT", "ESTIMATE_READY", "SENT_TO_INSURANCE", "WAITING_APPROVAL", "APPROVED", "IN_REPAIR", "COMPLETE", "DELIVERED", "CLOSED"].map((status) => (
            <Button key={status} variant={job.status === status ? "default" : "outline"} onClick={() => updateStatus(status)}>{status}</Button>
          ))}
          <Input className="max-w-xs" placeholder="OWNER override reason (for DELIVERED w/ balance)" value={statusOverride} onChange={(e) => setStatusOverride(e.target.value)} />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabList.map((item) => (
          <Button key={item} variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>{item}</Button>
        ))}
      </div>

      {tab === "Overview" ? (
        <Card className="space-y-3">
          <p><strong>Job Type:</strong> {job.jobType}</p>
          <p><strong>Status:</strong> {job.status}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={sendEstimate}>Send Estimate PDF</Button>
            <Button variant="outline" onClick={generateLienNotice}>Generate Lien Notice</Button>
          </div>
        </Card>
      ) : null}

      {tab === "Estimate" ? (
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Estimate Builder</h3>
          <div className="flex flex-wrap gap-2">
            {quickAddButtons.map((item) => (
              <Button key={item.label} variant="outline" onClick={() => addLine(item)}>{item.label}</Button>
            ))}
          </div>

          <details>
            <summary className="cursor-pointer text-sm font-semibold">Suggested add-ons</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { label: "Blend Panel", category: "LABOR", laborType: "PAINT", quantity: 1, laborHours: 1.5 },
                { label: "Materials", category: "MATERIALS", quantity: 1, unitPriceCents: 4500 },
                { label: "Diagnostic Scan", category: "SUBLET", quantity: 1, unitCostCents: 12000 },
                { label: "Calibration", category: "SUBLET", quantity: 1, unitCostCents: 25000 }
              ].map((item) => (
                <Button key={item.label} variant="outline" onClick={() => addLine(item)}>{item.label}</Button>
              ))}
            </div>
          </details>

          <div className="space-y-2">
            {lines.map((line: any, index: number) => (
              <div key={line.id || index} className="grid gap-2 rounded border p-2 md:grid-cols-6">
                <Input value={line.description} onChange={(e) => setLines((prev: any[]) => prev.map((current, idx) => idx === index ? { ...current, description: e.target.value } : current))} />
                <select className="rounded border px-2" value={line.category} onChange={(e) => setLines((prev: any[]) => prev.map((current, idx) => idx === index ? { ...current, category: e.target.value } : current))}>
                  {['LABOR','PARTS','MATERIALS','SUBLET','FEE','STORAGE','DISCOUNT'].map((category) => <option key={category}>{category}</option>)}
                </select>
                <Input type="number" value={line.quantity} onChange={(e) => setLines((prev: any[]) => prev.map((current, idx) => idx === index ? { ...current, quantity: Number(e.target.value) } : current))} />
                <Input type="number" value={line.unitCostCents ?? line.unitPriceCents ?? 0} onChange={(e) => setLines((prev: any[]) => prev.map((current, idx) => idx === index ? { ...current, unitCostCents: Number(e.target.value), unitPriceCents: Number(e.target.value) } : current))} />
                <Input type="number" value={line.laborHours || 0} onChange={(e) => setLines((prev: any[]) => prev.map((current, idx) => idx === index ? { ...current, laborHours: Number(e.target.value) } : current))} />
                <Button variant="destructive" onClick={() => setLines((prev: any[]) => prev.filter((_, idx) => idx !== index))}>Delete</Button>
              </div>
            ))}
          </div>

          <div className="grid gap-2 rounded border bg-muted p-3 md:grid-cols-3">
            <p>Labor: ${(totals.labor / 100).toFixed(2)}</p>
            <p>Parts: ${(totals.parts / 100).toFixed(2)}</p>
            <p>Sublet: ${(totals.sublet / 100).toFixed(2)}</p>
            <p>Materials/Fees: ${(totals.other / 100).toFixed(2)}</p>
            <p>Tax: ${(totals.tax / 100).toFixed(2)}</p>
            <p className="font-bold">Grand Total: ${(totals.total / 100).toFixed(2)}</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveEstimate}>Save Estimate</Button>
            <Button variant="outline" onClick={sendEstimate}>Produce/Send Estimate PDF</Button>
          </div>
        </Card>
      ) : null}

      {tab === "Insurance/Claim" ? (
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Claim Tracking</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="Carrier" value={claimForm.carrierName} onChange={(e) => setClaimForm({ ...claimForm, carrierName: e.target.value })} />
            <Input placeholder="Claim Number" value={claimForm.claimNumber} onChange={(e) => setClaimForm({ ...claimForm, claimNumber: e.target.value })} />
            <Input placeholder="Adjuster Name" value={claimForm.adjusterName} onChange={(e) => setClaimForm({ ...claimForm, adjusterName: e.target.value })} />
            <Input placeholder="Adjuster Email" value={claimForm.adjusterEmail} onChange={(e) => setClaimForm({ ...claimForm, adjusterEmail: e.target.value })} />
            <Input placeholder="Adjuster Phone" value={claimForm.adjusterPhone} onChange={(e) => setClaimForm({ ...claimForm, adjusterPhone: e.target.value })} />
            <Input type="number" placeholder="Approved Amount Cents" value={claimForm.approvedAmountCents} onChange={(e) => setClaimForm({ ...claimForm, approvedAmountCents: Number(e.target.value) })} />
            <Input type="datetime-local" value={claimForm.nextFollowUpAt} onChange={(e) => setClaimForm({ ...claimForm, nextFollowUpAt: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveClaim}>Save Claim</Button>
            <Button variant="outline" onClick={sendInsurancePacket}>Send Insurance Packet</Button>
          </div>
          {job.claim?.shortPayCents ? <p className="text-red-700">Short-pay: ${(job.claim.shortPayCents / 100).toFixed(2)}</p> : null}
        </Card>
      ) : null}

      {tab === "Payments" ? (
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Payments</h3>
          <div className="grid gap-2 md:grid-cols-5">
            <select className="rounded border px-2" value={paymentForm.payerType} onChange={(e) => setPaymentForm({ ...paymentForm, payerType: e.target.value })}>
              <option>INSURANCE</option><option>CUSTOMER</option>
            </select>
            <select className="rounded border px-2" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
              <option>CASH</option><option>CHECK</option><option>CARD</option><option>OTHER</option>
            </select>
            <Input type="number" placeholder="Amount Cents" value={paymentForm.amountCents} onChange={(e) => setPaymentForm({ ...paymentForm, amountCents: Number(e.target.value) })} />
            <Input placeholder="Reference" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
            <Button onClick={addPayment}>Add Payment</Button>
          </div>
          <div className="space-y-2">
            {job.payments.map((entry: any) => (
              <div key={entry.id} className="flex justify-between rounded border p-2 text-sm">
                <span>{entry.payerType} · {entry.method}</span>
                <span>${(entry.amountCents / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === "Docs" ? (
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Documents & Photos</h3>
          <Input type="file" accept="image/*" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
          <div className="grid gap-2 md:grid-cols-2">
            {job.photos.map((photo: any) => (
              <a key={photo.id} href={photo.url} target="_blank" className="rounded border p-2 text-sm hover:bg-muted">Photo: {photo.caption || photo.id}</a>
            ))}
            {job.documents.map((doc: any) => (
              <a key={doc.id} href={doc.url} target="_blank" className="rounded border p-2 text-sm hover:bg-muted">{doc.type}</a>
            ))}
          </div>

          <div className="space-y-2 rounded border p-3">
            <h4 className="font-semibold">Digital Authorization</h4>
            <Input placeholder="Signer Name" value={authForm.signerName} onChange={(e) => setAuthForm({ ...authForm, signerName: e.target.value })} />
            <Input placeholder="Signer Email" value={authForm.signerEmail} onChange={(e) => setAuthForm({ ...authForm, signerEmail: e.target.value })} />
            <Input placeholder="Typed Signature" value={authForm.signatureTyped} onChange={(e) => setAuthForm({ ...authForm, signatureTyped: e.target.value })} />
            <canvas
              ref={canvasRef}
              width={520}
              height={140}
              className="w-full rounded border bg-white"
              onPointerDown={beginDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearSignature}>Clear Signature</Button>
              <Button onClick={saveAuthorization}>Save Authorization</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {tab === "Tasks" ? (
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Tasks</h3>
          <div className="grid gap-2 md:grid-cols-4">
            <select className="rounded border px-2" value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}>
              <option>FOLLOW_UP_ADJUSTER</option>
              <option>FOLLOW_UP_CUSTOMER</option>
              <option>COLLECT_DEDUCTIBLE</option>
              <option>SEND_NOTICE</option>
              <option>OTHER</option>
            </select>
            <Input type="datetime-local" value={taskForm.dueAt} onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })} />
            <Input placeholder="Note" value={taskForm.note} onChange={(e) => setTaskForm({ ...taskForm, note: e.target.value })} />
            <Button onClick={addTask}>Add Task</Button>
          </div>
          <div className="space-y-2">
            {job.tasks.map((task: any) => (
              <div key={task.id} className="rounded border p-2 text-sm">
                <p className="font-semibold">{task.type}</p>
                <p>Due {new Date(task.dueAt).toLocaleString()}</p>
                {task.note ? <p>{task.note}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === "Lien" ? (
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Lien Risk</h3>
          <p>Status: {job.lienCase?.status || "NONE"}</p>
          <p>Reason: {job.lienCase?.riskReason || "-"}</p>
          <div className="max-w-xs space-y-1">
            <label>Storage Start Override</label>
            <Input type="date" value={storageStartDate} onChange={(e) => setStorageStartDate(e.target.value)} />
          </div>
          <p className="text-sm text-muted-foreground">Update status after changing date to recalculate accrual/risk.</p>
          <Button onClick={generateLienNotice}>Generate Notice of Intent</Button>
        </Card>
      ) : null}

      {message ? <p className="rounded border bg-white p-2 text-sm">{message}</p> : null}
    </div>
  );
}
