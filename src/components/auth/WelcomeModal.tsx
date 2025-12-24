'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Mic, Sparkles, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps = [
  {
    icon: Mic,
    title: 'Record your consultations',
    description:
      'Speak naturally during your consultations. DictateMED captures everything in the background.',
  },
  {
    icon: Sparkles,
    title: 'AI generates your letter',
    description:
      'Our AI creates accurate, source-verified letters in your exact writing style.',
  },
  {
    icon: Check,
    title: 'Review and send',
    description:
      'Verify critical values with one click, then approve and send. Done in minutes.',
  },
];

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep]!;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
      router.push('/record');
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="p-6">
          {/* Header */}
          <DialogTitle className="sr-only">Welcome to DictateMED</DialogTitle>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="text-center"
            >
              {/* Icon */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                <step.icon className="h-8 w-8 text-primary" />
              </div>

              {/* Title */}
              <h2 className="mt-6 text-heading-2 text-foreground">
                {step.title}
              </h2>

              {/* Description */}
              <p className="mt-3 text-muted-foreground">{step.description}</p>
            </motion.div>
          </AnimatePresence>

          {/* Progress Dots */}
          <div className="mt-8 flex justify-center gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentStep(index)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-primary'
                    : 'bg-muted hover:bg-muted-foreground/30'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Skip
            </button>
            <Button onClick={handleNext} className="flex items-center gap-2">
              {isLastStep ? 'Start Recording' : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
