import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, PanelLeftOpen, PanelLeftClose, Save, Eye, Download, PieChart, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface NavItemProps {
  title: string;
  count: number;
  isActive: boolean;
  isComplete: boolean;
  isInvalid?: boolean;
  onClick: () => void;
}

const NavItem = ({ title, count, isActive, isComplete, isInvalid, onClick }: NavItemProps) => (
  <div
    className={cn(
      "flex items-center justify-between py-2 px-3 rounded-md cursor-pointer mb-1",
      isActive 
        ? "bg-primary text-primary-foreground" 
        : "hover:bg-white/20 dark:hover:bg-white/5"
    )}
    onClick={onClick}
  >
    <div className="flex items-center">
      {isInvalid ? (
        <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
      ) : isComplete ? (
        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
      ) : (
        <AlertCircle className="h-4 w-4 mr-2 text-gray-400" />
      )}
      <span>{title}</span>
    </div>
    <Badge variant={isComplete ? "outline" : "secondary"} className={cn(
      isActive && "bg-white/20 text-primary-foreground border-white/30"
    )}>
      {count}
    </Badge>
  </div>
);

interface DashboardLayoutProps {
  children: React.ReactNode;
  sections: {
    id: string;
    title: string;
    count: number;
    isComplete: boolean;
  }[];
  activeSection: string;
  onSectionChange: (section: string) => void;
  completionPercentage: number;
  onSave: () => void;
  onPreviewToggle: () => void;
  onDownload: () => void;
  isSaving?: boolean;
  saveButtonText?: string;
  invalidSections?: string[];
}

export function DashboardLayout({
  children,
  sections,
  activeSection,
  onSectionChange,
  completionPercentage,
  onSave,
  onPreviewToggle,
  onDownload,
  isSaving = false,
  saveButtonText = "Save Changes",
  invalidSections = []
}: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-full overflow-hidden bg-gray-50/20 dark:bg-gray-900/10">
      {/* Sidebar */}
      <div className={cn(
        "border-r border-white/20 dark:border-white/5 transition-all duration-300 flex flex-col bg-white/50 dark:bg-gray-800/30",
        sidebarCollapsed ? "w-16" : "w-64"
      )}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/20 dark:border-white/5 flex items-center justify-between bg-white/60 dark:bg-gray-800/40">
          {!sidebarCollapsed && <h3 className="font-semibold">Sections</h3>}
          <Button variant="ghost" size="sm" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="hover:bg-white/30 dark:hover:bg-white/5">
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </Button>
        </div>

        {/* Nav Items */}
        <ScrollArea className="flex-1 bg-white/30 dark:bg-gray-800/20">
          <div className="p-2">
            {!sidebarCollapsed ? (
              sections.map((section) => (
                <NavItem
                  key={section.id}
                  title={section.title}
                  count={section.count}
                  isActive={activeSection === section.id}
                  isComplete={section.isComplete}
                  isInvalid={invalidSections.includes(section.id)}
                  onClick={() => onSectionChange(section.id)}
                />
              ))
            ) : (
              sections.map((section) => (
                <div
                  key={section.id}
                  className={cn(
                    "flex justify-center items-center h-10 mb-1 rounded cursor-pointer",
                    activeSection === section.id 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-white/20 dark:hover:bg-white/5"
                  )}
                  onClick={() => onSectionChange(section.id)}
                >
                  {invalidSections.includes(section.id) ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : section.isComplete ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Progress - Moved to end */}
        <div className="p-4 border-t border-white/20 dark:border-white/5 bg-white/50 dark:bg-gray-800/30">
          {!sidebarCollapsed ? (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Completion</span>
                <span className="text-sm font-medium">{completionPercentage}%</span>
              </div>
              <Progress 
                value={completionPercentage} 
                className="h-2 bg-white/30 dark:bg-gray-800/30" 
                indicatorClassName="bg-gradient-to-r from-amber-400 via-emerald-500 to-blue-500" 
              />
            </>
          ) : (
            <div className="flex justify-center">
              <PieChart size={24} className={completionPercentage === 100 ? "text-green-500" : "text-gray-400"} />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-white/20 dark:border-white/5 bg-white/50 dark:bg-gray-800/30">
          {!sidebarCollapsed ? (
            <div className="space-y-2">
              <Button className="w-full" onClick={onSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {saveButtonText === "Save Changes" ? "Saving..." : "Activating..."}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {saveButtonText}
                  </>
                )}
              </Button>
              <Button variant="outline" className="w-full" onClick={onPreviewToggle} disabled={isSaving}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button variant="secondary" className="w-full" onClick={onDownload} disabled={isSaving}>
                <Download className="mr-2 h-4 w-4" />
                Download MD
              </Button>
            </div>
          ) : (
            <div className="space-y-2 flex flex-col items-center">
              <Button size="icon" onClick={onSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" onClick={onPreviewToggle} disabled={isSaving}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" onClick={onDownload} disabled={isSaving}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Now uses full width */}
      <div className="flex-1 overflow-hidden bg-white/40 dark:bg-gray-800/20">
        {/* Content Area */}
        <div className="overflow-auto h-full p-6">
          {children}
        </div>
      </div>
    </div>
  );
} 