# Mapbox Setup Guide

This document explains how to set up Mapbox for the EatMe mobile application.

## Token Types Required

### 1. Public Access Token (pk.\*)

- **Purpose**: Used for map rendering and geocoding API calls
- **Visibility**: Can be exposed in client-side code
- **Scopes Needed**:
  - `styles:read` - For map styles
  - `fonts:read` - For map fonts
  - `datasets:read` - For custom data (future)
  - `geocoding:read` - For address search

### 2. Secret Access Token / Downloads Token (sk.\*)

- **Purpose**: Used for downloading the Mapbox SDK in native builds
- **Visibility**: Must be kept secret, used only in build process
- **Scopes Needed**:
  - `downloads:read` - For SDK downloads

## Account Setup Steps

### 1. Create Mapbox Account

1. Go to [https://account.mapbox.com/auth/signup/](https://account.mapbox.com/auth/signup/)
2. Sign up with your email
3. Verify your email address
4. Choose the **Free Tier** to start (includes 50,000 map loads/month)

### 2. Generate Public Access Token

1. Go to [https://account.mapbox.com/access-tokens/](https://account.mapbox.com/access-tokens/)
2. Click "Create a token"
3. Name: `EatMe Mobile App - Public`
4. Select scopes:
   - ✅ `styles:read`
   - ✅ `fonts:read`
   - ✅ `datasets:read`
   - ✅ `geocoding:read`
5. URL restrictions (optional): Add your domains for security
6. Copy the token (starts with `pk.`)

### 3. Generate Downloads Token

1. In the same Access Tokens page
2. Click "Create a token"
3. Name: `EatMe Mobile App - Downloads`
4. Select scopes:
   - ✅ `downloads:read`
5. Copy the token (starts with `sk.`)

## Environment Configuration

### Root Project (.env.local)

```bash
MAPBOX_ACCESS_TOKEN=pk.your_actual_token_here
MAPBOX_DOWNLOADS_TOKEN=sk.your_actual_token_here
```

### Mobile App (.env)

```bash
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_actual_token_here
```

**Note**: Only the public token goes in the mobile app. The downloads token is used during the build process.

## Native Configuration

### iOS Configuration (ios/EatMe/Info.plist)

```xml
<key>MBXAccessToken</key>
<string>$(MAPBOX_DOWNLOADS_TOKEN)</string>
```

### Android Configuration (android/gradle.properties)

```properties
MAPBOX_DOWNLOADS_TOKEN=sk.your_actual_token_here
```

## Security Best Practices

1. **Never commit actual tokens to git**
2. **Use environment variables for all tokens**
3. **Set up URL restrictions on public tokens**
4. **Monitor usage in Mapbox dashboard**
5. **Rotate tokens periodically**

## Usage Monitoring

1. Go to [Mapbox Statistics](https://account.mapbox.com/statistics/)
2. Set up usage alerts:
   - 80% of monthly quota
   - 95% of monthly quota
3. Monitor API calls and map loads

## Cost Estimation

**Free Tier Limits:**

- 50,000 map loads/month
- 100,000 geocoding requests/month
- Unlimited static map requests

**Paid Tiers:** Start at $5/month for additional usage

## Troubleshooting

### Common Issues:

1. **"Unauthorized" errors** - Check token scopes
2. **Build failures** - Verify downloads token is set
3. **Map not loading** - Check public token and network
4. **iOS simulator issues** - Downloads token needed for SDK

---

**Next Steps:**
Once you have both tokens, update the `.env.local` and `apps/mobile/.env` files with your actual values.
