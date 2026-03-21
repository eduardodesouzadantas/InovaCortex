import { HeroSection } from "@/components/sections/hero";
import { AgentFirstSection } from "@/components/sections/agent-first";
import { SolutionsSection } from "@/components/sections/solutions";
import { ArtifactsSection } from "@/components/sections/artifacts-mock";
import { MissionSimulator } from "@/components/sections/mission-simulator";
import { UseCasesSection } from "@/components/sections/use-cases";
import { TestimonialsSection } from "@/components/sections/testimonials";
import { FinalCtaSection } from "@/components/sections/final-cta";
import { FadeIn } from "@/components/fade-in";

export default function Home() {
  return (
    <div className="flex flex-col">
      <FadeIn direction="none" delay={0}>
        <HeroSection />
      </FadeIn>
      <FadeIn direction="up" delay={150}>
        <AgentFirstSection />
      </FadeIn>
      <FadeIn direction="up" delay={150}>
        <SolutionsSection />
      </FadeIn>
      <FadeIn direction="up" delay={150}>
        <MissionSimulator />
      </FadeIn>
      <FadeIn direction="up" delay={150}>
        <ArtifactsSection />
      </FadeIn>
      <FadeIn direction="up" delay={150}>
        <UseCasesSection />
      </FadeIn>
      <FadeIn direction="up" delay={150}>
        <TestimonialsSection />
      </FadeIn>
      <FadeIn direction="up" delay={150}>
        <FinalCtaSection />
      </FadeIn>
    </div>
  );
}
