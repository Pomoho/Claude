import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-brand-900 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-sm">IG</div>
          <span className="font-semibold text-lg">ImmoGuide IDF</span>
        </div>
        <Link href="/login" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm font-medium">
          Se connecter
        </Link>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-medium mb-8">
          🏠 Île-de-France · Données 2025
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          Prenez la bonne décision<br />
          <span className="text-brand-400">immobilière</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          En 5 minutes, découvrez s'il vaut mieux acheter ou louer, neuf ou ancien, et quelles villes d'Île-de-France correspondent à votre profil.
        </p>
        <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-brand-500 hover:bg-brand-600 transition font-semibold text-lg shadow-lg shadow-brand-500/30">
          Commencer gratuitement →
        </Link>
        <p className="text-slate-500 text-sm mt-4">Aucune carte bancaire · 100 % gratuit</p>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: '🎯', title: 'Recommandation personnalisée', desc: 'Acheter ou louer ? Neuf ou ancien ? Notre moteur de scoring analyse votre profil en profondeur.' },
          { icon: '🗺️', title: 'Top 5 villes IDF', desc: '28 communes évaluées sur 5 critères : budget, transport, qualité de vie, potentiel investissement et tension du marché.' },
          { icon: '🔔', title: 'Alertes immobilières', desc: 'Générez en un clic des alertes filtrées sur SeLoger, Leboncoin et Bien\'ici selon vos critères.' },
        ].map(f => (
          <div key={f.title} className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
