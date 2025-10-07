import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { KPIConfig } from '@/lib/kpiCalculations';
import { toast } from 'sonner';

interface SaveKPIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: KPIConfig;
}

const iconEmojis = ['📊', '⚠️', '🚨', '👤', '🚗', '📈', '🎯', '🔍', '⏰', '📍'];

export function SaveKPIDialog({ open, onOpenChange, config }: SaveKPIDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📊');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a KPI name');
      return;
    }

    setIsSaving(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    // Save to localStorage
    const savedKPIs = JSON.parse(localStorage.getItem('savedKPIs') || '[]');
    const newKPI = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description.trim(),
      icon: selectedIcon,
      config,
      createdAt: new Date().toISOString(),
    };

    savedKPIs.push(newKPI);
    localStorage.setItem('savedKPIs', JSON.stringify(savedKPIs));

    setIsSaving(false);
    toast.success('KPI saved successfully!');
    
    // Reset form
    setName('');
    setDescription('');
    setSelectedIcon('📊');
    onOpenChange(false);

    // Dispatch event for other components to refresh
    window.dispatchEvent(new Event('kpiSaved'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Save KPI Configuration</DialogTitle>
          <DialogDescription>
            Save this KPI for quick access later
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">KPI Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Vest Violations - Last 7 Days"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex gap-2 flex-wrap">
              {iconEmojis.map(icon => (
                <button
                  key={icon}
                  onClick={() => setSelectedIcon(icon)}
                  className={`text-2xl p-2 rounded-md border-2 transition-colors ${
                    selectedIcon === icon
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? 'Saving...' : 'Save KPI'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
