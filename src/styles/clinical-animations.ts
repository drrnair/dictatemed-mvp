/**
 * Clinical Animation System
 *
 * Provides custom easing curves, durations, and Framer Motion variants
 * for a distinctive, medical-grade animation experience.
 */

// =============================================================================
// Custom Easing Curves
// =============================================================================

/**
 * Custom easing curves for natural, non-generic animations.
 * Avoids default ease-out which feels robotic.
 */
export const easings = {
  /** Smooth deceleration - feels natural and deliberate */
  smooth: [0.32, 0.72, 0, 1] as const,

  /** Snappy response - feels responsive and modern */
  snappy: [0.25, 0.1, 0.25, 1] as const,

  /** Gentle bounce - use sparingly for success states */
  bounce: [0.68, -0.55, 0.265, 1.55] as const,

  /** Balanced default - good for most transitions */
  default: [0.4, 0, 0.2, 1] as const,

  /** Quick in, slow out - for emphasis */
  emphasized: [0.2, 0, 0, 1] as const,
} as const;

// =============================================================================
// Duration Constants
// =============================================================================

/**
 * Standardized duration values in seconds (Framer Motion format).
 * Consistent timing creates cohesive feel.
 */
export const durations = {
  /** Instant feedback (100ms) - button clicks, toggles */
  instant: 0.1,

  /** Fast transitions (150ms) - hover states, quick feedback */
  fast: 0.15,

  /** Quick exit transitions (200ms) - panel/modal exits */
  quickExit: 0.2,

  /** Normal transitions (250ms) - default for most animations */
  normal: 0.25,

  /** Panel exit (280ms) - slightly longer than quick exit */
  panelExit: 0.28,

  /** Card entrance (300ms) - deliberate card reveals */
  card: 0.3,

  /** Slow transitions (350ms) - deliberate movements, panels */
  slow: 0.35,

  /** Slower transitions (500ms) - very deliberate, modals */
  slower: 0.5,

  /** Stagger delay (80ms) - between cascading items */
  stagger: 0.08,

  /** Content delay (180ms) - after container animations */
  contentDelay: 0.18,
} as const;

// =============================================================================
// Panel Animation Variants
// =============================================================================

/**
 * Side panel animation variants (desktop: 42% width).
 * Panel expands first, then content fades in.
 *
 * For responsive widths, use createPanelVariants() instead.
 */
export const panelVariants = {
  closed: {
    width: 0,
    opacity: 0,
  },
  open: {
    width: '42%',
    opacity: 1,
    transition: {
      width: {
        duration: durations.slow,
        ease: easings.smooth,
      },
      opacity: {
        duration: durations.normal,
        delay: 0.1,
      },
    },
  },
  exit: {
    width: 0,
    opacity: 0,
    transition: {
      width: {
        duration: durations.panelExit,
        ease: easings.smooth,
      },
      opacity: {
        duration: durations.quickExit,
      },
    },
  },
} as const;

/**
 * Creates panel variants with custom width.
 * Use for responsive designs where width varies by breakpoint.
 *
 * @param width - Panel width (e.g., '42%', '50%', '100%')
 */
export const createPanelVariants = (width: string) => ({
  closed: {
    width: 0,
    opacity: 0,
  },
  open: {
    width,
    opacity: 1,
    transition: {
      width: {
        duration: durations.slow,
        ease: easings.smooth,
      },
      opacity: {
        duration: durations.normal,
        delay: 0.1,
      },
    },
  },
  exit: {
    width: 0,
    opacity: 0,
    transition: {
      width: {
        duration: durations.panelExit,
        ease: easings.smooth,
      },
      opacity: {
        duration: durations.quickExit,
      },
    },
  },
});

/**
 * Panel content animation variants.
 * Slides in from right after panel expands.
 */
export const panelContentVariants = {
  hidden: {
    opacity: 0,
    x: 20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      delay: durations.contentDelay,
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: durations.fast,
    },
  },
} as const;

// =============================================================================
// Card Animation Variants
// =============================================================================

/**
 * Card entrance animation.
 * Fades up from below.
 */
export const cardVariants = {
  hidden: {
    opacity: 0,
    y: 16,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.card,
      ease: easings.smooth,
    },
  },
} as const;

/**
 * Creates cascading animation for a list of cards.
 * Each card staggers in with a delay.
 */
export const createCascadeVariants = (index: number) => ({
  hidden: {
    opacity: 0,
    y: 16,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: index * durations.stagger,
      duration: durations.card,
      ease: easings.smooth,
    },
  },
});

/**
 * Container variant for staggered children.
 * Use with staggerChildren in parent.
 */
export const staggerContainerVariants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: durations.stagger,
      delayChildren: 0.1,
    },
  },
} as const;

/**
 * Child variant for use with stagger container.
 */
export const staggerChildVariants = {
  hidden: {
    opacity: 0,
    y: 16,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.card,
      ease: easings.smooth,
    },
  },
} as const;

// =============================================================================
// Modal/Popup Animation Variants
// =============================================================================

/**
 * Popup overlay animation.
 * Fades in backdrop.
 */
export const overlayVariants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: durations.normal,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: durations.fast,
    },
  },
} as const;

/**
 * Popup content animation.
 * Scales up and fades in.
 */
export const popupVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: {
      duration: durations.fast,
    },
  },
} as const;

// =============================================================================
// Drawer Animation Variants
// =============================================================================

/**
 * Bottom drawer animation.
 * Slides up from bottom.
 */
export const drawerVariants = {
  hidden: {
    y: '100%',
  },
  visible: {
    y: 0,
    transition: {
      type: 'spring',
      damping: 30,
      stiffness: 300,
    },
  },
  exit: {
    y: '100%',
    transition: {
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
} as const;

// =============================================================================
// Button Hover Effects
// =============================================================================

/**
 * Subtle lift effect for buttons.
 * Use with whileHover and whileTap.
 */
export const buttonHoverEffect = {
  hover: {
    y: -1,
    transition: {
      duration: durations.fast,
    },
  },
  tap: {
    y: 0,
    transition: {
      duration: durations.instant,
    },
  },
} as const;

/**
 * Scale effect for icon buttons.
 */
export const iconButtonEffect = {
  hover: {
    scale: 1.05,
    transition: {
      duration: durations.fast,
    },
  },
  tap: {
    scale: 0.95,
    transition: {
      duration: durations.instant,
    },
  },
} as const;

// =============================================================================
// Loading Animation Variants
// =============================================================================

/**
 * Fade between loading stages.
 */
export const loadingStageVariants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: durations.quickExit,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: durations.quickExit,
    },
  },
} as const;

/**
 * Loading text crossfade.
 */
export const loadingTextVariants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.normal,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: durations.normal,
    },
  },
} as const;

// =============================================================================
// Pulse Animation (for connected sources)
// =============================================================================

/**
 * Continuous pulse animation for connected status indicators.
 * Note: Not using `as const` to allow mutable arrays for Framer Motion's animate prop.
 */
export const pulseAnimation = {
  scale: [1, 1.2, 1] as number[],
  opacity: [1, 0.8, 1] as number[],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },
};

// =============================================================================
// Citation Flash Animation
// =============================================================================

/**
 * Citation flash animation for when a citation is inserted.
 * Creates a green highlight that fades out.
 *
 * Note: For CSS-based animation, use the `citation-flash` keyframes
 * defined in globals.css. This variant is for Framer Motion usage.
 */
export const citationFlashVariants = {
  initial: {
    backgroundColor: 'transparent',
  },
  flash: {
    backgroundColor: [
      'rgba(34, 197, 94, 0.3)',
      'rgba(34, 197, 94, 0.4)',
      'rgba(34, 197, 94, 0.3)',
      'transparent',
    ],
    transition: {
      duration: 2,
      ease: 'easeOut',
      times: [0, 0.25, 0.5, 1],
    },
  },
} as const;

/**
 * Utility function to trigger citation flash via CSS animation.
 * Use this when applying to DOM elements outside of Framer Motion.
 */
export const triggerCitationFlash = (element: HTMLElement) => {
  element.style.animation = 'citation-flash 2s ease-out forwards';

  // Clean up after animation completes
  const cleanup = () => {
    element.style.animation = '';
    element.removeEventListener('animationend', cleanup);
  };
  element.addEventListener('animationend', cleanup);

  // Scroll to citation
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates a spring transition with clinical defaults.
 */
export const createSpringTransition = (
  damping = 25,
  stiffness = 300,
) => ({
  type: 'spring' as const,
  damping,
  stiffness,
});

/**
 * Creates a tween transition with clinical easing.
 */
export const createTweenTransition = (
  duration = durations.normal,
  ease = easings.smooth,
) => ({
  type: 'tween' as const,
  duration,
  ease,
});
