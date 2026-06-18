import { withAuth } from 'next-auth/middleware';

const authMiddleware = withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: '/login',
  },
});

export default function proxy(req: any, event: any) {
  return authMiddleware(req, event);
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
