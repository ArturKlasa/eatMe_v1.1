# Rough Idea: Admin Restaurant Data Ingestion Improvement

## Problem Statement
The current admin restaurant data ingestion in the web-portal is slow and unreliable. Admins must create restaurants one-at-a-time via a comprehensive form — there is no bulk/batch import capability.

## Current State
- **Single restaurant creation:** Admin fills a multi-field form (name, address, location, hours, cuisines, payment methods, etc.) and submits one record at a time.
- **Menu data via AI vision only:** Dishes are extracted from uploaded menu images using GPT-4o. No structured data import (CSV, JSON).
- **Non-transactional inserts:** Restaurant + menu + dish creation spans multiple sequential DB calls without transaction wrapping.
- **No batch validation:** Each restaurant is validated independently.
- **Incomplete audit trail:** Suspend/activate actions lack audit logging (marked TODO).
- **No templates:** No way to pre-populate common field sets (e.g., operating hours, service options).

## Desired Outcome
A faster, more reliable admin data ingestion system that supports:
- Bulk restaurant import (CSV/JSON/structured data)
- Batch validation with clear error reporting
- Transactional integrity for multi-step inserts
- Streamlined single-restaurant creation
- Better audit logging and error handling

## Scope
Focus on **Admin data ingestion** only (not partner onboarding or public-facing features).
