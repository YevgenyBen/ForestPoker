/**
 * Buy-out rows store the **full amount** taken back out (not profit). Net = sum(buy_out) - sum(buy_in).
 * Greedy matching minimizes transfer count (at most N-1 for N nonzero balances).
 */
export type Transfer = {
  fromUserId: string;
  toUserId: string;
  amountNis: number;
};

export function computeNetByUser(
  ledger: { userId: string; kind: "buy_in" | "buy_out"; amountNis: number }[]
): Map<string, number> {
  const net = new Map<string, number>();
  for (const row of ledger) {
    const delta =
      row.kind === "buy_out" ? row.amountNis : -row.amountNis;
    net.set(row.userId, (net.get(row.userId) ?? 0) + delta);
  }
  return net;
}

export function netSum(net: Map<string, number>): number {
  let s = 0;
  for (const v of net.values()) s += v;
  return s;
}

export function minimizeTransfers(
  netByUser: Map<string, number>
): Transfer[] {
  const debtors: { id: string; amt: number }[] = [];
  const creditors: { id: string; amt: number }[] = [];
  for (const [id, n] of netByUser) {
    if (n < 0) debtors.push({ id, amt: -n });
    else if (n > 0) creditors.push({ id, amt: n });
  }
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);
  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(d.amt, c.amt);
    if (pay > 0) {
      transfers.push({
        fromUserId: d.id,
        toUserId: c.id,
        amountNis: pay,
      });
    }
    d.amt -= pay;
    c.amt -= pay;
    if (d.amt === 0) i++;
    if (c.amt === 0) j++;
  }
  return transfers;
}
