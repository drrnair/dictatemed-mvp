// src/domains/letters/phi-obfuscation.ts
// PHI obfuscation and de-obfuscation for safe LLM processing

import { logger } from '@/lib/logger';

/**
 * Protected Health Information (PHI) that must be obfuscated.
 */
export interface PHI {
  name: string;
  dateOfBirth: string; // ISO format or human-readable
  medicareNumber?: string | undefined;
  gender?: string | undefined;
  address?: string | undefined;
  phoneNumber?: string | undefined;
  email?: string | undefined;
}

/**
 * Obfuscated tokens that replace PHI in prompts sent to LLM.
 */
export interface ObfuscatedTokens {
  nameToken: string; // e.g., "PATIENT_001"
  dobToken: string; // e.g., "DOB_001"
  medicareToken: string; // e.g., "MEDICARE_001"
  genderToken: string; // e.g., "GENDER_001"
  addressToken?: string; // e.g., "ADDRESS_001"
  phoneToken?: string; // e.g., "PHONE_001"
  emailToken?: string; // e.g., "EMAIL_001"
}

/**
 * Mapping to reverse obfuscation after LLM generation.
 */
export interface DeobfuscationMap {
  tokens: ObfuscatedTokens;
  phi: PHI;
  extraMappings?: Map<string, string>; // For additional entities found in text
}

/**
 * Result of obfuscation operation.
 */
export interface ObfuscationResult {
  obfuscatedText: string;
  deobfuscationMap: DeobfuscationMap;
  tokensReplaced: number;
}

/**
 * Obfuscate PHI in text by replacing with tokens.
 *
 * This function:
 * 1. Generates unique tokens for each PHI field
 * 2. Replaces all occurrences of PHI in the text with tokens
 * 3. Returns obfuscated text and mapping for reversal
 *
 * IMPORTANT: This is defense-in-depth. The letter should NOT contain
 * real PHI in the final output, but this prevents accidental leakage
 * if the LLM hallucinates or incorrectly references sources.
 */
export function obfuscatePHI(text: string, phi: PHI, sessionId?: string): ObfuscationResult {
  const log = logger.child({ action: 'obfuscatePHI', sessionId });

  // Generate unique tokens (use sessionId for consistency across multiple obfuscations)
  const suffix = sessionId ? `_${sessionId.slice(0, 8)}` : `_${Date.now().toString(36)}`;

  const tokens: ObfuscatedTokens = {
    nameToken: `PATIENT${suffix}`,
    dobToken: `DOB${suffix}`,
    medicareToken: phi.medicareNumber ? `MEDICARE${suffix}` : 'MEDICARE_UNKNOWN',
    genderToken: phi.gender ? `GENDER${suffix}` : 'GENDER_UNKNOWN',
    addressToken: phi.address ? `ADDRESS${suffix}` : undefined,
    phoneToken: phi.phoneNumber ? `PHONE${suffix}` : undefined,
    emailToken: phi.email ? `EMAIL${suffix}` : undefined,
  };

  let obfuscatedText = text;
  let replacementCount = 0;

  // Replace name (case-insensitive, whole word)
  const nameRegex = new RegExp(`\\b${escapeRegex(phi.name)}\\b`, 'gi');
  const nameMatches = obfuscatedText.match(nameRegex);
  if (nameMatches) {
    obfuscatedText = obfuscatedText.replace(nameRegex, tokens.nameToken);
    replacementCount += nameMatches.length;
  }

  // Replace DOB (various formats: DD/MM/YYYY, YYYY-MM-DD, "1 Jan 1970", etc.)
  const dobVariants = generateDOBVariants(phi.dateOfBirth);
  for (const variant of dobVariants) {
    const dobRegex = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'gi');
    const dobMatches = obfuscatedText.match(dobRegex);
    if (dobMatches) {
      obfuscatedText = obfuscatedText.replace(dobRegex, tokens.dobToken);
      replacementCount += dobMatches.length;
    }
  }

  // Replace Medicare number (format: 1234 56789 0 or 1234567890)
  if (phi.medicareNumber) {
    const medicareVariants = [
      phi.medicareNumber,
      phi.medicareNumber.replace(/\s/g, ''), // Remove spaces
      phi.medicareNumber.replace(/(\d{4})\s?(\d{5})\s?(\d)/, '$1 $2 $3'), // Standardize spacing
    ];

    for (const variant of medicareVariants) {
      const medicareRegex = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'g');
      const medicareMatches = obfuscatedText.match(medicareRegex);
      if (medicareMatches) {
        obfuscatedText = obfuscatedText.replace(medicareRegex, tokens.medicareToken);
        replacementCount += medicareMatches.length;
      }
    }
  }

  // Replace gender
  if (phi.gender) {
    const genderRegex = new RegExp(`\\b${escapeRegex(phi.gender)}\\b`, 'gi');
    const genderMatches = obfuscatedText.match(genderRegex);
    if (genderMatches) {
      obfuscatedText = obfuscatedText.replace(genderRegex, tokens.genderToken);
      replacementCount += genderMatches.length;
    }
  }

  // Replace address (if provided)
  if (phi.address && tokens.addressToken) {
    const addressRegex = new RegExp(`\\b${escapeRegex(phi.address)}\\b`, 'gi');
    const addressMatches = obfuscatedText.match(addressRegex);
    if (addressMatches) {
      obfuscatedText = obfuscatedText.replace(addressRegex, tokens.addressToken);
      replacementCount += addressMatches.length;
    }
  }

  // Replace phone (if provided)
  if (phi.phoneNumber && tokens.phoneToken) {
    const phoneVariants = generatePhoneVariants(phi.phoneNumber);
    for (const variant of phoneVariants) {
      const phoneRegex = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'g');
      const phoneMatches = obfuscatedText.match(phoneRegex);
      if (phoneMatches) {
        obfuscatedText = obfuscatedText.replace(phoneRegex, tokens.phoneToken);
        replacementCount += phoneMatches.length;
      }
    }
  }

  // Replace email (if provided)
  if (phi.email && tokens.emailToken) {
    const emailRegex = new RegExp(`\\b${escapeRegex(phi.email)}\\b`, 'gi');
    const emailMatches = obfuscatedText.match(emailRegex);
    if (emailMatches) {
      obfuscatedText = obfuscatedText.replace(emailRegex, tokens.emailToken);
      replacementCount += emailMatches.length;
    }
  }

  log.info('PHI obfuscation complete', {
    tokensReplaced: replacementCount,
    textLength: text.length,
    obfuscatedLength: obfuscatedText.length,
  });

  return {
    obfuscatedText,
    deobfuscationMap: { tokens, phi },
    tokensReplaced: replacementCount,
  };
}

/**
 * Deobfuscate text by replacing tokens with real PHI.
 *
 * Used after LLM generation to restore patient information in the final letter.
 */
export function deobfuscatePHI(obfuscatedText: string, map: DeobfuscationMap): string {
  const log = logger.child({ action: 'deobfuscatePHI' });

  let deobfuscatedText = obfuscatedText;

  // Replace all tokens with real PHI
  deobfuscatedText = deobfuscatedText.replace(new RegExp(map.tokens.nameToken, 'g'), map.phi.name);
  deobfuscatedText = deobfuscatedText.replace(new RegExp(map.tokens.dobToken, 'g'), map.phi.dateOfBirth);

  if (map.phi.medicareNumber) {
    deobfuscatedText = deobfuscatedText.replace(
      new RegExp(map.tokens.medicareToken, 'g'),
      map.phi.medicareNumber
    );
  }

  if (map.phi.gender) {
    deobfuscatedText = deobfuscatedText.replace(new RegExp(map.tokens.genderToken, 'g'), map.phi.gender);
  }

  if (map.phi.address && map.tokens.addressToken) {
    deobfuscatedText = deobfuscatedText.replace(new RegExp(map.tokens.addressToken, 'g'), map.phi.address);
  }

  if (map.phi.phoneNumber && map.tokens.phoneToken) {
    deobfuscatedText = deobfuscatedText.replace(new RegExp(map.tokens.phoneToken, 'g'), map.phi.phoneNumber);
  }

  if (map.phi.email && map.tokens.emailToken) {
    deobfuscatedText = deobfuscatedText.replace(new RegExp(map.tokens.emailToken, 'g'), map.phi.email);
  }

  // Replace extra mappings (if any)
  if (map.extraMappings) {
    for (const [token, value] of map.extraMappings.entries()) {
      deobfuscatedText = deobfuscatedText.replace(new RegExp(token, 'g'), value);
    }
  }

  log.info('PHI deobfuscation complete', {
    textLength: obfuscatedText.length,
    deobfuscatedLength: deobfuscatedText.length,
  });

  return deobfuscatedText;
}

/**
 * Validate that text does not contain any real PHI after obfuscation.
 * Returns true if text is safe (no PHI detected), false otherwise.
 */
export function validateObfuscation(obfuscatedText: string, phi: PHI): {
  isSafe: boolean;
  leakedPHI: string[];
} {
  const leakedPHI: string[] = [];

  // Check for name
  if (new RegExp(`\\b${escapeRegex(phi.name)}\\b`, 'i').test(obfuscatedText)) {
    leakedPHI.push('name');
  }

  // Check for DOB
  const dobVariants = generateDOBVariants(phi.dateOfBirth);
  for (const variant of dobVariants) {
    if (new RegExp(`\\b${escapeRegex(variant)}\\b`, 'i').test(obfuscatedText)) {
      leakedPHI.push('dateOfBirth');
      break;
    }
  }

  // Check for Medicare number
  if (phi.medicareNumber) {
    const medicareClean = phi.medicareNumber.replace(/\s/g, '');
    if (obfuscatedText.includes(medicareClean)) {
      leakedPHI.push('medicareNumber');
    }
  }

  // Check for email
  if (phi.email && obfuscatedText.includes(phi.email)) {
    leakedPHI.push('email');
  }

  return {
    isSafe: leakedPHI.length === 0,
    leakedPHI,
  };
}

// Helper: Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper: Generate date of birth variants
function generateDOBVariants(dob: string): string[] {
  const variants: string[] = [dob];

  // Try to parse as ISO date (YYYY-MM-DD)
  const isoMatch = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    variants.push(`${day}/${month}/${year}`); // DD/MM/YYYY
    variants.push(`${month}/${day}/${year}`); // MM/DD/YYYY (US format)
    variants.push(`${day}-${month}-${year}`); // DD-MM-YYYY

    // Human-readable formats
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthName = monthNames[parseInt(month ?? '1', 10) - 1];
    if (monthName) {
      variants.push(`${parseInt(day ?? '1', 10)} ${monthName} ${year}`); // 1 Jan 1970
    }
  }

  // Try to parse as DD/MM/YYYY
  const ddmmyyyyMatch = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    variants.push(`${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`); // ISO
    variants.push(`${day}-${month}-${year}`); // DD-MM-YYYY
  }

  return [...new Set(variants)]; // Remove duplicates
}

// Helper: Generate phone number variants
function generatePhoneVariants(phone: string): string[] {
  const variants: string[] = [phone];

  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, '');
  variants.push(digitsOnly);

  // Common Australian formats
  if (digitsOnly.length === 10) {
    variants.push(`${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7)}`); // 0412 345 678
    variants.push(`(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 6)} ${digitsOnly.slice(6)}`); // (04) 1234 5678
  }

  return [...new Set(variants)];
}
