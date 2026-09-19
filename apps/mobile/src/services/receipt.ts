import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

/** Build a branded PDF receipt and open the share sheet. */
export async function saveReceiptPdf(p: {
  amount: number;
  provider: string;
  reference: string;
  status: string;
  createdAt?: string;
  booking?: { id: string; hostel?: { name: string } | null };
}): Promise<void> {
  const date = p.createdAt ? new Date(p.createdAt).toLocaleString() : new Date().toLocaleString();
  const html = `
    <html><body style="font-family: sans-serif; padding: 32px; color: #111;">
      <div style="background: #0A0A0A; color: #fff; padding: 20px; border-radius: 12px;">
        <div style="font-size: 22px; font-weight: 800;">FREIZY STAYS</div>
        <div style="color: #E30613; font-weight: 700;">Intelligence Finds You Home</div>
      </div>
      <h2>Payment Receipt</h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${row("Hostel", p.booking?.hostel?.name ?? "—")}
        ${row("Amount", `GH₵ ${Number(p.amount ?? 0).toLocaleString()}`)}
        ${row("Method", String(p.provider).replace("_", " "))}
        ${row("Reference", p.reference)}
        ${row("Status", p.status)}
        ${row("Booking", (p.booking?.id ?? "").slice(0, 8))}
        ${row("Date", date)}
      </table>
      <p style="margin-top: 24px; color: #555;">Your money is safe with Freizy. The owner is paid only after you move in and confirm.</p>
    </body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device");
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Freizy receipt" });

  function row(k: string, v: string): string {
    return `<tr><td style="padding: 8px 0; color: #666;">${k}</td><td style="padding: 8px 0; font-weight: 700; text-align: right;">${v}</td></tr>`;
  }
}
