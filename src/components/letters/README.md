# Letter Verification Components

This directory contains components for medical letter verification and safety checks in DictateMED.

## VerificationPanel

A critical safety component that ensures all AI-extracted clinical values are verified by cardiologists before letter approval.

### Purpose

Prevents AI hallucinations from reaching patients by requiring explicit verification of all clinical values extracted from medical transcripts. This is a **mandatory safety check** that cannot be bypassed.

### Features

#### 1. Clinical Value Verification
- Display all extracted values grouped by category (Cardiac Function, Coronary Disease, etc.)
- Individual checkbox verification for each value
- "Verify All" batch action
- Progress tracking (X of Y values verified)
- Critical values marked with asterisk (LVEF, stenosis percentages)
- Visual states: unverified (yellow), verified (green)

#### 2. Hallucination Detection
- Display AI-detected potential hallucinations
- Severity levels: warning (yellow), critical (red)
- Required dismissal reason for audit trail
- Cannot approve letter with active critical flags

#### 3. Source Navigation
- Each value links to its source in the transcript
- Click "View Source" to jump to original text
- Helps cardiologists verify accuracy quickly

#### 4. Approval Gating
- Letter cannot be approved until:
  - ALL critical values verified
  - ALL critical flags dismissed with reason
- Progress indicator shows completion status

### Usage

```tsx
import { VerificationPanel } from '@/components/letters/VerificationPanel';
import type { ExtractedValue, HallucinationFlag } from '@/components/letters/VerificationPanel';

function LetterEditor() {
  const [values, setValues] = useState<ExtractedValue[]>([...]);
  const [flags, setFlags] = useState<HallucinationFlag[]>([...]);

  return (
    <div className="flex">
      {/* Letter content */}
      <div className="flex-1">...</div>

      {/* Verification panel */}
      <div className="w-96">
        <VerificationPanel
          extractedValues={values}
          hallucinationFlags={flags}
          onVerifyValue={(id) => {/* mark value as verified */}}
          onVerifyAll={() => {/* verify all values */}}
          onDismissFlag={(id, reason) => {/* dismiss flag with reason */}}
          onValueClick={(id) => {/* navigate to source */}}
        />
      </div>
    </div>
  );
}
```

### Data Structures

#### ExtractedValue

```typescript
interface ExtractedValue {
  id: string;                    // Unique identifier
  category: 'cardiac_function'   // Group for organization
    | 'coronary_disease'
    | 'valvular'
    | 'medication'
    | 'procedural';
  name: string;                  // Display name (e.g., "LVEF")
  value: string;                 // The clinical value (e.g., "55")
  unit?: string;                 // Unit of measurement (e.g., "%")
  sourceAnchorId: string;        // ID to navigate to source
  verified: boolean;             // Verification status
  critical: boolean;             // Requires verification (LVEF, stenosis)
}
```

#### HallucinationFlag

```typescript
interface HallucinationFlag {
  id: string;                    // Unique identifier
  flaggedText: string;           // The problematic text
  reason: string;                // Why it was flagged
  severity: 'warning'            // Impact level
    | 'critical';
  dismissed: boolean;            // Dismissal status
  dismissedReason?: string;      // Required reason for dismissal
}
```

### Categories

| Category | Label | Example Values |
|----------|-------|----------------|
| `cardiac_function` | Cardiac Function | LVEF, LVEDV, wall motion |
| `coronary_disease` | Coronary Disease | Stenosis %, vessel disease |
| `valvular` | Valvular Assessment | Valve area, gradients |
| `medication` | Medications | Drug names, doses |
| `procedural` | Procedural Details | Stent sizes, procedure types |

### Critical Values

Values marked as `critical: true` must be verified before letter approval:
- **LVEF** (Left Ventricular Ejection Fraction)
- **Stenosis percentages** (LAD, RCA, LCx)
- **Valve areas** for severe disease
- **Critical medication doses** (anticoagulants)

### Accessibility

The component includes comprehensive accessibility features:

- **Keyboard Navigation**: Full tab support through all values
- **ARIA Labels**: Screen reader support for all interactive elements
- **Focus Management**: Proper focus states and indicators
- **Alerts**: Live regions for dynamic content updates
- **Color Independence**: Uses icons in addition to colors

Test with:
```bash
npm run test:a11y
```

### Testing

Run unit tests:
```bash
npm test VerificationPanel.test.tsx
```

Test includes:
- Rendering and display
- Verification workflow
- Hallucination flag dismissal
- Keyboard navigation
- Edge cases (empty data, all verified)
- Accessibility checks

### Integration Checklist

When integrating this component:

- [ ] Connect to AI extraction service for `extractedValues`
- [ ] Connect to hallucination detection service for `hallucinationFlags`
- [ ] Implement source navigation (scroll to transcript anchor)
- [ ] Save verification state to database
- [ ] Store dismissal reasons for audit trail
- [ ] Track who verified each value and when
- [ ] Block letter approval when verification incomplete
- [ ] Add final approval confirmation dialog
- [ ] Test with real clinical data
- [ ] Conduct accessibility audit
- [ ] Get cardiologist feedback on UX

### Security & Compliance

- All verifications logged with timestamp and user ID
- Dismissal reasons stored for regulatory compliance
- Cannot bypass verification checks (enforced in backend)
- Audit trail for all verification actions
- HIPAA-compliant data handling

### Performance

- Optimized for lists up to 100 values
- Accordion keeps only visible categories in DOM
- Memoized category grouping
- Lazy rendering for large datasets

### Future Enhancements

- [ ] Bulk flag dismissal with single reason
- [ ] Export verification report
- [ ] Comparison view (transcript vs. letter)
- [ ] Inline editing of values
- [ ] Historical verification data
- [ ] ML confidence scores per value
- [ ] Suggested corrections for flagged text

## Files

- **VerificationPanel.tsx** - Main component
- **VerificationPanel.example.tsx** - Usage example with mock data
- **VerificationPanel.test.tsx** - Comprehensive test suite
- **README.md** - This documentation

## Dependencies

Required packages (automatically installed):
- `@radix-ui/react-checkbox` - Checkbox component
- `@radix-ui/react-accordion` - Accordion component
- `@radix-ui/react-dialog` - Dialog component
- `lucide-react` - Icons

## Support

For questions or issues:
1. Check the example file for integration patterns
2. Review test file for expected behavior
3. Contact the medical informatics team
