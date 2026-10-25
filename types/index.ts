export interface PaymentRecord {
  id: string;
  type: "merchant" | "customer";
  orderId: string;
  merchant: string;
  payer: string;
  amount: string; // stored as string (BigInt serialisation)
  timestamp: number;
  status: "success" | "pending" | "failed";
  txHash?: string;
  blockNumber?: number;
}

export type PaymentStatus = "idle" | "waiting" | "processing" | "success" | "error";
