import type { PaymentRecord } from "~/types";

const STORAGE_PREFIX = "fapnus_payments_";
const LAST_PAYMENT_KEY = "fapnus_last_payment";

export const usePaymentHistory = () => {
  const getStorageKey = (address: string) =>
    `${STORAGE_PREFIX}${address.toLowerCase()}`;

  const isAvailable = (): boolean => {
    try {
      localStorage.setItem("__test__", "1");
      localStorage.removeItem("__test__");
      return true;
    } catch {
      return false;
    }
  };

  const addPayment = (
    address: string,
    record: Omit<PaymentRecord, "id">
  ): PaymentRecord => {
    const full: PaymentRecord = {
      ...record,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    if (!isAvailable()) return full;

    const key = getStorageKey(address);
    const existing = getPayments(address);
    existing.unshift(full);
    try {
      localStorage.setItem(key, JSON.stringify(existing));
      localStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify(full));
    } catch {
      /* storage full */
    }
    return full;
  };

  const getPayments = (
    address: string,
    filter?: { type?: "merchant" | "customer"; status?: string }
  ): PaymentRecord[] => {
    if (!isAvailable()) return [];
    try {
      const raw = localStorage.getItem(getStorageKey(address));
      if (!raw) return [];
      let records: PaymentRecord[] = JSON.parse(raw);
      if (filter?.type) records = records.filter((r) => r.type === filter.type);
      if (filter?.status)
        records = records.filter((r) => r.status === filter.status);
      return records.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  };

  const getPaymentById = (
    address: string,
    orderId: string
  ): PaymentRecord | undefined => {
    return getPayments(address).find((r) => r.orderId === orderId);
  };

  const getLastPayment = (): PaymentRecord | null => {
    if (!isAvailable()) return null;
    try {
      const raw = localStorage.getItem(LAST_PAYMENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const clearAll = (address: string): void => {
    if (!isAvailable()) return;
    localStorage.removeItem(getStorageKey(address));
  };

  const formatAmount = (amount: string): string => {
    try {
      const num = Number(BigInt(amount)) / 1_000_000;
      return num.toFixed(2);
    } catch {
      return "0.00";
    }
  };

  return {
    addPayment,
    getPayments,
    getPaymentById,
    getLastPayment,
    clearAll,
    formatAmount,
  };
};
