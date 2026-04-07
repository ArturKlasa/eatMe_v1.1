---
name: Daily menu is a separate feature
description: scheduleType filtering (daily/rotating menus) will be built as its own feature, not part of DailyFilterModal
type: project
---

Daily menu filtering (schedule_type = 'daily' | 'rotating') will be a separate feature from DailyFilterModal.

**Why:** DailyFilterModal is for quick session-based food preferences (price, diet, cuisine, meal). Daily/rotating menu discovery is a different user intent.

**How to apply:** Don't add scheduleType UI to DailyFilterModal. The backend RPC and edge function already support it — the frontend feature will be built separately.
