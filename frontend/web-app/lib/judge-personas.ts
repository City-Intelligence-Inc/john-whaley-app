export interface JudgePersona {
  id: string;
  name: string;
  emoji: string;
  specialty: string;
  description: string;
  preferred_types: string[];
}

export const JUDGE_PERSONAS: JudgePersona[] = [
  {
    id: "technical_purist",
    name: "The Technical Purist",
    emoji: "\u{1F52C}",
    specialty: "Deep AI/ML expertise",
    description: "Laser-focused on technical depth. Wants people who can talk shop about transformers, fine-tuning, and inference optimization.",
    preferred_types: ["faculty", "student", "entrepreneur"],
  },
  {
    id: "venture_eye",
    name: "The Venture Eye",
    emoji: "\u{1F4B0}",
    specialty: "Commercial potential & investment",
    description: "Sees everything through an investment lens. Values market opportunity, traction, and the ability to turn research into revenue.",
    preferred_types: ["vc", "entrepreneur"],
  },
  {
    id: "academic",
    name: "The Academic",
    emoji: "\u{1F393}",
    specialty: "Research & scholarly work",
    description: "Champions rigorous research and academic excellence. Values publications, teaching, and intellectual curiosity.",
    preferred_types: ["faculty", "student"],
  },
  {
    id: "diversity_champion",
    name: "The Diversity Champion",
    emoji: "\u{1F30D}",
    specialty: "Diverse backgrounds & inclusion",
    description: "Fights for a diverse attendee mix. Values underrepresented perspectives and non-traditional paths into AI.",
    preferred_types: ["student", "other"],
  },
  {
    id: "networker",
    name: "The Networker",
    emoji: "\u{1F91D}",
    specialty: "Connections & influence",
    description: "Values who you know. Wants attendees who will create valuable introductions and make the event a networking goldmine.",
    preferred_types: ["vc", "entrepreneur", "press"],
  },
  {
    id: "industry_insider",
    name: "The Industry Insider",
    emoji: "\u{1F3ED}",
    specialty: "Practical deployment experience",
    description: "Cares about real-world AI deployment at scale. Wants people who have shipped AI products to millions of users.",
    preferred_types: ["entrepreneur", "other"],
  },
  {
    id: "student_advocate",
    name: "The Student Advocate",
    emoji: "\u{1F4DA}",
    specialty: "Learning potential & fresh ideas",
    description: "Champions students and early-career professionals. Fresh perspectives and enthusiasm matter more than experience.",
    preferred_types: ["student", "alumni"],
  },
  {
    id: "press_secretary",
    name: "The Press Secretary",
    emoji: "\u{1F4F0}",
    specialty: "Media potential & coverage",
    description: "Wants the event to get coverage. Values journalists, content creators, and anyone who generates buzz.",
    preferred_types: ["press", "entrepreneur"],
  },
  {
    id: "innovator",
    name: "The Innovator",
    emoji: "\u{1F4A1}",
    specialty: "Novel ideas & creative approaches",
    description: "Obsessed with what's new and different. Wants attendees working on cutting-edge applications.",
    preferred_types: ["entrepreneur", "student", "faculty"],
  },
  {
    id: "pragmatist",
    name: "The Pragmatist",
    emoji: "\u{1F4CA}",
    specialty: "Proven track record & results",
    description: "All about receipts. Wants attendees with measurable accomplishments \u2014 revenue, users, citations, companies built.",
    preferred_types: ["entrepreneur", "vc", "faculty"],
  },
  {
    id: "visionary",
    name: "The Visionary",
    emoji: "\u{1F52E}",
    specialty: "Big-picture & future potential",
    description: "Thinks long-term. Wants attendees building the future, not optimizing the present. Potential over pedigree.",
    preferred_types: ["entrepreneur", "faculty", "student"],
  },
  {
    id: "community_builder",
    name: "The Community Builder",
    emoji: "\u{1F3E0}",
    specialty: "Event engagement & energy",
    description: "Wants great event energy. Values people who will ask questions, give feedback, and make it memorable.",
    preferred_types: ["alumni", "other", "student"],
  },
];
