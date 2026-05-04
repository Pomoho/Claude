'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      if (data.devLink) {
        setDevLink(data.devLink);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function handleDevVerify() {
    if (!devLink) return;
    const token = new URL(devLink, 'http://x').searchParams.get('token') ?? '';
    const res = await fetch(`/api/auth/verify?token=${token}`);
    if (res.ok) router.push('/onboarding');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-sm text-white">IG</div>
        <span className="font-semibold text-lg text-slate-900">ImmoGuide IDF</span>
      </Link>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Connexion</h1>
        <p className="text-slate-500 text-sm mb-6">Entrez votre email pour accéder à votre espace.</p>

        {!devLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Adresse email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm transition"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold transition"
            >
              {loading ? 'Envoi…' : 'Continuer →'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-sm font-semibold text-green-800 mb-1">✓ Lien de connexion généré</p>
              <p className="text-xs text-green-600">Mode développement — cliquez ci-dessous pour vous connecter directement.</p>
            </div>
            <button
              onClick={handleDevVerify}
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition"
            >
              Accéder à mon espace →
            </button>
            <p className="text-xs text-slate-400 text-center">En production, un lien serait envoyé par email.</p>
          </div>
        )}
      </div>
    </div>
  );
}
