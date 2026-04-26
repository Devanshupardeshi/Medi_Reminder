# MediReminder India — React Native (Expo) App

Mobile companion for the **MediReminder India** FastAPI backend. Email-OTP
sign-in, prescription scanning, dose tracking, caregiver alerts, and
adherence reporting. Gemini OCR + literacy + food advisory all run on the
**server** — no API keys live on the device.

---

## Backend connection

The mobile app talks to a single FastAPI service. Configure once via
`EXPO_PUBLIC_BACKEND_URL`; the default in `src/config/env.ts` is the
hosted Render deployment:

```
https://iit-pune-hackathon-backend.onrender.com
```

Override at build time:

```bash
# react_native_app/.env
EXPO_PUBLIC_BACKEND_URL=https://your-deploy.example.com
```

That's it — there is no Gemini API key to paste. Sign in with email,
verify the 6-digit OTP, and the app stores a JWT in Keychain/Keystore.

---

## Phase plan

The app is being delivered in **6 small, fully-working phases** so each
ships green without breaking the previous one:

| # | Phase | Surfaces | Endpoints |
|---|-------|----------|-----------|
| **1** | Foundation, OTP auth, empty Home | Welcome, Email, OTP, Home (empty), Medicines/Family/Reports placeholders, More/Settings | `/auth/otp/{request,resend,verify}`, `/users/profile` |
| 2 | Prescription scan + OCR review | Add Prescription (camera/gallery), OCR Review & Edit | `POST /prescriptions/upload`, `POST /prescriptions/{id}/confirm` |
| 3 | Today + medicines | Populated Home dashboard, Medicine Detail, Reminder Action | `GET /doses/day`, `POST /doses/log` |
| 4 | Family / Caregivers | Family list + visibility toggles | `/caregivers` CRUD |
| 5 | Reports & history | Adherence heatmap, day drill-down, PDF export, WhatsApp share | `GET /doses/calendar`, `GET /doses/day` |
| 6 | AI agent surfaces | Literacy & food conflict cards, voice reminder | (uses `analysis.literacy` / `analysis.food` from upload) |

**Currently shipped: Phase 1.** Phases 2–6 follow without breaking
the bundle — every tab already routes to a screen.

---

## 1. Architecture

```
react_native_app/
├── app/                        ← expo-router file-based routes
│   ├── _layout.tsx             ← root stack + auth redirect
│   ├── index.tsx               ← redirects to /auth/welcome or /(tabs)/home
│   ├── auth/
│   │   ├── welcome.tsx         ← brand splash + "Sign in with email"
│   │   ├── email.tsx           ← email entry → POST /auth/otp/request
│   │   └── otp.tsx             ← 6-digit OTP → POST /auth/otp/verify
│   └── (tabs)/
│       ├── _layout.tsx         ← Home / Medicines / Family / Reports / More
│       ├── home.tsx            ← empty Getting-Started state (Phase 1)
│       ├── medicines.tsx       ← Phase 3 placeholder
│       ├── family.tsx          ← Phase 4 placeholder
│       ├── reports.tsx         ← Phase 5 placeholder
│       └── settings.tsx        ← profile name + sign out
├── src/
│   ├── config/env.ts           ← BACKEND_URL, APP_NAME, DEFAULT_TZ
│   ├── services/
│   │   ├── apiClient.ts        ← fetch wrapper, JWT, 401 handler
│   │   ├── authApi.ts          ← /auth/* and /users/profile
│   │   ├── secureStorage.ts    ← Keychain/Keystore wrapper for JWT + user
│   │   └── notificationService.ts  ← daily local reminders (Phase 3)
│   ├── state/
│   │   ├── authStore.ts        ← zustand: hydrate, signIn, signOut, refresh
│   │   └── medicinesStore.ts   ← skeleton (filled in Phase 3)
│   ├── theme/colors.ts         ← navy / green / status palette
│   ├── types/                  ← `auth.ts`, `medicine.ts` (backend shapes)
│   └── ui/
│       ├── Primitives.tsx      ← Screen, TText, Card, Button, Badge, Divider
│       └── AppHeader.tsx       ← navy app header with brand + profile
└── README.md
```

---

## 2. Color & icon system

Extracted directly from the official mockups:

| Token | Hex | Use |
|-------|-----|-----|
| `brand.navy` | `#1E3A5F` | Headers, secondary buttons |
| `brand.green` | `#16A34A` | Primary CTA, "Taken" status |
| `status.partial` | `#F59E0B` | Partial adherence |
| `status.missed` | `#DC2626` | Missed dose / errors |
| `surface.background` | `#F4F6F8` | Page background |
| `surface.card` | `#FFFFFF` | Cards |
| `text.primary` | `#1E293B` | Body |
| `text.secondary` | `#64748B` | Captions |

Icons come from `@expo/vector-icons` (`Ionicons` for chrome,
`MaterialCommunityIcons` for `pill`, `prescription`, `line-scan`).

---

## 3. Run locally (Expo dev build)

```bash
cd react_native_app
npm install
npx expo start --dev-client     # opens Metro
npx expo run:android            # build + install debug on connected device
```

The default backend is the team tunnel — open the app, enter your email,
and watch your inbox for the 6-digit OTP.

### Build a release APK (no Metro needed)

```bash
npx expo run:android --variant release
```

Output: `android/app/build/outputs/apk/release/app-release.apk`.

---

## 4. Common issues

| Symptom | Fix |
|---------|-----|
| Red screen: *Unable to load script* | Debug APK with no Metro running. Build a release APK with `npx expo run:android --variant release`, or start Metro with `npx expo start --dev-client` (and `adb reverse tcp:8081 tcp:8081` on USB). |
| `Network error. Is the backend reachable?` | The Render service may be cold-starting. Check `https://iit-pune-hackathon-backend.onrender.com/health` in a browser; expect `{"status":"ok"}`. First request after idle can take 30-50s. |
| OTP email never arrives | Backend SMTP misconfig. Test with `curl -X POST $BACKEND_URL/auth/otp/request -H "Content-Type: application/json" -d '{"email":"you@x.com"}'`. |
| 401 mid-session | Access token expired (JWT lifetime is server-configured). The app auto-signs-out on 401 and routes back to `/auth/welcome`. |
| `Could not find NDK ... 26.1.10909125` | Android Studio → Settings → SDK Tools → check "NDK (Side by side) 26.1.10909125" + "CMake 3.22.1" → Apply. |

---

## 5. What lands in Phase 2

- `Add Prescription` screen (camera + gallery via `expo-image-picker`)
- Multipart upload to `POST /prescriptions/upload`
- OCR Review screen rendering `analysis.vision.medicines[]` with editable
  name / dose / frequency / `reminder_times_24h`
- "Confirm Medicine & Add Times" → `POST /prescriptions/{id}/confirm`
- After confirm, the medicines flow into the (still-empty) Today list,
  ready for Phase 3 to wire `/doses/day`.
