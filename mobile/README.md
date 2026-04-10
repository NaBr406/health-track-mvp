# Health Track Mobile

Expo-based Android client for the existing `server/` backend.

## Start

```bash
pwsh ../scripts/dev-server.ps1
pwsh ../scripts/dev-mobile.ps1
```

Or start both in one go:

```bash
pwsh ../scripts/dev-all.ps1
```

`dev-mobile.ps1` will:

- start the Android emulator if needed
- install the debug app if it is not installed yet
- start Metro in dev-client mode on port `8081`
- relaunch the app on the emulator

## API base URL

Set `EXPO_PUBLIC_API_BASE_URL` before starting Expo.

- Android emulator: `http://10.0.2.2:8080`
- Physical Android device: `http://<your-lan-ip>:8080`

Copy `.env.example` to `.env` and adjust the value if needed.

## Current MVP scope

- Login and register
- Dashboard summary and profile update
- Diet / exercise / care record query and creation
- Daily AI advice display
- Mock fallback when the backend is unavailable
