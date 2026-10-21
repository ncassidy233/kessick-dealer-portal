/*
 * Dealer vouchers and when they apply.
 *
 * There is no checkout yet: dealers order through quote and design requests.
 * A voucher that applies is added to the request automatically, so Kessick
 * discounts the quote. A future checkout should call the same
 * `applicableVouchers` so the rule lives in one place.
 */

export type Voucher = {
  id: string;
  percentOff: number;
  title: string;
  appliesTo: string;
  /** Last day the voucher is valid, inclusive, Eastern time (Kessick is in Greenville, SC). */
  expires: string;
  expiresLabel: string;
};

export const SOMM_VOUCHER: Voucher = {
  id: "somm-15-2026",
  percentOff: 15,
  title: "15% Discount Voucher",
  appliesTo: "Somm projects",
  expires: "2026-11-30T23:59:59-05:00",
  expiresLabel: "Nov 30, 2026",
};

export const isVoucherActive = (v: Voucher, now = new Date()) =>
  now.getTime() <= new Date(v.expires).getTime();

/** Vouchers that apply to a request, given what the dealer told us about it. */
export function applicableVouchers(request: { sommProject: boolean }, now = new Date()): Voucher[] {
  return request.sommProject && isVoucherActive(SOMM_VOUCHER, now) ? [SOMM_VOUCHER] : [];
}

/** The line Kessick sees on the request so the quote gets discounted. */
export const voucherLine = (v: Voucher) =>
  `Voucher applied: ${v.title} (${v.percentOff}% off ${v.appliesTo}, valid through ${v.expiresLabel}). Please apply it to this quote.`;
