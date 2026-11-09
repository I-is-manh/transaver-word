import { Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAdmin, RequireAuth, RequireOnboarded } from '@/auth/guards';
import { AppLayout } from '@/components/AppLayout';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { AdminPage } from '@/pages/admin/AdminPage';
import { DeckDetailPage } from '@/pages/decks/DeckDetailPage';
import { DecksPage } from '@/pages/decks/DecksPage';
import { EmailVerifiedPage } from '@/pages/EmailVerifiedPage';
import { GoogleCallbackPage } from '@/pages/GoogleCallbackPage';
import { HomePage } from '@/pages/home/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ReviewPage } from '@/pages/review/ReviewPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { StatsPage } from '@/pages/stats/StatsPage';
import { TrashPage } from '@/pages/words/TrashPage';
import { WordDetailPage } from '@/pages/words/WordDetailPage';
import { WordsPage } from '@/pages/words/WordsPage';

export function App() {
  return (
    <>
      <ImpersonationBanner />
      <Routes>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/email-verified" element={<EmailVerifiedPage />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<AppLayout />}>
            {/* Trang quản trị không yêu cầu onboarding */}
            <Route element={<RequireAdmin />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
            <Route element={<RequireOnboarded />}>
              <Route index element={<HomePage />} />
              <Route path="review" element={<ReviewPage />} />
              <Route path="words" element={<WordsPage />} />
              <Route path="words/trash" element={<TrashPage />} />
              <Route path="words/:id" element={<WordDetailPage />} />
              <Route path="decks" element={<DecksPage />} />
              <Route path="decks/:id" element={<DeckDetailPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </>
  );
}
