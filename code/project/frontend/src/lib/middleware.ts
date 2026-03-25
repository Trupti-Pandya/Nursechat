import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function middleware(
  request: NextRequest
): Promise<Response | undefined> {
  try {
    // Reset the auth cookie if the user isn't already logged in
    const refreshToken = request.cookies.get('sb-refresh-token')?.value
    const accessToken = request.cookies.get('sb-access-token')?.value
    
    // For non-auth pages, no additional auth check needed
    if (!request.nextUrl.pathname.startsWith('/admin')) {
      return NextResponse.next()
    }

    // Initialize Supabase auth Admin API
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    // Check if user is logged in
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // If no user is authenticated, redirect to login
    if (!user) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // For admin pages, check if user is an admin
    if (request.nextUrl.pathname.startsWith('/admin')) {
      // Get user profile including admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      // If not admin, redirect to unauthorized page
      if (!profile?.is_admin) {
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }

    // User is authenticated and authorized, proceed
    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    // Redirect to login on error
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }
}
