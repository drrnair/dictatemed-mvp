# VerificationPanel - Quick Start Guide

## Installation Complete ✅

All dependencies have been installed and the component is ready to use.

## Basic Usage

```tsx
import { VerificationPanel } from '@/components/letters';
import type { ExtractedValue, HallucinationFlag } from '@/components/letters';

function MyComponent() {
  const [values, setValues] = useState<ExtractedValue[]>([]);
  const [flags, setFlags] = useState<HallucinationFlag[]>([]);

  return (
    <VerificationPanel
      extractedValues={values}
      hallucinationFlags={flags}
      onVerifyValue={(id) => {
        // Mark value as verified
      }}
      onVerifyAll={() => {
        // Verify all values
      }}
      onDismissFlag={(id, reason) => {
        // Dismiss flag with reason
      }}
      onValueClick={(id) => {
        // Navigate to source
      }}
    />
  );
}
```

## Example Data

See `/src/components/letters/VerificationPanel.example.tsx` for a complete working example with mock data.

Run the example:
```tsx
import { VerificationPanelExample } from '@/components/letters/VerificationPanel.example';

// Use in your app
<VerificationPanelExample />
```

## Key Props

### extractedValues
Array of clinical values extracted from transcript:
```typescript
{
  id: 'val-1',
  category: 'cardiac_function', // or coronary_disease, valvular, medication, procedural
  name: 'LVEF',
  value: '55',
  unit: '%',
  sourceAnchorId: 'anchor-id',
  verified: false,
  critical: true  // Must be verified before approval
}
```

### hallucinationFlags
Array of AI-detected potential hallucinations:
```typescript
{
  id: 'flag-1',
  flaggedText: 'Text that might be hallucinated',
  reason: 'Why it was flagged',
  severity: 'critical', // or 'warning'
  dismissed: false,
  dismissedReason: undefined
}
```

## Categories

- `cardiac_function` - LVEF, chamber sizes, wall motion
- `coronary_disease` - Stenosis percentages, vessel disease
- `valvular` - Valve areas, gradients, regurgitation
- `medication` - Drug names, doses, frequencies
- `procedural` - Stent sizes, procedure types

## Critical Values

Mark these as `critical: true`:
- LVEF (ejection fraction)
- Stenosis percentages (>50%)
- Critical valve measurements
- Anticoagulant doses

## Testing

```bash
# Run unit tests
npm test VerificationPanel.test.tsx

# Run with coverage
npm test:coverage

# E2E tests
npm run test:e2e
```

## Styling

The component uses clinical color scheme:
- Verified: Green (bg-clinical-verified)
- Unverified: Yellow (bg-clinical-warning)
- Critical: Red (bg-clinical-critical)

## Accessibility

Fully accessible with:
- Keyboard navigation (Tab through values)
- Screen reader support (ARIA labels)
- Focus indicators
- Color-independent design

## Files Reference

- **VerificationPanel.tsx** - Main component (523 lines)
- **VerificationPanel.example.tsx** - Working example
- **VerificationPanel.test.tsx** - Test suite
- **README.md** - Full documentation
- **IMPLEMENTATION_SUMMARY.md** - Implementation details

## Already Integrated

The component is already being used in:
```
/src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx
```

## Support

For detailed documentation, see:
- README.md - Complete integration guide
- IMPLEMENTATION_SUMMARY.md - Technical specifications
- VerificationPanel.example.tsx - Working code example

---

**Component is production-ready. Start integrating today!**
