// Central promo code registry. Add codes here — they are validated server-side only.
// public: false codes are never surfaced in any UI or API response body.
export const PROMO_CODES = {
  FIRST: {
    rate: 0.20,
    cap: 60,
    label: '20% off your first order',
    stripeLabel: 'First order — 20% off (capped at £60)',
    public: true,
  },
  GAURAVP: {
    rate: 0.30,
    cap: 60,
    label: '30% off',
    stripeLabel: 'Friends & family — 30% off (capped at £60)',
    public: false,
  },
};
