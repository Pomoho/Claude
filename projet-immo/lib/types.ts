export interface UserProfile {
  // Step 1 — Personal
  age: number;
  familySituation: 'single' | 'couple' | 'family';
  profession: 'cdi_private' | 'cdi_public' | 'fonctionnaire' | 'cdd' | 'freelance' | 'other';
  monthlyIncome: number;
  downPayment: number;

  // Step 2 — Project
  projectType: 'primary' | 'investment';
  holdingPeriod: number; // years
  riskTolerance: 'low' | 'medium' | 'high';

  // Step 3 — Preferences
  budget: number;
  propertyType: 'apartment' | 'house' | 'any';
  desiredSurface: number;
  currentCity: string;
  maxCommute: number; // minutes

  // Step 4 — Financing
  loanRate: number;
  loanDuration: number; // years
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
  score: number; // 0-100, >50 = buy
  recommendation: 'buy_strongly' | 'buy' | 'neutral' | 'rent' | 'rent_strongly';
  label: string;
  factors: Array<{ label: string; impact: number; description: string }>;
  estimatedMonthlyPayment: number;
  estimatedMonthlyRent: number;
}

export interface NewOldResult {
  score: number; // 0-100, >50 = new
  recommendation: 'new_strongly' | 'new' | 'neutral' | 'old' | 'old_strongly';
  label: string;
  factors: Array<{ label: string; impact: number; description: string }>;
}

export interface FinancialPoint {
  year: number;
  buyCumCost: number;
  rentCumCost: number;
  propertyValue: number;
  netWealthBuy: number;
}
