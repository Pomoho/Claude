import { UserProfile, City, BuyRentResult, NewOldResult, ScoredCity, FinancialPoint, PTZResult } from '../types';
import { IDF_CITIES } from '../data/idf-cities';

// ─── Monthly mortgage payment ─────────────────────────────────────────────────
export function monthlyPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return principal * r / (1 - Math.pow(1 + r, -n));
}

// ─── Max loan capacity (35 % HCSF rule) ──────────────────────────────────────
export function loanCapacity(monthlyIncome: number, annualRate: number, years: number): number {
  const maxMonthly = monthlyIncome * 0.35;
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return maxMonthly * n;
  return maxMonthly * (1 - Math.pow(1 + r, -n)) / r;
}

// ─── PTZ 2026 — décret n°2025-299 du 29 mars 2025 ────────────────────────────
const PTZ_ZONES: Record<string, { t1: number; t2: number; t3: number; maxRevenu: number; maxOp: number }> = {
  A_bis: { t1: 25000, t2: 31000, t3: 37000, maxRevenu: 49000, maxOp: 150000 },
  A:     { t1: 25000, t2: 31000, t3: 37000, maxRevenu: 49000, maxOp: 150000 },
  B1:    { t1: 21500, t2: 26000, t3: 30000, maxRevenu: 34500, maxOp: 135000 },
  B2:    { t1: 18000, t2: 22500, t3: 27000, maxRevenu: 31500, maxOp: 110000 },
  C:     { t1: 15000, t2: 19500, t3: 24000, maxRevenu: 28500, maxOp: 100000 },
};

const PTZ_TRANCHES = [
  { quotite: 0.50, differe: 10, duree: 25 }, // Tranche 1 — plus modeste
  { quotite: 0.40, differe: 8,  duree: 20 }, // Tranche 2
  { quotite: 0.40, differe: 2,  duree: 15 }, // Tranche 3
  { quotite: 0.20, differe: 0,  duree: 10 }, // Tranche 4 — revenus les plus élevés
];

export function calcPTZ(profile: UserProfile, coutTotal: number): PTZResult {
  // PTZ only for primo-accédants (non-propriétaires depuis 2 ans)
  if (profile.housingStatus === 'owner_occupant') {
    return { eligible: false, reason: 'Propriétaires occupants exclus du PTZ (réservé aux primo-accédants)' };
  }

  const zd = PTZ_ZONES[profile.ptzZone];
  if (!zd) return { eligible: false, reason: 'Zone PTZ inconnue' };

  const revenuRetenu = Math.max(profile.rfr, coutTotal / 9);

  if (revenuRetenu > zd.maxRevenu) {
    return {
      eligible: false,
      reason: `Revenus retenus (${Math.round(revenuRetenu).toLocaleString('fr-FR')} €) supérieurs au plafond zone ${profile.ptzZone.replace('_', ' ')} (${zd.maxRevenu.toLocaleString('fr-FR')} €)`,
      revenuRetenu,
    };
  }

  let trancheIdx: number;
  if (revenuRetenu <= zd.t1)      trancheIdx = 0;
  else if (revenuRetenu <= zd.t2) trancheIdx = 1;
  else if (revenuRetenu <= zd.t3) trancheIdx = 2;
  else                            trancheIdx = 3;

  const tr = PTZ_TRANCHES[trancheIdx];
  const base = Math.min(coutTotal, zd.maxOp);
  const montant = base * tr.quotite;
  const dureeRemboursement = tr.duree - tr.differe;
  const mensualite = dureeRemboursement > 0 ? montant / (dureeRemboursement * 12) : 0;

  return {
    eligible: true,
    tranche: trancheIdx + 1,
    quotite: tr.quotite,
    differe: tr.differe,
    duree: tr.duree,
    dureeRemboursement,
    montant,
    mensualite,
    revenuRetenu,
  };
}

// ─── Buy vs Rent scoring ──────────────────────────────────────────────────────
export function scoreBuyVsRent(profile: UserProfile): BuyRentResult {
  const factors: BuyRentResult['factors'] = [];
  let score = 50;

  // 1. Horizon de détention
  const { holdingPeriod } = profile;
  let horizonImpact: number;
  let horizonDesc: string;
  if (holdingPeriod >= 10)     { horizonImpact = 20; horizonDesc = `${holdingPeriod} ans : largement favorable à l'achat`; }
  else if (holdingPeriod >= 7) { horizonImpact = 12; horizonDesc = `${holdingPeriod} ans : favorable à l'achat`; }
  else if (holdingPeriod >= 5) { horizonImpact = 5;  horizonDesc = `${holdingPeriod} ans : légèrement favorable à l'achat`; }
  else if (holdingPeriod >= 3) { horizonImpact = -5; horizonDesc = `${holdingPeriod} ans : trop court pour rentabiliser l'achat`; }
  else                         { horizonImpact = -20; horizonDesc = `${holdingPeriod} ans : trop court, la location est préférable`; }
  score += horizonImpact;
  factors.push({ label: 'Horizon de détention', impact: horizonImpact, description: horizonDesc });

  // 2. Stabilité professionnelle
  const profMap: Record<string, [number, string]> = {
    fonctionnaire: [15, 'Fonctionnaire : stabilité maximale'],
    cdi_public:    [12, 'CDI public : très stable'],
    cdi_private:   [10, 'CDI privé : bonne stabilité'],
    cdd:           [-5, 'CDD : revenus incertains'],
    freelance:     [-5, 'Freelance : revenus variables'],
    other:         [-10, 'Situation atypique : accès au crédit plus difficile'],
  };
  const [stabImpact, stabDesc] = profMap[profile.profession] ?? [-10, 'Situation inconnue'];
  score += stabImpact;
  factors.push({ label: 'Stabilité professionnelle', impact: stabImpact, description: stabDesc });

  // 3. Taux d'intérêt
  const rate = profile.loanRate;
  let rateImpact: number;
  let rateDesc: string;
  if (rate < 2.5)      { rateImpact = 15; rateDesc = `${rate} % : taux très attractif`; }
  else if (rate < 3.5) { rateImpact = 8;  rateDesc = `${rate} % : taux correct`; }
  else if (rate < 4.5) { rateImpact = 0;  rateDesc = `${rate} % : taux neutre`; }
  else                 { rateImpact = -10; rateDesc = `${rate} % : taux élevé, pèse sur la rentabilité`; }
  score += rateImpact;
  factors.push({ label: 'Niveau des taux', impact: rateImpact, description: rateDesc });

  // 4. Apport personnel
  const apportRatio = profile.budget > 0 ? profile.downPayment / profile.budget : 0;
  let apportImpact: number;
  let apportDesc: string;
  if (apportRatio >= 0.25)      { apportImpact = 15; apportDesc = `Apport de ${Math.round(apportRatio * 100)} % : excellent`; }
  else if (apportRatio >= 0.15) { apportImpact = 10; apportDesc = `Apport de ${Math.round(apportRatio * 100)} % : bon`; }
  else if (apportRatio >= 0.1)  { apportImpact = 5;  apportDesc = `Apport de ${Math.round(apportRatio * 100)} % : minimum bancaire`; }
  else if (apportRatio >= 0.05) { apportImpact = -5; apportDesc = `Apport de ${Math.round(apportRatio * 100)} % : insuffisant pour beaucoup de banques`; }
  else                          { apportImpact = -15; apportDesc = `Apport inférieur à 5 % : accès au crédit compromis`; }
  score += apportImpact;
  factors.push({ label: 'Apport personnel', impact: apportImpact, description: apportDesc });

  // 5. Mensualité vs loyer réel (ou estimé si propriétaire)
  const principal = Math.max(0, profile.budget - profile.downPayment);
  const monthly = monthlyPayment(principal, profile.loanRate / 100, profile.loanDuration);

  // Use actual rent if tenant, else estimate from budget
  const rentIsActual = profile.housingStatus === 'tenant' && (profile.currentRent + profile.currentCharges) > 0;
  const referenceRent = rentIsActual
    ? profile.currentRent + profile.currentCharges
    : (profile.budget * 0.04) / 12;

  const ratio = referenceRent > 0 ? monthly / referenceRent : 1;
  let rentImpact: number;
  let rentDesc: string;
  const rentLabel = rentIsActual ? 'votre loyer actuel charges comprises' : 'loyer équivalent estimé';
  if (ratio < 0.9)      { rentImpact = 15; rentDesc = `Mensualité (${Math.round(monthly)} €) < ${rentLabel} (${Math.round(referenceRent)} €)`; }
  else if (ratio < 1.1) { rentImpact = 8;  rentDesc = `Mensualité (${Math.round(monthly)} €) ≈ ${rentLabel} (${Math.round(referenceRent)} €)`; }
  else if (ratio < 1.3) { rentImpact = 0;  rentDesc = `Mensualité (${Math.round(monthly)} €) légèrement > ${rentLabel} (${Math.round(referenceRent)} €)`; }
  else                  { rentImpact = -10; rentDesc = `Mensualité (${Math.round(monthly)} €) nettement > ${rentLabel} (${Math.round(referenceRent)} €)`; }
  score += rentImpact;
  factors.push({ label: 'Mensualité vs loyer', impact: rentImpact, description: rentDesc });

  // 6. Situation actuelle : locataire ou propriétaire
  let situationImpact: number;
  let situationDesc: string;
  if (profile.housingStatus === 'tenant') {
    const loyerAnnuel = (profile.currentRent + profile.currentCharges) * 12;
    const ptz = calcPTZ(profile, profile.budget);
    if (ptz.eligible) {
      situationImpact = 10;
      situationDesc = `Locataire éligible au PTZ (${Math.round(ptz.montant ?? 0).toLocaleString('fr-FR')} €) — boost significatif pour l'achat`;
    } else {
      situationImpact = 5;
      situationDesc = `Locataire primo-accédant — eligible à d'autres aides même sans PTZ. Loyer annuel : ${loyerAnnuel.toLocaleString('fr-FR')} €`;
    }
  } else {
    situationImpact = 0;
    situationDesc = 'Propriétaire occupant — n\'est pas éligible au PTZ. Revente à prévoir.';
  }
  score += situationImpact;
  factors.push({ label: 'Statut & aides', impact: situationImpact, description: situationDesc });

  score = Math.max(0, Math.min(100, score));

  let recommendation: BuyRentResult['recommendation'];
  let label: string;
  if (score >= 70)      { recommendation = 'buy_strongly'; label = 'Acheter est fortement recommandé'; }
  else if (score >= 58) { recommendation = 'buy';          label = 'Acheter est recommandé'; }
  else if (score >= 42) { recommendation = 'neutral';      label = 'Situation équilibrée — analysez avec un courtier'; }
  else if (score >= 30) { recommendation = 'rent';         label = 'Louer est légèrement préférable'; }
  else                  { recommendation = 'rent_strongly'; label = 'Louer est fortement recommandé'; }

  return { score, recommendation, label, factors, estimatedMonthlyPayment: Math.round(monthly), estimatedMonthlyRent: Math.round(referenceRent), rentIsActual };
}

// ─── New vs Old scoring ───────────────────────────────────────────────────────
export function scoreNewVsOld(profile: UserProfile): NewOldResult {
  const factors: NewOldResult['factors'] = [];
  let score = 50;

  const budgetPerSqm = profile.desiredSurface > 0 ? profile.budget / profile.desiredSurface : 0;
  let budgetImpact: number;
  let budgetDesc: string;
  if (budgetPerSqm >= 7000)      { budgetImpact = 15; budgetDesc = `${Math.round(budgetPerSqm)} €/m² : budget compatible avec le neuf`; }
  else if (budgetPerSqm >= 5000) { budgetImpact = 5;  budgetDesc = `${Math.round(budgetPerSqm)} €/m² : neuf accessible en petite couronne`; }
  else if (budgetPerSqm >= 3500) { budgetImpact = -5; budgetDesc = `${Math.round(budgetPerSqm)} €/m² : le neuf reste difficile — l'ancien offre plus de choix`; }
  else                           { budgetImpact = -15; budgetDesc = `${Math.round(budgetPerSqm)} €/m² : budget orienté vers l'ancien`; }
  score += budgetImpact;
  factors.push({ label: 'Compatibilité budget / neuf', impact: budgetImpact, description: budgetDesc });

  let objImpact: number;
  let objDesc: string;
  if (profile.projectType === 'investment') {
    objImpact = 15; objDesc = 'Investissement : avantages fiscaux du neuf (TVA réduite, amortissements)';
  } else if (profile.familySituation === 'family') {
    objImpact = -10; objDesc = "Famille : l'ancien offre de plus grandes surfaces à prix équivalent";
  } else {
    objImpact = 5; objDesc = 'Résidence principale : confort garanti du neuf (normes RE 2020)';
  }
  score += objImpact;
  factors.push({ label: 'Objectif du projet', impact: objImpact, description: objDesc });

  let travauxImpact: number;
  let travauxDesc: string;
  if (profile.riskTolerance === 'low')      { travauxImpact = 15; travauxDesc = "Faible tolérance au risque : le neuf élimine les surprises de travaux"; }
  else if (profile.riskTolerance === 'medium') { travauxImpact = 0; travauxDesc = 'Tolérance modérée : les deux options sont envisageables'; }
  else                                      { travauxImpact = -15; travauxDesc = "Bonne tolérance au risque : l'ancien à rénover peut créer de la valeur"; }
  score += travauxImpact;
  factors.push({ label: 'Tolérance aux travaux', impact: travauxImpact, description: travauxDesc });

  let surfaceImpact: number;
  let surfaceDesc: string;
  if (profile.desiredSurface <= 60)      { surfaceImpact = 10; surfaceDesc = `${profile.desiredSurface} m² : les petites surfaces neuves sont plus accessibles`; }
  else if (profile.desiredSurface <= 90) { surfaceImpact = 0;  surfaceDesc = `${profile.desiredSurface} m² : neutre`; }
  else                                   { surfaceImpact = -15; surfaceDesc = `${profile.desiredSurface} m² : grandes surfaces neuves rares et chères en IDF`; }
  score += surfaceImpact;
  factors.push({ label: 'Surface souhaitée', impact: surfaceImpact, description: surfaceDesc });

  // Moving reason: if quality/DPE is a reason, favour new
  const wantsQuality = profile.movingReasons?.includes('quality');
  const qImpact = wantsQuality ? 8 : 0;
  if (wantsQuality) {
    score += qImpact;
    factors.push({ label: 'Qualité / DPE', impact: qImpact, description: 'Qualité du logement citée comme motivation : le neuf garantit les meilleures normes' });
  } else {
    let horizonImpact: number;
    let horizonDesc: string;
    if (profile.holdingPeriod >= 15)     { horizonImpact = 10; horizonDesc = 'Long terme : économies énergétiques du neuf se rentabilisent'; }
    else if (profile.holdingPeriod >= 8) { horizonImpact = 5;  horizonDesc = 'Moyen terme : léger avantage du neuf sur les charges'; }
    else                                 { horizonImpact = -5; horizonDesc = 'Court terme : surcoût du neuf difficile à amortir'; }
    score += horizonImpact;
    factors.push({ label: 'Horizon & charges énergétiques', impact: horizonImpact, description: horizonDesc });
  }

  score = Math.max(0, Math.min(100, score));

  let recommendation: NewOldResult['recommendation'];
  let label: string;
  if (score >= 70)      { recommendation = 'new_strongly'; label = 'Acheter dans le neuf est fortement recommandé'; }
  else if (score >= 58) { recommendation = 'new';          label = 'Le neuf est recommandé pour votre profil'; }
  else if (score >= 42) { recommendation = 'neutral';      label = 'Neuf ou ancien — les deux correspondent à votre profil'; }
  else if (score >= 30) { recommendation = 'old';          label = "L'ancien est légèrement préférable"; }
  else                  { recommendation = 'old_strongly'; label = "L'ancien est fortement recommandé pour votre profil"; }

  return { score, recommendation, label, factors };
}

// ─── City scoring ─────────────────────────────────────────────────────────────
export function scoreCities(profile: UserProfile): ScoredCity[] {
  const loanAmt = Math.max(0, profile.budget - profile.downPayment);
  const monthly = monthlyPayment(loanAmt, profile.loanRate / 100, profile.loanDuration);

  // Transport preference modifier
  const prefersTransit = profile.workTransport === 'metro' || profile.workTransport === 'mixed';
  const prefersBike    = profile.workTransport === 'bike';

  return IDF_CITIES
    .filter((city, idx, arr) => arr.findIndex(c => c.id === city.id) === idx)
    .map(city => {
      const affordableSurface = city.pricePerSqm > 0 ? profile.budget / city.pricePerSqm : 0;
      const targetSurface = profile.desiredSurface;

      // 1. Budget compatibility (35%)
      const surfaceRatio = affordableSurface / targetSurface;
      let budgetScore: number;
      if (surfaceRatio >= 1.2)      budgetScore = 100;
      else if (surfaceRatio >= 1.0) budgetScore = 85;
      else if (surfaceRatio >= 0.8) budgetScore = 65;
      else if (surfaceRatio >= 0.6) budgetScore = 40;
      else                          budgetScore = 15;

      // 2. Investment potential (20%)
      const evol = city.priceEvolutionYoY;
      const yield_ = city.rentalYield;
      let investScore: number;
      if (profile.projectType === 'investment') {
        investScore = Math.min(100, Math.max(0, 50 + evol * 5 + (yield_ - 4) * 8));
      } else {
        investScore = Math.min(100, Math.max(0, 50 + evol * 4));
      }

      // 3. Transport (20%) — weighted by transport preference
      let commuteMinutes = city.transitTimeToCenter;
      // Bike: penalise anything far (rough proxy: 1 km ≈ 4 min by bike, but compare to transit time)
      if (prefersBike) commuteMinutes = Math.round(commuteMinutes * 1.5); // bike is slower than transit avg

      const commuteOk = commuteMinutes <= profile.maxCommute;
      let transportAdj = commuteOk
        ? city.transportScore * 10
        : Math.max(0, city.transportScore * 10 - (commuteMinutes - profile.maxCommute) * 2);

      // Bonus: prefer transit-friendly cities if user uses metro
      if (prefersTransit && (city.hasRER || city.hasMetro)) transportAdj = Math.min(100, transportAdj + 10);

      // 4. Quality of life (15%)
      const qolAdj = city.qualityOfLife * 10;

      // 5. Market tension (10%)
      const tensionAdj = (10 - city.tensionIndex) * 10;

      const totalScore = Math.round(
        budgetScore  * 0.35 +
        investScore  * 0.20 +
        transportAdj * 0.20 +
        qolAdj       * 0.15 +
        tensionAdj   * 0.10
      );

      // Pros & cons
      const pros: string[] = [];
      const cons: string[] = [];
      if (surfaceRatio >= 1.1) pros.push(`Budget suffisant (${Math.round(affordableSurface)} m² accessible)`);
      else cons.push(`Surface limitée au budget (${Math.round(affordableSurface)} m² max)`);
      if (evol > 0) pros.push(`Prix en hausse de +${evol} %/an`);
      else cons.push(`Prix en baisse de ${evol} %/an`);
      if (profile.projectType === 'investment' && yield_ >= 5) pros.push(`Bon rendement locatif (${yield_} %)`);
      if (city.transportScore >= 8) pros.push('Excellente desserte en transports');
      if (commuteMinutes > profile.maxCommute) cons.push(`Trajet estimé (${commuteMinutes} min) dépasse votre limite`);
      if (city.qualityOfLife >= 8) pros.push('Très bonne qualité de vie');
      if (city.tensionIndex >= 8) cons.push('Marché très tendu, peu de stock');
      if (city.hasRER && prefersTransit) pros.push('Accès RER direct — correspond à votre mode de transport');
      else if (city.hasRER) pros.push('Accès RER direct');
      if (prefersBike && commuteMinutes <= 20) pros.push('Distance compatible avec le vélo');

      return { ...city, totalScore, budgetScore, investScore, transportAdj, qolAdj, estimatedMonthlyPayment: Math.round(monthly), affordableSurface: Math.round(affordableSurface), pros, cons };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5);
}

// ─── Financial simulation (buy vs rent) ──────────────────────────────────────
export function simulateFinancial(profile: UserProfile, city: City | null): FinancialPoint[] {
  const pricePerSqm = city?.pricePerSqm ?? 5500;
  const propertyValue0 = profile.desiredSurface * pricePerSqm;
  const downPayment = profile.downPayment;
  const loan = Math.max(0, propertyValue0 - downPayment);
  const r = profile.loanRate / 100;
  const monthly = monthlyPayment(loan, r, profile.loanDuration);
  const notaireRate = 0.075;
  const upfrontCosts = downPayment + propertyValue0 * notaireRate;
  const annualCharges = pricePerSqm * profile.desiredSurface * 0.005;
  const appreciation = 0.015;

  // Use actual rent if tenant, else estimate
  const baseRentMonthly = (profile.housingStatus === 'tenant' && (profile.currentRent + profile.currentCharges) > 0)
    ? profile.currentRent + profile.currentCharges
    : (propertyValue0 * 0.04) / 12;
  const rentInflation = 0.02;

  const points: FinancialPoint[] = [];
  let cumBuyCost = upfrontCosts;
  let cumRentCost = 0;
  let rentMonthly = baseRentMonthly;

  for (let year = 0; year <= profile.holdingPeriod; year++) {
    if (year > 0) {
      cumBuyCost += monthly * 12 + annualCharges;
      cumRentCost += rentMonthly * 12;
      rentMonthly *= (1 + rentInflation);
    }
    const propertyValue = propertyValue0 * Math.pow(1 + appreciation, year);
    const rMonthly = r / 12;
    const n = profile.loanDuration * 12;
    const t = year * 12;
    let remainingLoan = 0;
    if (t < n) {
      remainingLoan = rMonthly > 0
        ? loan * Math.pow(1 + rMonthly, t) - monthly * (Math.pow(1 + rMonthly, t) - 1) / rMonthly
        : Math.max(0, loan - (loan / n) * t);
      remainingLoan = Math.max(0, remainingLoan);
    }
    const netWealthBuy = propertyValue - remainingLoan;
    points.push({ year, buyCumCost: Math.round(cumBuyCost), rentCumCost: Math.round(cumRentCost), propertyValue: Math.round(propertyValue), netWealthBuy: Math.round(netWealthBuy) });
  }
  return points;
}
