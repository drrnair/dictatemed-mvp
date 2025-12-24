import { Container } from '@/components/shared/Container';
import { AnimatedSection } from '@/components/shared/AnimatedSection';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'How accurate is the transcription?',
    answer:
      'DictateMED uses medical-grade speech recognition optimized for clinical terminology. Accuracy rates exceed 98% for standard consultations. All transcriptions are reviewed alongside the generated letter, so you can verify and correct any errors before sending.',
  },
  {
    question: 'Does it work with my EHR?',
    answer:
      'DictateMED generates standard letter formats that can be copied into any EHR system. We also offer direct integrations with major Australian healthcare systems. Contact us to discuss integration with your specific setup.',
  },
  {
    question: 'What happens to patient data?',
    answer:
      'Patient data is encrypted in transit, de-identified during AI processing, and stored locally on your device. Audio recordings are never stored in the cloud. We comply with Australian Privacy Act, HIPAA, and GDPR requirements.',
  },
  {
    question: 'Can I use my own letter templates?',
    answer:
      'Yes! DictateMED learns your writing style from your existing letters and can use custom templates. You can create templates for different letter types — new patient consultations, follow-ups, procedure reports, and more.',
  },
  {
    question: 'What if the AI makes a mistake?',
    answer:
      'Every clinical fact in the generated letter is linked to its source in the transcript or uploaded documents. Critical values (like LVEF or stenosis grades) require explicit confirmation before the letter is finalized. Our hallucination detection system flags any statements that cannot be verified against source material.',
  },
  {
    question: 'Is there a contract or can I cancel anytime?',
    answer:
      'No long-term contracts. DictateMED is billed monthly and you can cancel anytime. Your data remains yours — export your letters and templates at any time.',
  },
];

export function FAQ() {
  return (
    <section className="py-20 md:py-32">
      <Container>
        <AnimatedSection className="text-center">
          <h2 className="text-section-title md:text-section-title-lg text-foreground">
            Frequently asked questions
          </h2>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="mx-auto mt-12 max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-foreground hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimatedSection>
      </Container>
    </section>
  );
}
