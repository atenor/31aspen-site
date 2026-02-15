import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type PdfLine = { label: string; value: string };

async function baseDocument(title: string, lines: PdfLine[]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText(title, {
    x: 48,
    y: 740,
    size: 22,
    font: bold,
    color: rgb(0.1, 0.2, 0.35)
  });

  let y = 700;
  for (const line of lines) {
    page.drawText(line.label, { x: 48, y, size: 10, font: bold, color: rgb(0.2, 0.25, 0.3) });
    page.drawText(line.value, { x: 220, y, size: 10, font, color: rgb(0.2, 0.25, 0.3) });
    y -= 22;
  }

  return pdf.save();
}

export async function generateEstimatePdf(data: {
  jobNumber: string;
  customerName: string;
  vehicle: string;
  totalWritten: string;
  notes?: string;
}) {
  return baseDocument("Customer Estimate / Quote", [
    { label: "Job #", value: data.jobNumber },
    { label: "Customer", value: data.customerName },
    { label: "Vehicle", value: data.vehicle },
    { label: "Total Written", value: data.totalWritten },
    { label: "Notes", value: data.notes || "-" }
  ]);
}

export async function generateInsurancePacketPdf(data: {
  jobNumber: string;
  carrier: string;
  claimNumber: string;
  customerName: string;
  estimateTotal: string;
}) {
  return baseDocument("Insurance Packet", [
    { label: "Job #", value: data.jobNumber },
    { label: "Carrier", value: data.carrier },
    { label: "Claim #", value: data.claimNumber },
    { label: "Customer", value: data.customerName },
    { label: "Estimate Total", value: data.estimateTotal }
  ]);
}

export async function generateAuthorizationPdf(data: {
  jobNumber: string;
  signerName: string;
  signedAt: string;
  signerIp: string;
}) {
  return baseDocument("Repair Authorization", [
    { label: "Job #", value: data.jobNumber },
    { label: "Signer", value: data.signerName },
    { label: "Signed At", value: data.signedAt },
    { label: "Signer IP", value: data.signerIp }
  ]);
}

export async function generateLienNoticePdf(data: {
  jobNumber: string;
  customerName: string;
  balanceDue: string;
  reason: string;
}) {
  return baseDocument("Notice of Intent to Lien", [
    { label: "Job #", value: data.jobNumber },
    { label: "Customer", value: data.customerName },
    { label: "Balance Due", value: data.balanceDue },
    { label: "Reason", value: data.reason }
  ]);
}

export async function generateLienItemizedStatementPdf(data: {
  jobNumber: string;
  customerName: string;
  laborSubtotal: string;
  partsSubtotal: string;
  subletSubtotal: string;
  otherSubtotal: string;
  taxSubtotal: string;
  grandTotal: string;
  paymentsReceived: string;
  balanceDue: string;
}) {
  return baseDocument("Lien Itemized Statement", [
    { label: "Job #", value: data.jobNumber },
    { label: "Customer", value: data.customerName },
    { label: "Labor Subtotal", value: data.laborSubtotal },
    { label: "Parts Subtotal", value: data.partsSubtotal },
    { label: "Sublet Subtotal", value: data.subletSubtotal },
    { label: "Materials/Fees", value: data.otherSubtotal },
    { label: "Tax", value: data.taxSubtotal },
    { label: "Grand Total", value: data.grandTotal },
    { label: "Payments Received", value: data.paymentsReceived },
    { label: "Balance Due", value: data.balanceDue }
  ]);
}
