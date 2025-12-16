export type BlogBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; title?: string; items: string[] }
  | { kind: 'callout'; title?: string; text: string };

export type BlogPost = {
  slug: string;
  title: string;
  dek: string;
  date: string;
  readTime: string;
  author: string;
  tags: string[];
  accentColor: string;
  gradient?: string;
  heroBadge?: string;
  heroNote?: string;
  body: BlogBlock[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: 'fitbuddy-times-dispatch',
    title: 'Three students sprint forward - progress, humor, and curiosity lead the way',
    dek: 'A light-hearted look at an earnest trio building something that helps people move more - and have fun doing it.',
    date: 'January 15, 2025',
    readTime: '4 min read',
    author: 'The FitBuddy Times',
    tags: ['Team update', 'Build log', 'Culture'],
    accentColor: '#1e90cb',
    gradient: 'linear-gradient(135deg, #1ecb7b, #1e90cb)',
    heroBadge: 'Dispatch',
    heroNote: 'Studio build log',
    body: [
      {
        kind: 'paragraph',
        text: 'In a bright corner of the internet, three motivated students - Dakota, William, and Zade - have been tinkering, testing, and cheering each other on as they shape a playful fitness companion. Their work is part curiosity, part stubborn optimism, and part careful problem-solving. Today they take another step forward.'
      },
      {
        kind: 'paragraph',
        text: 'Dakota has been polishing the user experience, smoothing rough edges until clicks feel like a friendly handshake. William is hunting bugs with the focus of a cat on a laser pointer - relentless, amused, and usually victorious. Zade brings the glue: creativity, structure, and the occasional very-good pun that lightens long debug sessions.'
      },
      {
        kind: 'paragraph',
        text: 'Progress in small, steady steps has produced something meaningful: a product that encourages movement and learning. Along the way they have learned to ship often, laugh at odd console errors, and celebrate tiny wins - like a calendar date that finally renders correctly or an AI reply that does not accidentally suggest a dinosaur as a warm-up.'
      },
      {
        kind: 'paragraph',
        text: 'This paper encourages Dakota, William, and Zade to keep exploring. Try an experiment, break one thing, fix two. Ask a bold question of the AI coach. Share your findings and keep the momentum: every small improvement helps someone move a little more.'
      },
      {
        kind: 'callout',
        title: 'To Dakota, William, and Zade',
        text: 'Keep building. Keep testing. Keep laughing. The site is already making a difference - and the best features are still ahead.'
      }
    ]
  },
  {
    slug: 'micro-habits-for-streaks',
    title: 'Micro-habits that keep your streak alive on chaotic weeks',
    dek: 'When the calendar is packed, the smallest actions protect your momentum.',
    date: 'January 8, 2025',
    readTime: '5 min read',
    author: 'FitBuddy Product Team',
    tags: ['Consistency', 'Habits', 'Coaching'],
    accentColor: '#58cc02',
    gradient: 'linear-gradient(135deg, #58cc02, #1cb0f6)',
    heroBadge: 'Playbook',
    heroNote: 'Tools for busy humans',
    body: [
      {
        kind: 'paragraph',
        text: 'Consistency is a muscle. The easiest way to train it is with actions that are too small to skip. When schedules explode, the goal shifts from perfect workouts to keeping the chain unbroken.'
      },
      {
        kind: 'list',
        title: 'Try these small anchors',
        items: [
          'Two-minute warm start: 20 bodyweight squats and a long exhale to reset your shoulders.',
          'Microworkout placement: put a kettlebell next to the coffee machine and do 10 swings while it brews.',
          'Pre-commit note: drop a sticky on tomorrow\'s calendar with the exact time you will press play.',
          'Wind-down walk: 7 minutes outside right after work to mark the end of the day.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'Each micro-habit is a vote for the identity you are chasing. Stack two of them and your streak stays intact even when the gym is closed or the meeting ran long.'
      },
      {
        kind: 'callout',
        title: 'Coaching nudge',
        text: 'If you log a five-minute effort, FitBuddy counts it. Done beats ideal.'
      }
    ]
  },
  {
    slug: 'teaching-the-ai-coach',
    title: 'How we teach the AI coach to sound like a friend, not a robot',
    dek: 'The playbook behind tone, safety, and helpful answers.',
    date: 'December 18, 2024',
    readTime: '6 min read',
    author: 'FitBuddy AI Lab',
    tags: ['AI', 'Product', 'Voice'],
    accentColor: '#ff9600',
    gradient: 'linear-gradient(135deg, #ffb347, #ff6464)',
    heroBadge: 'Inside the lab',
    heroNote: 'Shaping the coach voice',
    body: [
      {
        kind: 'paragraph',
        text: 'A good coach does more than give reps. They match your mood, celebrate your effort, and keep advice grounded. To get there, we train our AI on a simple principle: speak like a helpful teammate.'
      },
      {
        kind: 'list',
        title: 'Tone guardrails we enforce',
        items: [
          'Default to encouragement before critique.',
          'Prefer plain language over jargon and acronyms.',
          'Offer one clear next step instead of three options.',
          'Admit uncertainty and suggest a safe alternative.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'We mix product rules with real coaching patterns from trainers and physical therapists. Every reply is checked against safety policies before it leaves the model. When in doubt, the coach slows down, asks a question, and keeps you safe.'
      },
      {
        kind: 'callout',
        title: 'What is next',
        text: 'We are tuning recovery prompts and celebratory moments so the coach remembers your milestones and sounds more personal.'
      }
    ]
  },
  {
    slug: 'december-release-radar',
    title: 'Release radar: the December bundle that quietly changes everything',
    dek: 'Smarter streak savers, calmer onboarding, and a prettier calendar.',
    date: 'December 5, 2024',
    readTime: '3 min read',
    author: 'Release Notes',
    tags: ['Product', 'Updates'],
    accentColor: '#8a5cf6',
    gradient: 'linear-gradient(135deg, #8a5cf6, #1cb0f6)',
    heroBadge: 'Changelog',
    heroNote: 'What shipped this month',
    body: [
      {
        kind: 'list',
        title: 'Highlights',
        items: [
          'Streak saver bridge now asks before spending multiples and explains the gap it will cover.',
          'Onboarding remembers your theme and coach tone as soon as you pick them.',
          'Calendar cards got contrast, breathing room, and friendlier empty states.',
          'Shop page now calls out featured boosts so you can redeem faster.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'We also tightened up performance on low-end devices, trimmed several megabytes from the bundle, and fixed the weird bug where an AI reply would suggest a dinosaur as a warm-up.'
      },
      {
        kind: 'callout',
        title: 'Tell us what to build next',
        text: 'Drop a note in the chat or the help center. We look at every request.'
      }
    ]
  }
];

export const findPostBySlug = (slug?: string) =>
  blogPosts.find((post) => post.slug === slug);

export const latestPost = blogPosts[0];
