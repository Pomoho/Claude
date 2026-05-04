'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { SliderInput } from '@/components/ui';
import { loanCapacity, monthlyPayment } from '@/lib/scoring';
import type { UserProfile } from '@/lib/types';

const STEPS = ['Qui êtes-vous ?', 'Votre projet', 'Vos préférences', 'Financement'];

const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(v);

const defaults: UserProfile = {
  age: 32,
  familySituation: 'single',
  profession: 'cdi_private',
  monthlyIncome: 4000,
  downPayment: 30000,
  projectType: 'primary',
  holdingPeriod: 10,
  riskTolerance: 'medium',
  budget: 300000,
  propertyType: 'apartment',
  desiredSurface: 55,
  currentCity: 'Paris',
  maxCommute: 40,
  loanRate: 3.6,
  loanDuration: 25,
};

function RadioGroup<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; desc?: string }>;
}) {
  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-slate-700 mb-3">{label}</p>
      <div className="grid grid-cols-1 gap-2">
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition ${value === opt.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${value === opt.value ? 'border-brand-500 bg-brand-500' : 'border-slate-300'}`} />
            <div>
              <p className={`text-sm font-medium ${value === opt.value ? 'text-brand-700' : 'text-slate-800'}`}>{opt.label}</p>
              {opt.desc && <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [profile, setProfile] = useState<UserProfile>(defaults);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const set = <K extends keyof UserProfile>(key: K, val: UserProfile[K]) =>
    setProfile(p => ({ ...p, [key]: val }));

  const capacity = loanCapacity(profile.monthlyIncome, profile.loanRate / 100, profile.loanDuration);
  const maxBudget = capacity + profile.downPayment;
  const principal = Math.max(0, profile.budget - profile.downPayment);
  const monthly = monthlyPayment(principal, profile.loanRate / 100, profile.loanDuration);
  const effort = profile.monthlyIncome > 0 ? monthly / profile.monthlyIncome : 0;

  function goNext() {
    if (step < STEPS.length - 1) { setDir(1); setStep(s => s + 1); }
  }
  function goBack() {
    if (step > 0) { setDir(-1); setStep(s => s - 1); }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: profile.age,
          familySituation: profile.familySituation,
          profession: profile.profession,
          monthlyIncome: profile.monthlyIncome,
          downPayment: profile.downPayment,
          projectType: profile.projectType,
          holdingPeriod: profile.holdingPeriod,
          riskTolerance: profile.riskTolerance,
          budget: profile.budget,
          propertyType: profile.propertyType,
          desiredSurface: profile.desiredSurface,
          currentCity: profile.currentCity,
          maxCommute: profile.maxCommute,
          loanRate: profile.loanRate,
          loanDuration: profile.loanDuration,
        }),
      });
      // Store in localStorage for dashboard (client-side fallback)
      localStorage.setItem('immo_profile', JSON.stringify(profile));
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  const variants = {
    enter: (d: number) => ({ x: d * 60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: -d * 60, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Progress header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Étape {step + 1} / {STEPS.length}</span>
            <span className="text-sm font-semibold text-slate-700">{STEPS[step]}</span>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-brand-500' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center py-10 px-4">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: 'easeInOut' }}>

              {step === 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">Parlez-nous de vous</h2>
                  <p className="text-slate-500 mb-8">Ces informations nous permettent de personnaliser vos recommandations.</p>

                  <SliderInput label="Âge" value={profile.age} min={18} max={75} onChange={v => set('age', v)} format={v => `${v} ans`} />
                  <RadioGroup label="Situation familiale" value={profile.familySituation} onChange={v => set('familySituation', v)} options={[
                    { value: 'single', label: 'Célibataire' },
                    { value: 'couple', label: 'En couple', desc: 'Revenus à prendre en compte individuellement ici' },
                    { value: 'family', label: 'Famille avec enfants' },
                  ]} />
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Profession</label>
                    <select value={profile.profession} onChange={e => set('profession', e.target.value as UserProfile['profession'])}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm">
                      <option value="cdi_private">CDI — Secteur privé</option>
                      <option value="cdi_public">CDI — Fonction publique</option>
                      <option value="fonctionnaire">Fonctionnaire titulaire</option>
                      <option value="cdd">CDD</option>
                      <option value="freelance">Freelance / Auto-entrepreneur</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <SliderInput label="Revenu net mensuel" value={profile.monthlyIncome} min={1500} max={15000} step={100} onChange={v => set('monthlyIncome', v)} format={v => `${fmt(v)} €`} hint="Votre salaire net après impôts, avant charges" />
                  <SliderInput label="Apport personnel disponible" value={profile.downPayment} min={0} max={200000} step={1000} onChange={v => set('downPayment', v)} format={v => `${fmt(v)} €`} hint="Économies que vous pouvez mobiliser pour ce projet" />
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">Votre projet immobilier</h2>
                  <p className="text-slate-500 mb-8">Définissez vos objectifs pour affiner nos recommandations.</p>

                  <RadioGroup label="Type de projet" value={profile.projectType} onChange={v => set('projectType', v)} options={[
                    { value: 'primary', label: 'Résidence principale', desc: 'Pour y habiter' },
                    { value: 'investment', label: 'Investissement locatif', desc: 'Pour louer et générer des revenus' },
                  ]} />
                  <SliderInput label="Horizon de détention" value={profile.holdingPeriod} min={1} max={25} onChange={v => set('holdingPeriod', v)} format={v => `${v} an${v > 1 ? 's' : ''}`} hint="Combien de temps prévoyez-vous de conserver ce bien ?" />
                  <RadioGroup label="Tolérance au risque" value={profile.riskTolerance} onChange={v => set('riskTolerance', v)} options={[
                    { value: 'low', label: 'Faible', desc: 'Je préfère la sécurité et les biens clés en main' },
                    { value: 'medium', label: 'Modérée', desc: 'J\'accepte quelques travaux si le prix est bon' },
                    { value: 'high', label: 'Élevée', desc: 'Je cherche à maximiser la valeur ajoutée' },
                  ]} />
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">Vos préférences</h2>
                  <p className="text-slate-500 mb-8">Décrivez le bien idéal que vous recherchez.</p>

                  <SliderInput label="Budget total maximum" value={profile.budget} min={80000} max={900000} step={5000} onChange={v => set('budget', v)} format={v => `${fmt(v)} €`} hint={`Apport inclus · Prix moyen IDF : ~5 500 €/m²`} />
                  <RadioGroup label="Type de bien" value={profile.propertyType} onChange={v => set('propertyType', v)} options={[
                    { value: 'apartment', label: 'Appartement' },
                    { value: 'house', label: 'Maison' },
                    { value: 'any', label: 'Indifférent' },
                  ]} />
                  <SliderInput label="Surface souhaitée" value={profile.desiredSurface} min={20} max={200} onChange={v => set('desiredSurface', v)} format={v => `${v} m²`} hint={`≈ ${fmt(Math.round(profile.budget / profile.desiredSurface))} €/m²`} />
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Ville / zone actuelle</label>
                    <input type="text" value={profile.currentCity} onChange={e => set('currentCity', e.target.value)}
                      placeholder="Ex: Paris, Boulogne…"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                  </div>
                  <SliderInput label="Temps de trajet max vers Paris" value={profile.maxCommute} min={5} max={90} step={5} onChange={v => set('maxCommute', v)} format={v => `${v} min`} hint="Trajet domicile → Paris centre en transports" />
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">Capacité de financement</h2>
                  <p className="text-slate-500 mb-8">Ajustez les paramètres du crédit et découvrez votre capacité.</p>

                  <SliderInput label="Taux d'intérêt estimé" value={profile.loanRate} min={2.0} max={7.0} step={0.05} onChange={v => set('loanRate', v)} format={v => `${v.toFixed(2)} %`} hint="Taux marché mai 2025 : ~3,3-3,8 % sur 25 ans" />
                  <div className="mb-6">
                    <p className="text-sm font-medium text-slate-700 mb-3">Durée du crédit</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[15, 20, 25].map(d => (
                        <button key={d} type="button" onClick={() => set('loanDuration', d)}
                          className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${profile.loanDuration === d ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                          {d} ans
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-brand-50 rounded-xl p-4">
                      <p className="text-xs text-brand-600 font-semibold uppercase mb-1">Capacité d'emprunt</p>
                      <p className="text-xl font-black text-brand-800">{fmt(Math.round(capacity))} €</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Budget max total</p>
                      <p className="text-xl font-black text-slate-800">{fmt(Math.round(maxBudget))} €</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Mensualité estimée</p>
                      <p className="text-xl font-black text-slate-800">{fmt(Math.round(monthly))} €/mois</p>
                    </div>
                    <div className={`${effort > 0.35 ? 'bg-red-50' : 'bg-green-50'} rounded-xl p-4`}>
                      <p className={`text-xs font-semibold uppercase mb-1 ${effort > 0.35 ? 'text-red-600' : 'text-green-600'}`}>Taux d'effort</p>
                      <p className={`text-xl font-black ${effort > 0.35 ? 'text-red-800' : 'text-green-800'}`}>{(effort * 100).toFixed(1)} %</p>
                    </div>
                  </div>
                  {effort > 0.35 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      ⚠️ Taux d'effort &gt; 35 % — les banques peuvent refuser le crédit. Réduisez le budget ou allongez la durée.
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            <button onClick={goBack} disabled={step === 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition">
              ← Retour
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={goNext} className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition">
                Continuer →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold transition">
                {loading ? 'Analyse en cours…' : 'Voir mes recommandations →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
