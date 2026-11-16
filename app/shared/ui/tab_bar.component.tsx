export interface TabOption<TabKey extends string> {
  key: TabKey;
  label: string;
  badge?: string | number;
}

interface TabBarProps<TabKey extends string> {
  tabs: readonly TabOption<TabKey>[];
  selected_key: TabKey;
  onSelect: (tab_key: TabKey) => void;
}

export function TabBar<TabKey extends string>({ tabs, selected_key, onSelect }: TabBarProps<TabKey>) {
  return (
    <div role="tablist" className="mb-6 flex gap-1 border-b border-line">
      {tabs.map((tab) => {
        const is_selected = tab.key === selected_key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={is_selected}
            className={`-mb-px flex items-center gap-2 border-b-[3px] px-5 py-3 text-lg font-semibold transition-colors ${is_selected ? "border-accent text-accent" : "border-transparent text-ink-soft hover:text-ink"}`}
            onClick={() => onSelect(tab.key)}
          >
            {tab.label}
            {tab.badge !== undefined ? <span className="rounded-full bg-surface px-2 text-sm text-ink-soft">{tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
