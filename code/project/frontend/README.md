# NurseChat Frontend

This is the frontend for the NurseChat application, a medical screening assistant for nurses.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Setting Up Supabase Authentication

The project uses Supabase for authentication and user management.

### Configuring OAuth Providers

To enable social login with Google, GitHub, and other providers:

1. Go to your Supabase project dashboard
2. Navigate to Authentication → Providers
3. Set up each provider you want to use:

#### Google OAuth Setup

1. Enable Google provider in Supabase
2. Create a Google Cloud project at [console.cloud.google.com](https://console.cloud.google.com/)
3. Configure OAuth consent screen
4. Create OAuth credentials (Web application type)
5. Add authorized redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
6. Copy the Client ID and Client Secret to Supabase

#### GitHub OAuth Setup

1. Enable GitHub provider in Supabase
2. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
3. Set Authorization callback URL to: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret to Supabase

### User Metadata

When users sign up, the application collects and stores:
- First name
- Last name
- Full name (combined from first and last)

This information is stored in the user's metadata in Supabase and is available through the Auth context in the application.

## Environment Variables

Create a `.env.local` file with the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
