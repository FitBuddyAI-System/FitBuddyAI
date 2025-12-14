<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# FitBuddyAI - AI Fitness Companion

This is a modern fitness web application built with React, TypeScript, and Vite. The application features:

## Key Technologies
- React 18 with TypeScript
- Vite for build tooling
- CSS3 with custom properties for styling
- Google Gemini AI for workout generation
- React Router for navigation
- date-fns for date manipulation
- Lucide React for icons


## FitBuddyAI Theme & Style Guidelines (Strict)

- **Color Palette:**
  - Primary green: #1ecb7b (Duolingo-like)
  - Accent blue: #1e90cb
  - Accent orange: #ffb347
  - Background gradient: linear-gradient(135deg, #f7f7f7 0%, #e8f5e8 100%)
  - Text dark: #222, Text medium: #555, Text light: #888
  - Use CSS custom properties (see index.css) for all colors

- **Logo:**
  - Use the Lucide React `<Dumbbell />` icon for the logo, size 32px in header, 48px in hero/feature sections if needed
  - Logo background: var(--gradient-primary) with white icon
  - Only one logo per page, preferably in the header

- **Buttons:**
  - Default button: border-radius 0.7rem, padding 0.8rem 0, font-size 1.1rem, font-weight 600
  - Large button: padding 20px 40px, font-size 18px, border-radius 20px
  - Primary: background var(--color-primary, #1ecb7b), color #fff
  - Hover: slightly darker background, smooth transition

- **Headings & Typography:**
  - App title: font-size 48px, bold, gradient text (see .app-title)
  - Section titles: 36px desktop, 28px mobile
  - Subtitles: 18px, color var(--text-medium)
  - Use clear, friendly, readable fonts

- **Cards & Containers:**
  - Use large border-radius (12px+), soft box-shadow, white or gradient backgrounds
  - Use flexbox/grid for layout, with generous spacing

- **Animations:**
  - Use fade-in, bounce, and floating effects for hero/feature cards
  - All transitions should be smooth (0.2-0.4s)

- **Responsiveness:**
  - Mobile-first, all layouts must adapt to small screens
  - Use media queries for font and grid adjustments

- **Accessibility:**
  - Use semantic HTML, proper labels, and ARIA attributes
  - Ensure color contrast is always sufficient

## Design Principles
  - Duolingo-inspired UI with vibrant colors and smooth animations
  - Mobile-first responsive design
  - Component-based architecture
  - Type-safe development with TypeScript
  - Modern CSS with custom properties and flexbox/grid layouts

## Code Style Guidelines
- Use functional components with hooks
- Implement proper TypeScript typing
- Follow consistent naming conventions (camelCase for variables/functions, PascalCase for components)
- Use CSS modules or component-specific CSS files
- Implement proper error handling and loading states
- Write clean, readable code with proper comments

## Project Structure
- `/src/components/` - React components with corresponding CSS files
- `/src/services/` - API services and utility functions
- `/src/types.ts` - TypeScript type definitions
- Component files should be named in PascalCase (e.g., `WorkoutCalendar.tsx`)
- CSS files should match component names (e.g., `WorkoutCalendar.css`)

## AI Integration
- Google Gemini API is used for generating personalized workout plans
- AI prompts should be comprehensive and include user context

## Styling Approach
- Use CSS custom properties defined in `index.css` for consistent theming
- Implement Duolingo-like color palette (greens, blues, oranges)
- Use smooth transitions and hover effects
- Implement proper responsive breakpoints
- Use semantic HTML elements for accessibility

When working on this project, prioritize user experience, type safety, and maintainable code structure.

## Compatibility Policy
- **Do NOT add compatibility helpers or legacy mapping code:** Fail fast on missing columns or schema mismatches. Avoid adding server-side compatibility shims that map legacy `fitbuddyai_*` keys to new columns. These helpers create code bloat and hidden behavior; prefer explicit schema changes and migrations.
  - **Do NOT use local-file fallbacks or silent dev fallbacks in server code:** This project is production-first. Server code must require Supabase (or the configured production datastore) and fail loudly if it is not available. Do not add behavior that reads or writes local JSON files as a runtime fallback — that hides configuration problems and leads to inconsistent production behavior.
