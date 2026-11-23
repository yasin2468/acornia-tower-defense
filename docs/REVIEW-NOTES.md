# App Review Notes — Acornia: Tower Defense (v1.0.0)

## App Summary
**Acornia: Tower Defense** (Turkish title: **Acornia: Kule Savunması**) is an offline-first 3D woodland tower defense strategy game designed for portrait mobile play.

## Demo Account & Login
- **No login or account required:** The app launches directly into the playable world map without authentication.
- `ONLINE_ARENA_ENABLED` and `MONETIZATION_ENABLED` are both disabled (`false`) in v1.0.0. The app requires zero network calls to play all 50 campaign stages, Iron Mode, Daily Mutator Challenge, Endless Siege, and Lost Forest Expedition.

## Navigation for Reviewers
1. **Start Gameplay:** Tap Stage 1 ("1. Yosun Geçidi" / "1. Mossy Crossing") on the bottom drawer and tap **Start Defense** ("SAVUNMAYA BAŞLA").
2. **Place Towers & Play:** Tap any glowing circular slot, choose a tower (Squirrel, Beaver, Owl, Hedgehog, etc.), tap again to build, move your Hero by tapping the path, and tap **Start Wave**.
3. **Progression & Economy:** In-game Palamut coins and Emerald Gems are earned solely through gameplay rewards and free in-app chests; no real-money payments or third-party ad SDKs are active in this build.
4. **Local Data & Reset:** All progress stays locally on the device (`localStorage`). Reviewers and players can export backup codes or erase all local progress inside Settings (top-right gear icon) via **Reset Save**, plus view the bundled **Privacy Policy** (`privacy-policy.html`) and **Support** (`support.html`) links.

## Contact Information
- Support Email: `support@acorniagame.com`
- Privacy Policy: `https://yasin2468.github.io/acornia-tower-defense/privacy-policy.html`
- Support URL: `https://yasin2468.github.io/acornia-tower-defense/support.html`
