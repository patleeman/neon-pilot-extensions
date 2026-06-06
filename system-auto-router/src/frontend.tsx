import type { ComposerControlContext, NativeExtensionClient } from '@neon-pilot/extensions';
import { cx, MenuGroupLabel, MenuItem, MenuSeparator, PositionedMenu, SectionLabel } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

const INLINE_TRIGGER_CLASS =
  'h-8 min-w-0 truncate rounded-md border border-transparent bg-transparent px-1.5 text-[11px] font-medium text-secondary outline-none transition-colors hover:bg-surface/45 hover:text-primary focus-visible:border-border-subtle focus-visible:bg-surface/55 focus-visible:text-primary focus-visible:ring-1 focus-visible:ring-accent/20 disabled:cursor-default disabled:opacity-40';
const MENU_TRIGGER_CLASS =
  'h-9 w-full min-w-0 rounded-lg border border-border-subtle bg-surface/45 px-2.5 text-[12px] font-medium text-primary outline-none transition-colors hover:bg-surface/65 focus-visible:border-accent/50 focus-visible:bg-surface/65 disabled:cursor-default disabled:opacity-40';

type SwitchoverMode = 'compact-and-switch' | 'raw-transcript-switch' | 'direct-swap' | 'fresh-with-instructions' | 'ask-each-time';
type ToolContextMode = 'omit' | 'deterministic-summary' | 'head-tail' | 'errors-only' | 'full-until-budget';

interface AutoRouterSettings {
  enabledByDefault: boolean;
  policyText: string;
  judgeModel: string;
  judgeTemperature: number;
  judgeMaxTokens: number;
  routingWindowTurns: number;
  maxSwitches: number;
  switchoverMode: SwitchoverMode;
  toolContextMode: ToolContextMode;
  toolHeadChars: number;
  toolTailChars: number;
  requireApprovalForPromotion: boolean;
  frontendDesignModel: string;
  promotedModel: string;
}

const DEFAULT_SETTINGS: AutoRouterSettings = {
  enabledByDefault: false,
  policyText:
    'Default to the selected coding model. Promote when the task appears stuck or validation fails repeatedly. Prefer the configured frontend/design model for UI design, layout, accessibility, and copy work.',
  judgeModel: '',
  judgeTemperature: 0,
  judgeMaxTokens: 600,
  routingWindowTurns: 6,
  maxSwitches: 1,
  switchoverMode: 'direct-swap',
  toolContextMode: 'head-tail',
  toolHeadChars: 1200,
  toolTailChars: 2400,
  requireApprovalForPromotion: true,
  frontendDesignModel: '',
  promotedModel: '',
};

function closeOtherComposerMenus(current: HTMLDetailsElement) {
  const root = current.parentElement?.parentElement ?? document;
  for (const details of Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-auto-router-menu]'))) {
    if (details !== current) details.removeAttribute('open');
  }
}

function normalizeSettings(input: unknown): AutoRouterSettings {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    enabledByDefault: readBoolean(record['autoRouter.enabledByDefault'], DEFAULT_SETTINGS.enabledByDefault),
    policyText: readString(record['autoRouter.policyText'], DEFAULT_SETTINGS.policyText),
    judgeModel: readString(record['autoRouter.judgeModel'], DEFAULT_SETTINGS.judgeModel),
    judgeTemperature: readNumber(record['autoRouter.judgeTemperature'], DEFAULT_SETTINGS.judgeTemperature),
    judgeMaxTokens: readNumber(record['autoRouter.judgeMaxTokens'], DEFAULT_SETTINGS.judgeMaxTokens),
    routingWindowTurns: readNumber(record['autoRouter.routingWindowTurns'], DEFAULT_SETTINGS.routingWindowTurns),
    maxSwitches: readNumber(record['autoRouter.maxSwitches'], DEFAULT_SETTINGS.maxSwitches),
    switchoverMode: readSwitchoverMode(record['autoRouter.switchoverMode']),
    toolContextMode: readToolContextMode(record['autoRouter.toolContextMode']),
    toolHeadChars: readNumber(record['autoRouter.toolHeadChars'], DEFAULT_SETTINGS.toolHeadChars),
    toolTailChars: readNumber(record['autoRouter.toolTailChars'], DEFAULT_SETTINGS.toolTailChars),
    requireApprovalForPromotion: readBoolean(
      record['autoRouter.requireApprovalForPromotion'],
      DEFAULT_SETTINGS.requireApprovalForPromotion,
    ),
    frontendDesignModel: readString(record['autoRouter.frontendDesignModel'], DEFAULT_SETTINGS.frontendDesignModel),
    promotedModel: readString(record['autoRouter.promotedModel'], DEFAULT_SETTINGS.promotedModel),
  };
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readSwitchoverMode(value: unknown): SwitchoverMode {
  const options = new Set<SwitchoverMode>([
    'compact-and-switch',
    'raw-transcript-switch',
    'direct-swap',
    'fresh-with-instructions',
    'ask-each-time',
  ]);
  return typeof value === 'string' && options.has(value as SwitchoverMode) ? (value as SwitchoverMode) : DEFAULT_SETTINGS.switchoverMode;
}

function readToolContextMode(value: unknown): ToolContextMode {
  const options = new Set<ToolContextMode>(['omit', 'deterministic-summary', 'head-tail', 'errors-only', 'full-until-budget']);
  return typeof value === 'string' && options.has(value as ToolContextMode) ? (value as ToolContextMode) : DEFAULT_SETTINGS.toolContextMode;
}

function formatMode(mode: SwitchoverMode): string {
  if (mode === 'compact-and-switch') return 'Compact then switch';
  if (mode === 'raw-transcript-switch') return 'Pass transcript';
  if (mode === 'fresh-with-instructions') return 'Fresh handoff';
  if (mode === 'ask-each-time') return 'Ask each time';
  return 'Direct swap';
}

function formatToolMode(mode: ToolContextMode): string {
  if (mode === 'deterministic-summary') return 'Deterministic summary';
  if (mode === 'head-tail') return 'Head/tail';
  if (mode === 'errors-only') return 'Errors only';
  if (mode === 'full-until-budget') return 'Full until budget';
  return 'Omit';
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none shrink-0 text-dim/70"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MenuButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <MenuItem
      className={cx('gap-2 px-2 py-1.5 text-[11px] text-secondary disabled:cursor-default disabled:opacity-40')}
      closeOnPointerDown={false}
      disabled={disabled}
      onClick={(event) => {
        event.currentTarget.closest('details')?.removeAttribute('open');
        onClick();
      }}
    >
      {children}
    </MenuItem>
  );
}

function MenuCheckbox({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <MenuItem
      role="menuitemcheckbox"
      aria-checked={checked}
      className={cx('justify-between gap-3 px-2 py-1.5 text-[11px] text-primary', disabled ? 'cursor-default opacity-50' : '')}
      closeOnPointerDown={false}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="w-3 shrink-0 text-right text-[12px] leading-none text-accent" aria-hidden="true">
        {checked ? '✓' : ''}
      </span>
    </MenuItem>
  );
}

function AutoRouterControl({
  pa,
  context,
}: {
  pa: NativeExtensionClient;
  context: ComposerControlContext;
}) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.enabledByDefault);
  const [loadedStorage, setLoadedStorage] = useState(false);
  const storageKey = 'auto-router/enabled';

  const refreshSettings = useCallback(async () => {
    const result = (await pa.extension.invoke('autoRouterSettings', {})) as { settings?: Record<string, unknown> };
    const nextSettings = normalizeSettings(result.settings);
    setSettings(nextSettings);
    if (!loadedStorage) setEnabled(nextSettings.enabledByDefault);
  }, [loadedStorage, pa]);

  useEffect(() => {
    let active = true;
    pa.storage
      .get<boolean>(storageKey)
      .then((stored) => {
        if (!active) return;
        if (typeof stored === 'boolean') setEnabled(stored);
        setLoadedStorage(true);
      })
      .catch(() => {
        if (active) setLoadedStorage(true);
      });
    return () => {
      active = false;
    };
  }, [pa.storage]);

  useEffect(() => {
    void refreshSettings().catch((error) => {
      pa.ui.notify({
        type: 'error',
        source: 'system-auto-router',
        message: 'Auto router settings failed to load',
        details: error instanceof Error ? error.message : String(error),
      });
    });
  }, [pa.ui, refreshSettings]);

  const updateEnabled = (nextEnabled: boolean) => {
    setEnabled(nextEnabled);
    void pa.storage.put(storageKey, nextEnabled).catch((error) => {
      pa.ui.notify({
        type: 'error',
        source: 'system-auto-router',
        message: 'Auto router preference failed to save',
        details: error instanceof Error ? error.message : String(error),
      });
    });
  };

  const statusLabel = enabled ? 'Auto: Routing' : 'Auto';
  const triggerClass =
    context.renderMode === 'menu' ? MENU_TRIGGER_CLASS : cx(INLINE_TRIGGER_CLASS, 'max-w-[7.5rem] min-w-[5.25rem]');
  const targetHints = [settings.promotedModel && `Promote: ${settings.promotedModel}`, settings.frontendDesignModel && `Design: ${settings.frontendDesignModel}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <details
      data-auto-router-menu
      className={context.renderMode === 'menu' ? 'relative min-w-0' : 'relative inline-flex min-w-0 items-center'}
      onToggle={(event) => {
        if (event.currentTarget.open) closeOtherComposerMenus(event.currentTarget);
      }}
    >
      <summary
        className={cx(
          'flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden',
          triggerClass,
          enabled && 'text-accent',
        )}
        aria-label="Auto router"
        title={enabled ? 'Auto router is enabled for this conversation.' : 'Auto router is disabled for this conversation.'}
      >
        <span className="min-w-0 truncate">{statusLabel}</span>
        <Chevron />
      </summary>
      <PositionedMenu
        placement="absolute"
        position={{ right: 0, bottom: '100%' }}
        className={cx('mb-2 bg-base p-1.5', context.renderMode === 'menu' ? 'w-full min-w-56' : 'w-72')}
      >
        <MenuCheckbox
          checked={enabled}
          disabled={context.streamIsStreaming}
          label={enabled ? 'Enabled for this conversation' : 'Disabled for this conversation'}
          onChange={updateEnabled}
        />
        <MenuSeparator />
        <div className="px-2 py-1.5 text-[11px] leading-relaxed text-secondary">
          <div className="flex justify-between gap-3">
            <span className="text-dim">Window</span>
            <span className="min-w-0 truncate text-primary">{settings.routingWindowTurns} turns</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-dim">Judge</span>
            <span className="min-w-0 truncate text-primary">{settings.judgeModel || 'App default'}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-dim">Switch</span>
            <span className="min-w-0 truncate text-primary">{formatMode(settings.switchoverMode)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-dim">Tools</span>
            <span className="min-w-0 truncate text-primary">{formatToolMode(settings.toolContextMode)}</span>
          </div>
          {targetHints ? <p className="mt-1 truncate text-primary">{targetHints}</p> : null}
          <p className="mt-2 line-clamp-3 break-words text-dim">{settings.policyText}</p>
        </div>
        <MenuSeparator />
        <MenuButton onClick={() => void refreshSettings()}>Refresh settings</MenuButton>
        <MenuButton onClick={() => void pa.commands.execute('app.navigate', { to: '/settings#settings-extension-settings' })}>
          Open auto router settings
        </MenuButton>
      </PositionedMenu>
    </details>
  );
}

export function AutoRouterComposerControl({
  pa,
  controlContext,
  buttonContext,
}: {
  pa: NativeExtensionClient;
  controlContext?: ComposerControlContext;
  buttonContext: ComposerControlContext;
}) {
  const context = controlContext ?? buttonContext;
  if (context.renderMode === 'menu') {
    return (
      <div>
        <SectionLabel tone="muted" className="mb-1 block">
          Auto router
        </SectionLabel>
        <AutoRouterControl pa={pa} context={context} />
      </div>
    );
  }
  return <AutoRouterControl pa={pa} context={context} />;
}
