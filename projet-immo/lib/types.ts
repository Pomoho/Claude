export interface UserProfile {
  // Step 1 — Profil personnel
  age: number;
  familySituation: 'single' | 'couple' | 'family';
  profession: 'cdi_private' | 'cdi_public' | 'fonctionnaire' | 'cdd' | 'freelance' | 'other';
  monthlyIncome: number;
  downPayment: number;

  // Step 2 — Logement actuel
  housingStatus: 'tenant' | 'owner_occupant';

  // Tenant details
  currentSurface: number;
  currentRent: number;        // loyer mensuel hors charges
  currentCharges: number;     // charges mensuelles

  // Owner details
  ownerCopropriete: number;   // charges annuelles
  ownerTaxeFonciere: number;  // taxe foncière annuelle

  // Common housing
  currentLocation: string;
  movingReasons: string[];
  workDistance: number;       // km
  workTransport: 'bike' | 'metro' | 'car' | 'mixed';

  // Fiscal (PTZ eligibility — only for non-owners)
  rfr: number;                // revenu fiscal de référence N-2
  ptzZone: 'A_bis' | 'A' | 'B1' | 'B2' | 'C';

  // Step 3 — Projet
  projectType: 'primary' | 'investment';
  holdingPeriod: number;      // years
  riskTolerance: 'low' | 'medium' | 'high';

  // Step 4 — Préférences
  budget: number;
  propertyType: 'apartment' | 'house' | 'any';
  desiredSurface: number;
  maxCommute: number;         // minutes by preferred transport

  // Step 5 — Financement
  loanRate: number;
  loanDuration: number;       // years
}

export interface City {
  id: string;
  name: string;
  department: number;
  zone: string;
  pricePerSqm: number;
  priceEvolutionYoY: number;
  rentalYield: number;
  transportScore: number;
  qualityOfLife: number;
  tensionIndex: number;
  transitTimeToCenter: number;
  hasMetro: boolean;
  hasRER: boolean;
  hasTram: boolean;
  postalCode: string;
}

export interface ScoredCity extends City {
  totalScore: number;
  budgetScore: number;
  investScore: number;
  transportAdj: number;
  qolAdj: number;
  estimatedMonthlyPayment: number;
  affordableSurface: number;
  pros: string[];
  cons: string[];
}

export interface BuyRentResult {
  score: number;
  recommendation: 'buy_strongly' | 'buy' | 'neutral' | 'rent' | 'rent_strongly';
  label: string;
  factors: Array<{ label: string; impact: number; description: string }>;
  estimatedMonthlyPayment: number;
  estimatedMonthlyRent: number;
  rentIsActual: boolean;
}

export interface NewOldResult {
  score: number;
  recommendation: 'new_strongly' | 'new' | 'neutral' | 'old' | 'old_strongly';
  label: string;
  factors: Array<{ label: string; impact: number; description: string }>;
}

export interface PTZResult {
  eligible: boolean;
  reason?: string;
  tranche?: number;
  quotite?: number;
  differe?: number;
  duree?: number;
  dureeRemboursement?: number;
  montant?: number;
  mensualite?: number;
  revenuRetenu?: number;
}

export interface FinancialPoint {
  year: number;
  buyCumCost: number;
  rentCumCost: number;
  propertyValue: number;
  netWealthBuy: number;
}
