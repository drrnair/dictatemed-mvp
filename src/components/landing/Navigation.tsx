'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#about', label: 'About' },
];

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-200',
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/60'
          : 'bg-transparent'
      )}
    >
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-semibold text-primary transition-opacity hover:opacity-80"
        >
          DictateMED
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-body-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/signup" className="flex items-center gap-2">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent md:hidden"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Mobile Menu */}
        <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <DialogPortal>
            <DialogOverlay className="md:hidden" />
            <AnimatePresence>
              {mobileMenuOpen && (
                <DialogPrimitive.Content asChild forceMount>
                  <motion.div
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: '100%' }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: '100%' }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="fixed inset-y-0 right-0 z-50 w-[80%] max-w-sm bg-background p-6 shadow-xl md:hidden"
                  >
                    {/* Close Button */}
                    <button
                      type="button"
                      className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent"
                      onClick={() => setMobileMenuOpen(false)}
                      aria-label="Close menu"
                    >
                      <X className="h-6 w-6" />
                    </button>

                    {/* Mobile Logo */}
                    <Link
                      href="/"
                      className="text-xl font-semibold text-primary"
                      onClick={handleLinkClick}
                    >
                      DictateMED
                    </Link>

                    {/* Mobile Nav Links */}
                    <div className="mt-8 flex flex-col gap-4">
                      {navLinks.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          className="text-lg text-foreground transition-colors hover:text-primary"
                          onClick={handleLinkClick}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>

                    {/* Mobile CTAs */}
                    <div className="mt-8 flex flex-col gap-3">
                      <Button variant="outline" asChild className="w-full">
                        <Link href="/login" onClick={handleLinkClick}>
                          Sign In
                        </Link>
                      </Button>
                      <Button asChild className="w-full">
                        <Link
                          href="/signup"
                          className="flex items-center justify-center gap-2"
                          onClick={handleLinkClick}
                        >
                          Start Free Trial
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </motion.div>
                </DialogPrimitive.Content>
              )}
            </AnimatePresence>
          </DialogPortal>
        </Dialog>
      </nav>
    </header>
  );
}
