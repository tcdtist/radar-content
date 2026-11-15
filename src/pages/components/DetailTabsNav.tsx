import React from 'react';
import { BaseButton } from './BaseButton';
import { TabKey } from './DetailTabsContent';

export interface TabItem {
  id: TabKey;
  label: string;
}

interface DetailTabsNavProps {
  tabs: TabItem[];
  activeTab: TabKey;
  onSelectTab: (id: TabKey) => void;
}

export const DetailTabsNav: React.FC<DetailTabsNavProps> = ({
  tabs,
  activeTab,
  onSelectTab,
}) => {
  return (
    <div className="drawer-tabs-nav" role="tablist" aria-label="Signal details tabs">
      {tabs.map((tab) => (
        <BaseButton
          key={tab.id}
          variant={activeTab === tab.id ? 'coral' : 'ghost'}
          size="sm"
          onClick={() => onSelectTab(tab.id)}
          aria-selected={activeTab === tab.id}
          role="tab"
        >
          {tab.label}
        </BaseButton>
      ))}
    </div>
  );
};
