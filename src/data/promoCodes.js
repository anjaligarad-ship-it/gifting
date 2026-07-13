// Central promo code registry. All validation is server-side only.
// public: false codes are never surfaced in any UI or API response body.
// expiresAt: ISO date string (YYYY-MM-DD) — null means no expiry.
// maxUsesPerCode: total redemptions allowed across all users — null means unlimited.
//   Note: per-account "zero prior orders" enforcement is separate (in apply.js).
export const PROMO_CODES = {
  FIRST: {
    rate: 0.20,
    cap: 60,
    label: '20% off your first order',
    stripeLabel: 'First order — 20% off (capped at £60)',
    public: true,
    expiresAt: null,
    maxUsesPerCode: null,
  },
  GAURAVP: {
    rate: 0.30,
    cap: 60,
    label: '30% off',
    stripeLabel: 'Friends & family — 30% off (capped at £60)',
    public: false,
    expiresAt: null,
    maxUsesPerCode: null,
  },
};
