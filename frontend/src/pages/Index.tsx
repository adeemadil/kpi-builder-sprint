import { useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { KPIBuilder } from '@/components/KPIBuilder';
import { SavedKPIsSidebar } from '@/components/SavedKPIsSidebar';
import { KPIConfig } from '@/lib/kpiCalculations';

type View = 'dashboard' | 'builder';

const Index = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedKPIConfig, setSelectedKPIConfig] = useState<KPIConfig | undefined>();

  const handleCreateKPI = () => {
    setSelectedKPIConfig(undefined);
    setCurrentView('builder');
  };

  const handleLoadKPI = (config: KPIConfig) => {
    console.log('[Index] ===== LOAD KPI REQUEST =====');
    console.log('[Index] Config received:', {
      metric: config.metric,
      groupBy: config.groupBy,
      timeBucket: config.timeBucket,
      timestamp: new Date().toISOString()
    });
    setSelectedKPIConfig(config);
    setCurrentView('builder');
  };

  const handleBackToDashboard = () => {
    setSelectedKPIConfig(undefined);
    setCurrentView('dashboard');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">S</span>
              </div>
              <h1 className="text-xl font-semibold">Safety Analytics</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Industrial KPI Builder</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {currentView === 'dashboard' ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
            <Dashboard onCreateKPI={handleCreateKPI} />
            <SavedKPIsSidebar onLoadKPI={handleLoadKPI} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
            <KPIBuilder onBack={handleBackToDashboard} initialConfig={selectedKPIConfig} />
            <SavedKPIsSidebar onLoadKPI={handleLoadKPI} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container mx-auto px-6 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Dynamic Chart Builder for Industrial Safety Analytics
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
