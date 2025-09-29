# FitBuddy - Enterprise AI Fitness Platform

## Business Overview

FitBuddy is a comprehensive AI-powered fitness web application designed for business use, featuring user authentication, cloud persistence, administrative controls, and intelligent workout generation. The platform provides a complete fitness solution with modern UX/UI patterns inspired by successful apps like Duolingo.

### Core Business Features

#### 🔐 **User Management & Authentication**
- Complete user registration and sign-in system with JWT authentication
- Cloud-based data persistence using Supabase/PostgreSQL
- Cross-tab synchronization for seamless user experience
- Secure user profile management with avatar customization
- Terms of service and privacy policy acceptance tracking

#### 🤖 **AI-Powered Personalization**
- Google Gemini AI integration for intelligent workout generation
- Comprehensive questionnaire system (8+ questions) for user profiling
- Personalized 30-day workout plans based on user goals and fitness level
- AI chat interface for real-time workout advice and modifications
- Automatic action application from AI responses (JSON parsing and execution)

#### 📊 **Comprehensive Workout Management**
- Interactive calendar interface with 30-day workout plans
- Color-coded workout types (Strength, Cardio, Flexibility, Mixed, Rest)
- Batch workout addition and deletion capabilities
- Workout completion tracking with progress indicators
- Alternative workout options and equipment-specific modifications

#### 🎮 **Gamification & Engagement**
- Energy point system for user engagement
- In-app shop with purchasable avatars and items
- Streak tracking for workout consistency
- Achievement system for progress milestones
- Inventory management for purchased items

#### 🛡️ **Administrative Controls**
- Complete admin audit system with user management
- Banned username management
- Comprehensive audit logging for all user actions
- Server-side admin API with secure token authentication
- User promotion system (basic → admin conversion)

#### 💾 **Enterprise Data Management**
- Automatic cloud backup with debounced saving
- Cross-device data synchronization
- Chat history persistence across sessions
- Acceptance flag tracking in database columns
- Sanitized data handling to prevent corruption

#### 🎨 **Professional UI/UX**
- Duolingo-inspired design with consistent theming
- Fully responsive design for desktop and mobile
- Modern CSS3 with custom properties and animations
- Accessibility compliance with semantic HTML and ARIA attributes
- Professional loading states and error handling

## Technology Stack

### Frontend Architecture
- **React 18** with TypeScript for type-safe development
- **Vite** for fast build tooling and hot module replacement
- **React Router** for client-side routing
- **CSS3** with custom properties for consistent theming
- **Lucide React** for professional iconography
- **date-fns** for date manipulation and formatting

### Backend Infrastructure
- **Supabase/PostgreSQL** for cloud database and authentication
- **Vercel Serverless Functions** for API endpoints
- **JWT Authentication** with secure token management
- **Express.js** middleware for request handling
- **CORS** configuration for secure cross-origin requests

### AI Integration
- **Google Gemini API** for workout plan generation
- **Advanced JSON parsing** with fenced block extraction
- **Automatic action application** from AI responses
- **Context-aware prompting** with user data integration

### Development Tools
- **TypeScript** for compile-time type checking
- **ESLint** for code quality enforcement
- **Professional component architecture** with CSS modules
- **Environment variable management** for secure configuration
- **AI Integration**: Google Gemini API
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn
- Google Gemini API key (optional, for AI features)

### Employee Development Setup

### Prerequisites
- **Node.js 18+** and npm
- **Git** for version control
- **VS Code** recommended IDE
- **Google Cloud Account** for Gemini AI API
- **Supabase Account** for database services

### Initial Environment Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd fitness-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   
   Create a `.env` file in the project root with the following variables:
   
   ```env
   # Frontend Environment Variables (VITE_ prefix required)
   VITE_GEMINI_API_KEY=your-gemini-api-key-here
   VITE_ENABLE_AI=true
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   
   # Server Environment Variables (no VITE_ prefix)
   SUPABASE_URL=your-supabase-project-url
   SUPABASE_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   JWT_SECRET=your-secure-jwt-secret-here
   ADMIN_API_TOKEN=your-admin-api-token
   ```

4. **Generate Secure JWT Secret**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Access Application**
   - **Development**: `http://localhost:5173`
   - **Admin Panel**: `http://localhost:5173/admin` (requires admin privileges)

### Getting Required API Keys

#### Google Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key to your `.env` file as `VITE_GEMINI_API_KEY`

#### Supabase Configuration
1. Create a new project at [supabase.com](https://supabase.com)
2. Navigate to Settings → API
3. Copy your project URL and anon key
4. Generate a service role key for admin operations
5. Configure RLS policies for user data security

### TypeScript Compilation
The project uses strict TypeScript configuration. Ensure your changes compile without errors:
```bash
npm run build
```

## Application Architecture

### Component Structure
```
src/components/
├── WelcomePage.tsx/css           # Landing page with feature showcase
├── Questionnaire.tsx/css         # AI questionnaire for user profiling
├── WorkoutCalendar.tsx/css       # Main calendar with workout management
├── WorkoutModal.tsx/css          # Detailed workout view and editing
├── GeminiChatPage.tsx/css        # AI chat interface with action parsing
├── ProfilePage.tsx/css           # User profile and settings management
├── ShopPage.tsx/css              # In-app purchase system
├── AdminAuditPage.tsx/css        # Administrative controls and audit logs
├── SignInPage.tsx/css            # User authentication
├── SignUpPage.tsx/css            # User registration
├── Header.tsx/css                # Navigation and user status
├── Footer.tsx/css                # Site footer with links
└── AgreementBanner.tsx           # Terms/privacy acceptance banner
```

### Service Layer
```
src/services/
├── aiService.ts                  # Google Gemini AI integration
├── authService.ts                # User authentication and JWT handling
├── cloudBackupService.ts         # Supabase data persistence
├── localStorage.ts               # Local storage management
├── adminAuth.ts                  # Admin authentication helpers
└── supabaseAdminClient.ts        # Admin database client
```

### API Endpoints
```
api/
├── userdata/
│   ├── index.ts                  # User data CRUD operations
│   └── [action].ts               # Backup/restore actions
├── admin/
│   └── index.ts                  # Admin user management
├── ai/
│   └── generate.ts               # AI workout generation
├── auth/
│   └── index.ts                  # Authentication endpoints
└── _health.ts                    # Health check endpoint
```

## Feature Usage Guide

### User Journey Flow
1. **Welcome Page** → Feature introduction with animated cards
2. **Registration/Sign-in** → Account creation with cloud persistence
3. **Questionnaire** → AI-powered fitness assessment (8 questions)
4. **Workout Calendar** → 30-day personalized plan with daily workouts
5. **AI Chat** → Real-time workout advice and plan modifications
6. **Profile Management** → Stats tracking, avatar customization
7. **Shop System** → Energy-based purchases for enhanced experience

### Administrative Features
- **User Management**: View all users, modify user data, promote to admin
- **Audit Logging**: Track all user actions and system changes
- **Content Moderation**: Manage banned usernames and inappropriate content
- **System Health**: Monitor application performance and error logs

### AI Chat Capabilities
- **Automatic Action Parsing**: AI responses can modify user data automatically
- **JSON Command Extraction**: Supports both fenced code blocks and inline JSON
- **Workout Modification**: AI can update calendar workouts in real-time
- **Context Awareness**: AI maintains conversation history across sessions

## Production Deployment

### Vercel Deployment (Recommended)

1. **Prepare Environment Variables**
   In your Vercel dashboard, configure all environment variables:
   ```env
   VITE_GEMINI_API_KEY=your-gemini-api-key
   VITE_ENABLE_AI=true
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_URL=your-supabase-url
   SUPABASE_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   JWT_SECRET=your-secure-jwt-secret
   ADMIN_API_TOKEN=your-admin-token
   ```

2. **Deploy via Vercel CLI**
   ```bash
   npm install -g vercel
   vercel --prod
   ```

3. **Deploy via GitHub Integration**
   - Connect your GitHub repository to Vercel
   - Environment variables will be automatically applied
   - Automatic deployments on push to main branch

### Alternative Hosting Options
- **Netlify**: Build and drag-drop the `dist` folder
- **AWS S3 + CloudFront**: Static hosting with CDN
- **GitHub Pages**: Free hosting for public repositories

### Build Process
```bash
# Production build
npm run build

# Preview production build locally
npm run preview
```

## Database Management

### Supabase Setup

1. **Create Tables**
   Execute the SQL scripts in `/sql/` directory:
   ```sql
   -- Run setup_db.sql first
   -- Then run migrations in order
   ```

2. **Configure Row Level Security (RLS)**
   - Enable RLS on all user data tables
   - Set policies for user data access
   - Configure admin-only access for audit logs

3. **User Data Schema**
   ```sql
   CREATE TABLE user_data (
     user_id UUID PRIMARY KEY,
     payload JSONB,
     accepted_terms BOOLEAN DEFAULT FALSE,
     accepted_privacy BOOLEAN DEFAULT FALSE,
     chat_history JSONB,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   ```

### Admin User Management

To promote a user to admin status, use the SQL command:
```sql
UPDATE user_data 
SET payload = jsonb_set(payload, '{isAdmin}', 'true') 
WHERE user_id = 'user-uuid-here';
```

## Security Considerations

### Environment Variable Security
- **Frontend variables** (VITE_ prefix) are public and included in build
- **Server variables** (no prefix) remain secure on server-side
- **JWT_SECRET** must be cryptographically secure (64+ character hex)
- **Service role keys** provide admin database access

### Authentication Flow
1. User signs in → JWT token generated
2. Token stored in localStorage for persistence
3. Server validates JWT for protected endpoints
4. Admin endpoints require additional API token authentication

### Data Privacy
- User chat history stored separately from profile data
- Sensitive data backed up before sign-out
- Sanitized payloads prevent data corruption
- Audit logging for all administrative actions

## Troubleshooting Guide

### Common Development Issues

#### Build Errors
```bash
# TypeScript compilation errors
npm run build

# Clear node modules if dependency issues
rm -rf node_modules package-lock.json
npm install
```

#### Environment Variable Issues
- Ensure VITE_ prefix for frontend variables
- Verify Supabase URL format: `https://xxx.supabase.co`
- Check JWT_SECRET is properly generated hex string
- Confirm API keys have proper permissions

#### Database Connection Issues
- Verify Supabase project is active
- Check service role key permissions
- Ensure RLS policies allow appropriate access
- Test connection with health endpoint: `/api/_health`

#### AI Integration Issues
- Verify Gemini API key is valid and active
- Check quota limits on Google Cloud Console
- Ensure AI features are enabled: `VITE_ENABLE_AI=true`
- Monitor API usage for rate limiting

### Performance Optimization
- **Code Splitting**: Components lazy-loaded where appropriate
- **Image Optimization**: Use WebP format for assets
- **Caching**: Service workers for offline functionality
- **Database Indexing**: Optimize queries with proper indexes

## Maintenance & Monitoring

### Regular Tasks
- **Weekly**: Review audit logs for unusual activity
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and update AI prompts for accuracy
- **As needed**: Moderate banned usernames and user reports

### Monitoring Points
- **Error Rates**: Track JavaScript errors and failed API calls
- **Performance**: Monitor page load times and user engagement
- **Security**: Watch for suspicious authentication attempts
- **Usage**: Track feature adoption and user retention

### Backup Strategy
- **Automated**: Daily Supabase backups
- **Manual**: Export user data before major updates
- **Recovery**: Test restore procedures quarterly

## Support & Documentation

### Internal Resources
- **Codebase**: Well-documented with TypeScript interfaces
- **API Documentation**: Available at `/api/_health` for status
- **Admin Panel**: Full user management at `/admin`
- **Error Logs**: Available through admin audit system

### External Dependencies
- **Supabase Dashboard**: Database management and monitoring
- **Google Cloud Console**: Gemini AI usage and billing
- **Vercel Dashboard**: Deployment logs and performance metrics

For technical support or feature requests, contact the development team with specific error messages and reproduction steps.
3. Include screenshots if applicable

## Acknowledgments

- Inspired by Duolingo's excellent UX design
- Icons by Lucide React
- AI powered by Google Gemini
- Built with modern React and TypeScript

---

**Happy exercising! 💪🎯**
