'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { SliderInput } from '@/components/ui';
import { loanCapacity, monthlyPayment, calcPTZ } from '@/lib/scoring';
import type { UserProfile } from '@/lib/types';

// ─── Steps definition ─────────────────────────────────────────────────────────
const STEPS = [
  'Votre profil',
  'Logement actuel',
  'Votre projet',
  'Vos préférences',
  'Financement & PTZ',
];

const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(v);

const PTZ_ZONE_LABELS: Record<string, string> = {
  A_bis: 'Zone A bis — Paris intra-muros',
  A:     'Zone A — Hauts-de-Seine, Val-de-Marne…',
  B1:    'Zone B1 — Seine-Saint-Denis, grande couronne proche',
  B2:    'Zone B2 — Grande couronne intermédiaire',
  C:     'Zone C — Zones rurales / périphériques',
};

const MOVING_REASONS = [
  { id: 'budget',    label: 'Loyer trop élevé',       icon: '💸' },
  { id: 'space',     label: 'Surface insuffisante',    icon: '📐' },
  { id: 'location',  label: 'Quartier / localisation', icon: '📍' },
  { id: 'quality',   label: 'Qualité / DPE du logement', icon: '🏚️' },
  { id: 'family',    label: 'Évolution familiale',     icon: '👨‍👩‍👧' },
  { id: 'wealth',    label: 'Constitution d\'un patrimoine', icon: '🏠' },
  { id: 'investment',label: 'Investissement locatif',  icon: '📈' },
  { id: 'other',     label: 'Autre raison',            icon: '…' },
];

const defaults: UserProfile = {
  age: 32,
  familySituation: 'single',
  profession: 'cdi_private',
  monthlyIncome: 4000,
  downPayment: 30000,
  housingStatus: 'tenant',
  currentSurface: 40,
  currentRent: 1200,
  currentCharges: 150,
  ownerCopropriete: 2400,
  ownerTaxeFonciere: 900,
  currentLocation: 'Paris',
  movingReasons: ['wealth'],
  workDistance: 5,
  workTransport: 'metro',
  rfr: 30000,
  ptzZone: 'B1',
  projectType: 'primary',
  holdingPeriod: 10,
  riskTolerance: 'medium',
  budget: 300000,
  propertyType: 'apartment',
  desiredSurface: 55,
  maxCommute: 40,
  loanRate: 3.6,
  loanDuration: 25,
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function RadioGroup<T extends string>({ label, value, onChange, options, columns = 1 }: {
  label?: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; desc?: string; icon?: string }>;
  columns?: number;
}) {
  return (
    <div className="mb-6">
      {label && <p className="text-sm font-medium text-slate-700 mb-3">{label}</p>}
      <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition ${value === opt.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
            {opt.icon && <span className="text-xl">{opt.icon}</span>}
            <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${value === opt.value ? 'border-brand-500 bg-brand-500' : 'border-slate-300'}`} />
            <div className="min-w-0">
              <p className={`text-sm font-medium leading-tight ${value === opt.value ? 'text-brand-700' : 'text-slate-800'}`}>{opt.label}</p>
              {opt.desc && <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Checkbox({ id, label, icon, checked, onChange }: {
  id: string; label: string; icon: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition ${checked ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
      <span className="text-lg leading-none">{icon}</span>
      <span className={`text-xs font-medium ${checked ? 'text-brand-700' : 'text-slate-700'}`}>{label}</span>
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 mt-6">{children}</h3>;
}

function InfoBox({ children, color = 'blue' }: { children: React.ReactNode; color?: 'blue' | 'amber' | 'green' | 'red' }) {
  const cls = {
    blue:  'bg-brand-50 border-brand-200 text-brand-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    red:   'bg-red-50 border-red-200 text-red-800',
  }[color];
  return <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${cls} mb-4`}>{children}</div>;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [profile, setProfile] = useState<UserProfile>(defaults);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const set = <K extends keyof UserProfile>(key: K, val: UserProfile[K]) =>
    setProfile(p => ({ ...p, [key]: val }));

  const toggleReason = (id: string) => {
    setProfile(p => ({
      ...p,
      movingReasons: p.movingReasons.includes(id)
        ? p.movingReasons.filter(r => r !== id)
        : [...p.movingReasons, id],
    }));
  };

  // Computed values for step 5
  const capacity     = loanCapacity(profile.monthlyIncome, profile.loanRate / 100, profile.loanDuration);
  const maxBudget    = capacity + profile.downPayment;
  const principal    = Math.max(0, profile.budget - profile.downPayment);
  const monthly      = monthlyPayment(principal, profile.loanRate / 100, profile.loanDuration);
  const effort       = profile.monthlyIncome > 0 ? monthly / profile.monthlyIncome : 0;
  const ptz          = calcPTZ(profile, profile.budget);

  function goNext() { if (step < STEPS.length - 1) { setDir(1); setStep(s => s + 1); } }
  function goBack() { if (step > 0) { setDir(-1); setStep(s => s - 1); } }

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
          currentCity: profile.currentLocation,
          maxCommute: profile.maxCommute,
          loanRate: profile.loanRate,
          loanDuration: profile.loanDuration,
        }),
      });
      localStorage.setItem('immo_profile', JSON.stringify(profile));
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  const variants = {
    enter:  (d: number) => ({ x: d * 60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: -d * 60, opacity: 0 }),
  };

  // ─── Render step content ───────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // ── Step 1 — Profil ──────────────────────────────────────────────────
      case 0:
        return (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Parlez-nous de vous</h2>
            <p className="text-slate-500 text-sm mb-8">Ces informations nous permettent de personnaliser vos recommandations et de calculer votre capacité d'emprunt.</p>

            <SliderInput label="Âge" value={profile.age} min={18} max={75}
              onChange={v => set('age', v)} format={v => `${v} ans`} />

            <RadioGroup label="Situation familiale" value={profile.familySituation} onChange={v => set('familySituation', v)}
              options={[
                { value: 'single', label: 'Célibataire' },
                { value: 'couple', label: 'En couple', desc: 'Renseignez ici votre seul revenu (ou cumulez les deux)' },
                { value: 'family', label: 'Famille avec enfants' },
              ]} />

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Profession</label>
              <select value={profile.profession} onChange={e => set('profession', e.target.value as UserProfile['profession'])}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm bg-white">
                <option value="cdi_private">CDI — Secteur privé</option>
                <option value="cdi_public">CDI — Fonction publique</option>
                <option value="fonctionnaire">Fonctionnaire titulaire</option>
                <option value="cdd">CDD</option>
                <option value="freelance">Freelance / Auto-entrepreneur</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <SliderInput label="Revenu net mensuel" value={profile.monthlyIncome} min={1500} max={15000} step={100}
              onChange={v => set('monthlyIncome', v)} format={v => `${fmt(v)} €`}
              hint="Salaire net après impôts, avant charges · Cumulez les deux revenus si vous empruntez en couple" />

            <SliderInput label="Apport personnel disponible" value={profile.downPayment} min={0} max={200000} step={1000}
              onChange={v => set('downPayment', v)} format={v => `${fmt(v)} €`}
              hint="Économies mobilisables — les banques demandent généralement min. 10 % du prix" />
          </>
        );

      // ── Step 2 — Logement actuel ─────────────────────────────────────────
      case 1:
        return (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Votre logement actuel</h2>
            <p className="text-slate-500 text-sm mb-8">Votre situation actuelle influence directement notre comparaison financière et votre éligibilité aux aides.</p>

            {/* Statut */}
            <RadioGroup label="Vous êtes actuellement…" value={profile.housingStatus} onChange={v => set('housingStatus', v)}
              options={[
                { value: 'tenant', label: 'Locataire', desc: 'Locataire de votre résidence principale', icon: '🔑' },
                { value: 'owner_occupant', label: 'Propriétaire occupant', desc: 'Vous êtes déjà propriétaire de votre résidence principale', icon: '🏠' },
              ]} />

            {/* Localisation */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Ville / arrondissement actuel</label>
              <input type="text" value={profile.currentLocation} onChange={e => set('currentLocation', e.target.value)}
                placeholder="Ex: Paris 11e, Boulogne…"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
            </div>

            <SliderInput label="Surface actuelle" value={profile.currentSurface} min={10} max={200}
              onChange={v => set('currentSurface', v)} format={v => `${v} m²`} />

            {/* Détails selon statut */}
            {profile.housingStatus === 'tenant' ? (
              <>
                <SectionTitle>Détail de votre location</SectionTitle>
                <SliderInput label="Loyer mensuel hors charges" value={profile.currentRent} min={300} max={4000} step={10}
                  onChange={v => set('currentRent', v)} format={v => `${fmt(v)} €/mois`}
                  hint={`Loyer annuel : ${fmt(profile.currentRent * 12)} € · utilisé pour comparer avec vos futures mensualités`} />
                <SliderInput label="Charges mensuelles (copropriété + divers)" value={profile.currentCharges} min={0} max={800} step={10}
                  onChange={v => set('currentCharges', v)} format={v => `${fmt(v)} €/mois`}
                  hint={`Coût logement total : ${fmt(profile.currentRent + profile.currentCharges)} €/mois`} />
              </>
            ) : (
              <>
                <SectionTitle>Détail de votre bien actuel</SectionTitle>
                <SliderInput label="Charges de copropriété annuelles" value={profile.ownerCopropriete} min={0} max={8000} step={50}
                  onChange={v => set('ownerCopropriete', v)} format={v => `${fmt(v)} €/an`}
                  hint={`≈ ${fmt(Math.round(profile.ownerCopropriete / 12))} €/mois`} />
                <SliderInput label="Taxe foncière annuelle" value={profile.ownerTaxeFonciere} min={0} max={5000} step={50}
                  onChange={v => set('ownerTaxeFonciere', v)} format={v => `${fmt(v)} €/an`} />
                <InfoBox color="amber">
                  ⚠️ En tant que <strong>propriétaire occupant</strong>, vous n'êtes <strong>pas éligible au PTZ</strong> (réservé aux primo-accédants). Vous devrez probablement vendre votre bien actuel avant d'acheter, ou financer un second bien si votre capacité le permet.
                </InfoBox>
              </>
            )}

            {/* Raisons du déménagement */}
            <SectionTitle>Pourquoi changer de logement ?</SectionTitle>
            <p className="text-xs text-slate-500 mb-3">Sélectionnez tout ce qui s'applique.</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {MOVING_REASONS.map(r => (
                <Checkbox key={r.id} id={r.id} label={r.label} icon={r.icon}
                  checked={profile.movingReasons.includes(r.id)}
                  onChange={() => toggleReason(r.id)} />
              ))}
            </div>
            {profile.movingReasons.length === 0 && (
              <p className="text-xs text-amber-600 mb-4">Sélectionnez au moins une raison.</p>
            )}

            {/* Trajet domicile — travail */}
            <SectionTitle>Trajet domicile → travail</SectionTitle>
            <SliderInput label="Distance actuelle jusqu'au lieu de travail" value={profile.workDistance} min={0} max={60} step={1}
              onChange={v => set('workDistance', v)} format={v => v === 0 ? 'Télétravail' : `${v} km`}
              hint="En ligne droite approximative · aide à scorer les villes par rapport à votre lieu de travail" />

            <RadioGroup label="Mode de transport principal vers le travail" value={profile.workTransport} onChange={v => set('workTransport', v)}
              options={[
                { value: 'metro', label: 'Transports en commun', desc: 'Métro, RER, bus, tram', icon: '🚇' },
                { value: 'bike',  label: 'Vélo / trottinette',   desc: 'Mobilité douce', icon: '🚲' },
                { value: 'car',   label: 'Voiture',              desc: 'Véhicule personnel / covoiturage', icon: '🚗' },
                { value: 'mixed', label: 'Mixte',                desc: 'Combinaison selon les jours', icon: '🔄' },
              ]} />

            {/* PTZ — uniquement si locataire */}
            {profile.housingStatus === 'tenant' && (
              <>
                <SectionTitle>Situation fiscale (PTZ 2026)</SectionTitle>
                <InfoBox color="blue">
                  💡 En tant que locataire, vous êtes potentiellement <strong>primo-accédant</strong> et pouvez bénéficier du <strong>Prêt à Taux Zéro 2026</strong> (décret n°2025-299). Renseignez votre revenu fiscal pour estimer votre aide.
                </InfoBox>
                <SliderInput label="Revenu fiscal de référence N-2 (avis d'imposition)" value={profile.rfr} min={10000} max={80000} step={500}
                  onChange={v => set('rfr', v)} format={v => `${fmt(v)} €`}
                  hint="Ligne « Revenu fiscal de référence » sur votre dernier avis d'imposition (N-2 = 2 ans avant l'achat)" />
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Zone PTZ du bien visé</label>
                  <select value={profile.ptzZone} onChange={e => set('ptzZone', e.target.value as UserProfile['ptzZone'])}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm bg-white">
                    {Object.entries(PTZ_ZONE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Paris = A bis · Hauts-de-Seine = A · Seine-Saint-Denis, Val-de-Marne, Yvelines = B1 · Grande couronne éloignée = B2/C</p>
                </div>
              </>
            )}
          </>
        );

      // ── Step 3 — Projet ──────────────────────────────────────────────────
      case 2:
        return (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Votre projet immobilier</h2>
            <p className="text-slate-500 text-sm mb-8">Définissez vos objectifs pour affiner nos recommandations.</p>

            <RadioGroup label="Type de projet" value={profile.projectType} onChange={v => set('projectType', v)}
              options={[
                { value: 'primary',    label: 'Résidence principale', desc: 'Pour y vivre', icon: '🏡' },
                { value: 'investment', label: 'Investissement locatif', desc: 'Pour louer et générer des revenus', icon: '📈' },
              ]} />

            {profile.projectType === 'primary' && profile.housingStatus === 'owner_occupant' && (
              <InfoBox color="amber">
                Votre projet implique probablement la <strong>revente de votre bien actuel</strong>. Pensez à inclure le produit de la vente dans votre apport disponible.
              </InfoBox>
            )}

            <SliderInput label="Horizon de détention" value={profile.holdingPeriod} min={1} max={25}
              onChange={v => set('holdingPeriod', v)} format={v => `${v} an${v > 1 ? 's' : ''}`}
              hint="Combien de temps prévoyez-vous de conserver ce bien ? (impact fort sur la rentabilité de l'achat)" />

            <RadioGroup label="Tolérance au risque et aux travaux" value={profile.riskTolerance} onChange={v => set('riskTolerance', v)}
              options={[
                { value: 'low',    label: 'Faible',   desc: 'Je préfère la sécurité et les biens clés en main', icon: '🛡️' },
                { value: 'medium', label: 'Modérée',  desc: "J'accepte quelques travaux si le prix est bon", icon: '⚖️' },
                { value: 'high',   label: 'Élevée',   desc: "Je cherche à maximiser la valeur ajoutée par la rénovation", icon: '🔨' },
              ]} />
          </>
        );

      // ── Step 4 — Préférences ─────────────────────────────────────────────
      case 3:
        return (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Vos préférences</h2>
            <p className="text-slate-500 text-sm mb-8">Décrivez le bien idéal et vos contraintes de mobilité.</p>

            <SliderInput label="Budget total maximum" value={profile.budget} min={80000} max={900000} step={5000}
              onChange={v => set('budget', v)} format={v => `${fmt(v)} €`}
              hint={`Apport inclus · Prix moyen IDF : ~5 500 €/m²`} />

            <RadioGroup label="Type de bien recherché" value={profile.propertyType} onChange={v => set('propertyType', v)}
              options={[
                { value: 'apartment', label: 'Appartement', icon: '🏢' },
                { value: 'house',     label: 'Maison',      icon: '🏠' },
                { value: 'any',       label: 'Indifférent', icon: '🔍' },
              ]} columns={2} />

            <SliderInput label="Surface souhaitée" value={profile.desiredSurface} min={20} max={200}
              onChange={v => set('desiredSurface', v)} format={v => `${v} m²`}
              hint={
                profile.desiredSurface > 0 && profile.budget > 0
                  ? `Budget/m² visé : ${fmt(Math.round(profile.budget / profile.desiredSurface))} €/m² · ${profile.currentSurface > 0 ? `Gain vs actuel : +${profile.desiredSurface - profile.currentSurface} m²` : ''}`
                  : undefined
              } />

            {profile.housingStatus === 'tenant' && (
              <InfoBox color="blue">
                Votre loyer actuel : <strong>{fmt(profile.currentRent + profile.currentCharges)} €/mois</strong> charges comprises pour <strong>{profile.currentSurface} m²</strong> — nous utiliserons ce montant réel pour comparer avec vos futures mensualités.
              </InfoBox>
            )}

            <SliderInput label="Temps de trajet max accepté vers Paris" value={profile.maxCommute} min={5} max={90} step={5}
              onChange={v => set('maxCommute', v)} format={v => `${v} min`}
              hint={`Mode de transport retenu : ${
                { metro: 'transports en commun', bike: 'vélo', car: 'voiture', mixed: 'mixte' }[profile.workTransport]
              } — influe sur le classement des villes`} />
          </>
        );

      // ── Step 5 — Financement & PTZ ───────────────────────────────────────
      case 4:
        return (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Financement & PTZ</h2>
            <p className="text-slate-500 text-sm mb-8">Paramétrez votre crédit et découvrez votre éligibilité au Prêt à Taux Zéro 2026.</p>

            <SliderInput label="Taux d'intérêt estimé (hors assurance)" value={profile.loanRate} min={2.0} max={7.0} step={0.05}
              onChange={v => set('loanRate', parseFloat(v.toFixed(2)))} format={v => `${v.toFixed(2)} %`}
              hint="Taux marché mai 2025 : ~3,3-3,8 % sur 25 ans · L'assurance emprunteur ajoute ~0,2-0,4 %/an" />

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
            <div className="grid grid-cols-2 gap-3 mb-4">
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
                {profile.housingStatus === 'tenant' && (
                  <p className={`text-xs mt-0.5 font-medium ${monthly > profile.currentRent + profile.currentCharges ? 'text-amber-600' : 'text-green-600'}`}>
                    {monthly > profile.currentRent + profile.currentCharges ? '▲' : '▼'} vs loyer actuel ({fmt(profile.currentRent + profile.currentCharges)} €)
                  </p>
                )}
              </div>
              <div className={`${effort > 0.35 ? 'bg-red-50' : 'bg-green-50'} rounded-xl p-4`}>
                <p className={`text-xs font-semibold uppercase mb-1 ${effort > 0.35 ? 'text-red-600' : 'text-green-600'}`}>Taux d'effort</p>
                <p className={`text-xl font-black ${effort > 0.35 ? 'text-red-800' : 'text-green-800'}`}>{(effort * 100).toFixed(1)} %</p>
                <p className="text-xs opacity-70 mt-0.5">Seuil HCSF : 35 %</p>
              </div>
            </div>

            {effort > 0.35 && (
              <InfoBox color="red">
                ⚠️ <strong>Taux d'effort {(effort * 100).toFixed(1)} % &gt; 35 %</strong> — les banques peuvent refuser le crédit. Réduisez le budget, augmentez l'apport ou allongez la durée.
              </InfoBox>
            )}

            {/* PTZ block */}
            {profile.housingStatus === 'tenant' && (
              <div className="mt-6">
                <SectionTitle>Prêt à Taux Zéro 2026 — votre situation</SectionTitle>
                {ptz.eligible ? (
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-bold text-green-800">Éligible au PTZ</p>
                        <p className="text-xs text-green-600">Tranche {ptz.tranche} — zone {profile.ptzZone.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center mb-3">
                      <div className="bg-white/70 rounded-lg p-2">
                        <p className="text-xs text-green-700 font-semibold">Montant PTZ</p>
                        <p className="font-black text-green-900 text-lg">{fmt(Math.round(ptz.montant ?? 0))} €</p>
                      </div>
                      <div className="bg-white/70 rounded-lg p-2">
                        <p className="text-xs text-green-700 font-semibold">Quotité</p>
                        <p className="font-black text-green-900 text-lg">{Math.round((ptz.quotite ?? 0) * 100)} %</p>
                      </div>
                      <div className="bg-white/70 rounded-lg p-2">
                        <p className="text-xs text-green-700 font-semibold">Différé</p>
                        <p className="font-black text-green-900 text-lg">{ptz.differe} ans</p>
                      </div>
                      <div className="bg-white/70 rounded-lg p-2">
                        <p className="text-xs text-green-700 font-semibold">Durée totale</p>
                        <p className="font-black text-green-900 text-lg">{ptz.duree} ans</p>
                      </div>
                    </div>
                    <p className="text-xs text-green-700">
                      Après le différé : <strong>{fmt(Math.round(ptz.mensualite ?? 0))} €/mois</strong> sur {ptz.dureeRemboursement} ans.
                      Revenu retenu : {fmt(Math.round(ptz.revenuRetenu ?? 0))} €.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">❌</span>
                      <div>
                        <p className="font-semibold text-slate-700">Non éligible au PTZ</p>
                        <p className="text-xs text-slate-500 mt-0.5">{ptz.reason}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Progress header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
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
              transition={{ duration: 0.2, ease: 'easeInOut' }}>
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10 pt-4 border-t border-slate-200">
            <button onClick={goBack} disabled={step === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition">
              ← Retour
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={goNext}
                disabled={step === 1 && profile.movingReasons.length === 0}
                className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-semibold transition">
                Continuer →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold transition">
                {loading ? 'Analyse en cours…' : 'Voir mes recommandations →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
