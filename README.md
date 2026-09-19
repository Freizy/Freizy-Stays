# FREIZY STAYS — Intelligence Finds You Home

Hostel booking MVP for Ghanaian students. Brand: Freizy Technologies · Red `#E30613` · White · Black.

## Stack (hybrid per approved plan)

| Layer | Tech |
|---|---|
| App | Expo React Native + TypeScript, React Navigation, Zustand |
| API | Node.js + Express + TypeScript, Prisma |
| DB/Auth/Storage | Supabase Postgres + Supabase Auth (phone OTP + Google) |
| Media (video tours) | Cloudinary |
| Payments | MTN MoMo API + Paystack (sandbox first), escrow logic in Node |
| Maps | Google Maps API |

## Monorepo

```
apps/mobile   Expo app (student + owner + admin flows)
apps/server   Express API (auth, hostels, bookings, payments escrow, verify)
packages/shared  Shared TS types + constants (schools, filters, brand)
```

## Quick start

1. Copy env: `cp .env.example .env` then fill Supabase keys.
2. Install: `npm install` (uses npm workspaces + turbo).
3. DB: `npm run db:push` (points Prisma at Supabase Postgres).
4. Dev: `npm run dev:server` + `npm run dev:mobile`.

## MVP scope (6 weeks)

- W1-2: Auth (OTP/Google) + Add Hostel + Home Feed + 5 filter chips
- W3-4: Detail + Booking (Full vs MoMo 4x) + Escrow + MoMo sandbox
- W5: Owner + Admin dashboards + Verified badge toggle
- W6: Pilot with 10 Legon hostels

Priority #1: MoMo works + Verified badge shows. No AI matcher (filters only), no chat (WhatsApp button), no 360 stitch (plain video upload).

## Supabase free-tier note

Free is fine for W1-4 dev. Before pilot with real money: upgrade to Pro ($25/mo), move videos to Cloudinary, bring SMS provider credit (Arkesel/Twilio) for OTP.

## Ship with EAS (APK for pilot testers)
1. `npm i -g eas-cli && eas login`
2. `cd apps/mobile && eas init` (creates the EAS project ID)
3. Pilot APK: `eas build -p android --profile preview` — share the download link / QR with testers
4. Stores: `eas build -p android --profile production` (+ `ios`), then `eas submit`
5. Android Maps in production builds needs a Google Maps key: add it to EAS secrets as `GOOGLE_MAPS_API_KEY` (Expo Go needs none)

## Auth & push setup (Supabase dashboard)

- **Google login:** Authentication > Providers > enable Google (needs a Google Cloud OAuth client ID), then add `freizystays://auth/callback` under Authentication > URL Configuration > Redirect URLs
- **Apple login:** Authentication > Providers > enable Apple (needs an Apple Services ID + Team ID + private key from developer.apple.com), same redirect URL as Google
- **Push notifications:** no dashboard setup — the app registers its Expo push token on login (`POST /auth/push-token`) and the API notifies on booking requests, approvals/rejections, payment success, SOS reports, and escrow release. Test with a physical device (simulators can't receive push).
