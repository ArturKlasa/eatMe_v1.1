# Research: GPT-4o Vision Prompt Engineering for Menu Extraction

## Key Recommendations

### 1. Switch to Structured Outputs (CRITICAL)
Current code uses `response_format: { type: 'json_object' }` which only guarantees valid JSON, not schema adherence. Switch to `response_format: { type: 'json_schema', json_schema: { name: 'menu_extraction', strict: true, schema: { ... } } }`.
- Scores 100% on schema compliance vs ~40% without
- Eliminates the `repairTruncatedJson` workaround
- Compatible with vision inputs as of gpt-4o-2024-08-06
- Use Zod + `zodResponseFormat()` from `openai/helpers/zod`

### 2. Move Schema Out of Prompt
Place JSON schema in `response_format.json_schema`, not in the prompt text. Saves ~500 tokens and improves compliance.

### 3. Prompt Structure (in order)
1. Role/task description
2. Extraction rules as numbered decision tree
3. 2-3 few-shot examples (text-only, not images)
4. Schema goes in API parameter, not prompt

### 4. Pattern Detection as Decision Tree
Order matters — earlier rules have higher priority:
1. **Template** (build-your-own): "choose your..." / "pick a base" / shared heading with protein list
2. **Combo/bundle**: "Lunch combo" / "Set menu" / "includes X + Y + Z"
3. **Experience**: "All-you-can-eat" / "Hot pot" / "BBQ" / per-person pricing
4. **Size variants**: Same dish with S/M/L → parent with variants, NOT separate dishes
5. **Market price**: "MP" / "Market price" → price=null, display_price_prefix='market_price'
6. **Family/sharing**: "For 2-3" / "Para compartir" → serves=N
7. **Standard**: default

### 5. Few-Shot Examples
2-3 examples is the sweet spot:
- One common case (standard dishes)
- One hard case (template with variants)
- One combo case (optional)
Focus on classification logic, not JSON formatting (schema handles that).

### 6. Edge Cases
- **Partially obscured**: "Extract what is visible, set confidence to 0.5. Never guess obscured characters."
- **Mixed languages**: Keep original language. GPT-4o handles Spanish/English well.
- **Handwritten**: Use `detail: high` always. Consider hybrid OCR pipeline for poor quality.
- **Counting**: Add "Count total dishes before extracting" to reduce skipping.

### 7. Known Limitations
- Hallucinated text (especially small/low-contrast). Mitigation: confidence scores + filter <0.5
- Character confusion ("S"→"5", "I"→"l"). Prices vulnerable.
- Truncation on 100+ dish menus. Structured Outputs helps with token planning.
- Below ~720px width, accuracy drops significantly.

### 8. Prompt Size
- Moving schema to `response_format` saves ~500 tokens
- Decision tree format is more compact than prose paragraphs
- 3 examples add ~800-1200 tokens — well within budget
- Total system prompt target: ~2000 tokens (rules + examples)
