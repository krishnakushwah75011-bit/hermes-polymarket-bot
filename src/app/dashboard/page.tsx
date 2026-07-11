// app/dashboard/page.tsx
// Dashboard root - redirects to overview

import { redirect } from 'next/navigation';

export default function DashboardRoot() {
  redirect('/dashboard/overview');
}