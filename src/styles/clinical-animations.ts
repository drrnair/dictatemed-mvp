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
 * Standardized duration values in milliseconds.
 * Consistent timing creates cohesive feel.
 */
export const durations = {
  /** Instant feedback (100ms) - button clicks, toggles */
  instant: 0.1,

  /** Fast transitions (150ms) - hover states, quick feedback */
  fast: 0.15,

  /** Normal transitions (250ms) - default for most animations */
  normal: 0.25,

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
 * Side panel animation variants.
 * Panel expands first, then content fades in.
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
        duration: 0.28,
        ease: easings.smooth,
      },
      opacity: {
        duration: 0.2,
      },
    },
  },
} as const;

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
      duration: 0.3,
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
      duration: 0.3,
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
      duration: 0.3,
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
      duration: 0.2,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: 0.2,
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
 */
export const pulseAnimation = {
  scale: [1, 1.2, 1],
  opacity: [1, 0.8, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut',
  },
} as const;

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
