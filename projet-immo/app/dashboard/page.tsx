'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { Card, Badge, ScoreBar, FactorRow } from '@/components/ui';
import { scoreBuyVsRent, scoreNewVsOld, scoreCities, simulateFinancial, loanCapacity, monthlyPayment } from '@/lib/scoring';
import type { UserProfile, ScoredCity } from '@/lib/types';
import { IDF_CITIES } from '@/lib/data/idf-cities';

const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(Math.round(v));
const fmtE = (v: number) => `${fmt(v)} €`;

const PLATFORMS = [
  {
    id: 'seloger', label: 'SeLoger', color: 'bg-blue-600', icon: '🏠',
    buildUrl: (city: string, budget: number, surface: number, type: string) => {
      const t = type === 'house' ? '2' : '1';
      return `https://www.seloger.com/list.htm?types=${t}&price=NaN/${budget}&surf=${surface}/NaN&ci=${encodeURIComponent(city.toLowerCase())}`;
    },
  },
  {
    id: 'leboncoin', label: 'Leboncoin', color: 'bg-orange-500', icon: '🔍',
    buildUrl: (city: string, budget: number, surface: number) =>
      `https://www.leboncoin.fr/recherche?category=9&text=${encodeURIComponent(city)}&price=0-${budget}&square=${surface}-max`,
  },
  {
    id: 'bienici', label: "Bien'ici", color: 'bg-green-600', icon: '🌿',
    buildUrl: (city: string, budget: number, surface: number) =>
      `https://www.bienici.com/recherche/achat?maxPrice=${budget}&minSize=${surface}&locationIds=${encodeURIComponent(city)}`,
  },
];

const defaults: UserProfile = {
  age: 32, familySituation: 'single', profession: 'cdi_private',
  monthlyIncome: 4000, downPayment: 30000, projectType: 'primary',
  holdingPeriod: 10, riskTolerance: 'medium', budget: 300000,
  propertyType: 'apartment', desiredSurface: 55, currentCity: 'Paris',
  maxCommute: 40, loanRate: 3.6, loanDuration: 25,
};

function ScoreCard({ title, score, label, badge, badgeColor, children }: {
  title: string; score: number; label: string;
  badge: string; badgeColor: 'green' | 'amber' | 'slate' | 'blue' | 'violet' | 'red';
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-bold text-slate-900">{title}</h3>
        <Badge color={badgeColor}>{badge}</Badge>
      </div>
      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-3xl font-black text-slate-900">{score}<span className="text-lg font-normal text-slate-400">/100</span></span>
        </div>
        <ScoreBar score={score} />
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-4">{label}</p>
      {children}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [alerts, setAlerts] = useState<Array<{ id: string; title: string; platform: string; url: string; city: string }>>([]);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertCity, setAlertCity] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);
  const [expandedFactors, setExpandedFactors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load profile from localStorage (set during onboarding)
    const stored = localStorage.getItem('immo_profile');
    if (stored) {
      try { setProfile(JSON.parse(stored)); } catch { setProfile(defaults); }
    } else {
      setProfile(defaults);
    }
    // Load alerts
    fetch('/api/alerts').then(r => r.json()).then(d => { if (d.alerts) setAlerts(d.alerts); }).catch(() => {});
  }, []);

  const buyRent = useMemo(() => profile ? scoreBuyVsRent(profile) : null, [profile]);
  const newOld = useMemo(() => profile ? scoreNewVsOld(profile) : null, [profile]);
  const cities = useMemo(() => profile ? scoreCities(profile) : [], [profile]);
  const topCity = cities[0] ?? null;
  const financialData = useMemo(() => profile ? simulateFinancial(profile, topCity) : [], [profile, topCity]);

  const capacity = profile ? loanCapacity(profile.monthlyIncome, profile.loanRate / 100, profile.loanDuration) : 0;
  const monthly = profile ? monthlyPayment(Math.max(0, profile.budget - profile.downPayment), profile.loanRate / 100, profile.loanDuration) : 0;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('immo_profile');
    router.push('/');
  }

  async function saveAlert(city: ScoredCity | null, platform: typeof PLATFORMS[0]) {
    if (!profile) return;
    const targetCity = city ?? topCity;
    if (!targetCity) return;
    setSavingAlert(true);
    const url = platform.buildUrl(targetCity.name, profile.budget, profile.desiredSurface, profile.propertyType);
    const title = `${targetCity.name} — ${platform.label}`;
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, platform: platform.id, url, city: targetCity.name, budget: profile.budget, surface: profile.desiredSurface, type: profile.propertyType }),
    });
    if (res.ok) {
      const data = await res.json();
      setAlerts(a => [data.alert, ...a]);
    }
    setSavingAlert(false);
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>;
  }

  const buyBadge = (s: number) => s >= 65 ? 'green' : s >= 45 ? 'amber' : 'red';
  const newBadge = (s: number) => s >= 65 ? 'blue' : s >= 45 ? 'amber' : 'violet';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-xs text-white">IG</div>
            <span className="font-semibold text-slate-900">ImmoGuide IDF</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/onboarding" className="text-sm text-brand-600 hover:text-brand-700 font-medium">Modifier mon profil</Link>
            <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-700">Déconnexion</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Key metrics strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Capacité d\'emprunt', value: fmtE(capacity), sub: 'à 35 % d\'effort' },
            { label: 'Budget total', value: fmtE(profile.budget), sub: `Apport : ${fmtE(profile.downPayment)}` },
            { label: 'Mensualité estimée', value: `${fmt(monthly)} €/mois`, sub: `${profile.loanRate} % sur ${profile.loanDuration} ans` },
            { label: 'Horizon détention', value: `${profile.holdingPeriod} ans`, sub: profile.projectType === 'investment' ? 'Investissement' : 'Résidence principale' },
          ].map(m => (
            <Card key={m.label} className="text-center">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">{m.label}</p>
              <p className="text-xl font-black text-slate-900">{m.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{m.sub}</p>
            </Card>
          ))}
        </div>

        {/* Recommendations */}
        <h2 className="text-lg font-bold text-slate-900 mb-4">Recommandations personnalisées</h2>
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {buyRent && (
            <ScoreCard
              title="Acheter ou Louer ?"
              score={buyRent.score}
              label={buyRent.label}
              badge={buyRent.score >= 58 ? 'Acheter' : buyRent.score >= 42 ? 'Neutre' : 'Louer'}
              badgeColor={buyBadge(buyRent.score) as 'green' | 'amber' | 'red'}
            >
              <button onClick={() => setExpandedFactors(e => ({ ...e, buyRent: !e.buyRent }))}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium mb-2">
                {expandedFactors.buyRent ? '▲ Masquer' : '▼ Voir les facteurs'}
              </button>
              {expandedFactors.buyRent && (
                <div className="mt-2">
                  {buyRent.factors.map(f => <FactorRow key={f.label} {...f} />)}
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-xs text-slate-500">Mensualité achat</p>
                  <p className="font-bold text-sm">{fmtE(buyRent.estimatedMonthlyPayment)}/mois</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-xs text-slate-500">Loyer équivalent</p>
                  <p className="font-bold text-sm">{fmtE(buyRent.estimatedMonthlyRent)}/mois</p>
                </div>
              </div>
            </ScoreCard>
          )}
          {newOld && (
            <ScoreCard
              title="Neuf ou Ancien ?"
              score={newOld.score}
              label={newOld.label}
              badge={newOld.score >= 58 ? 'Neuf' : newOld.score >= 42 ? 'Au cas par cas' : 'Ancien'}
              badgeColor={newBadge(newOld.score) as 'blue' | 'amber' | 'violet'}
            >
              <button onClick={() => setExpandedFactors(e => ({ ...e, newOld: !e.newOld }))}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                {expandedFactors.newOld ? '▲ Masquer' : '▼ Voir les facteurs'}
              </button>
              {expandedFactors.newOld && (
                <div className="mt-2">
                  {newOld.factors.map(f => <FactorRow key={f.label} {...f} />)}
                </div>
              )}
            </ScoreCard>
          )}
        </div>

        {/* City recommendations */}
        <h2 className="text-lg font-bold text-slate-900 mb-4">Top 5 villes recommandées</h2>
        <Card padding={false} className="mb-8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ville</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Prix/m²</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Surface dispo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rendement</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trajet Paris</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {cities.map((city, idx) => (
                  <tr key={city.id} className={`border-b border-slate-100 hover:bg-slate-50 ${idx === 0 ? 'bg-brand-50/30' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{idx + 1}</span>
                        <div>
                          <p className="font-semibold text-slate-900">{city.name}</p>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {city.hasRER && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">RER</span>}
                            {city.hasMetro && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Métro</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-slate-900">{city.totalScore}/100</span>
                        <div className="w-20"><ScoreBar score={city.totalScore} /></div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-slate-700">{fmt(city.pricePerSqm)} €/m²</td>
                    <td className="px-4 py-4 text-right">
                      <span className={`font-semibold ${city.affordableSurface >= profile.desiredSurface ? 'text-green-700' : 'text-amber-600'}`}>
                        {fmt(city.affordableSurface)} m²
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">{city.rentalYield} %</td>
                    <td className="px-4 py-4 text-right">
                      <span className={city.transitTimeToCenter <= profile.maxCommute ? 'text-green-700 font-medium' : 'text-red-500 font-medium'}>
                        {city.transitTimeToCenter} min
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button onClick={() => { setAlertCity(city.id); setShowAlertForm(true); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 font-medium transition">
                        + Alerte
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pros/Cons for top city */}
          {topCity && (
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Analyse — {topCity.name}</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-green-600 font-semibold mb-1">✓ Points forts</p>
                  <ul className="space-y-0.5">{topCity.pros.map(p => <li key={p} className="text-xs text-slate-600">• {p}</li>)}</ul>
                </div>
                <div>
                  <p className="text-xs text-red-500 font-semibold mb-1">✗ Points faibles</p>
                  <ul className="space-y-0.5">{topCity.cons.map(p => <li key={p} className="text-xs text-slate-600">• {p}</li>)}</ul>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Financial chart */}
        <h2 className="text-lg font-bold text-slate-900 mb-4">Simulation financière sur {profile.holdingPeriod} ans</h2>
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <h3 className="font-semibold text-slate-800 mb-4 text-sm">Coût cumulé : achat vs location</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" label={{ value: 'Années', position: 'insideBottom', offset: -2, fontSize: 10 }} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmtE(v)} labelFormatter={(l) => `Année ${l}`} />
                <Legend verticalAlign="top" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="buyCumCost" name="Coût achat" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="rentCumCost" name="Coût location" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3 className="font-semibold text-slate-800 mb-4 text-sm">Valeur du patrimoine (si achat)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={financialData.filter((_, i) => i % 2 === 0 || i === financialData.length - 1)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmtE(v)} labelFormatter={(l) => `Année ${l}`} />
                <Legend verticalAlign="top" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="propertyValue" name="Valeur du bien" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="netWealthBuy" name="Patrimoine net" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Alerts */}
        <h2 className="text-lg font-bold text-slate-900 mb-4">Alertes immobilières</h2>
        <Card className="mb-8">
          <p className="text-sm text-slate-600 mb-4">Générez des alertes de recherche filtrées sur les grandes plateformes.</p>
          {/* Quick create for top 5 cities */}
          <div className="space-y-3 mb-6">
            {cities.slice(0, 3).map(city => (
              <div key={city.id} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{city.name}</p>
                  <p className="text-xs text-slate-500">{fmtE(profile.budget)} · {profile.desiredSurface} m² min</p>
                </div>
                <div className="flex gap-2">
                  {PLATFORMS.map(p => (
                    <a key={p.id}
                      href={p.buildUrl(city.name, profile.budget, profile.desiredSurface, profile.propertyType)}
                      target="_blank" rel="noopener noreferrer"
                      onClick={() => saveAlert(city, p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 ${p.color}`}>
                      {p.icon} {p.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Saved alerts */}
          {alerts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Alertes sauvegardées</p>
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div key={alert.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{alert.platform}</span>
                      <span className="text-sm text-slate-700 truncate">{alert.title}</span>
                    </div>
                    <a href={alert.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium shrink-0">
                      Ouvrir →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Methodology note */}
        <Card className="bg-slate-50 border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Méthodologie</p>
          <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
            <li>Scoring acheter/louer : horizon, stabilité, taux, apport, ratio mensualité/loyer.</li>
            <li>Scoring neuf/ancien : budget/m², objectif, tolérance travaux, surface, horizon énergétique.</li>
            <li>Scoring villes : budget (35 %), investissement (20 %), transports (20 %), qualité de vie (15 %), tension marché (10 %).</li>
            <li>Prix IDF : données simulées indicatives 2024-2025 · Taux d'effort max : 35 % (HCSF).</li>
            <li>Cette simulation est indicative et ne remplace pas un conseil professionnel.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
