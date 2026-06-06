import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageIntro,
  AppPageLayout,
  ChoiceRow,
  Field,
  Notice,
  PanelHeader,
  Pill,
  ProgressBar,
  RuntimeSection,
  RuntimeStrip,
  SurfacePanel,
  TerminalBlock,
  TextInput,
  ToolbarButton,
  cx,
} from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

type ServerHealth = { reachable: boolean; models?: string[] };
type ProcessState = { serverPid: number | null; serverRunning: boolean; setupPid: number | null; setupRunning: boolean };
type Settings = { backend: 'openrouter' | 'local'; cloudModel: string; localModel: string; hfToken: string };

type Status = {
  ok: boolean;
  modelId: string;
  baseUrl: string;
  runtimeInstalled: boolean;
  venvReady: boolean;
  server: ServerHealth & { listening?: boolean };
  process: ProcessState;
  settings: Settings;
  openrouterAuth?: { configured: boolean; source: 'stored' | 'environment' | 'none' };
  log: string;
};

export function VideoProbePage({ pa }: ExtensionSurfaceProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cloudModel, setCloudModel] = useState('');
  const [localModel, setLocalModel] = useState('');
  const [hfToken, setHfToken] = useState('');
  const [settingsDirty, setSettingsDirty] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLPreElement | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await pa.extension.invoke<Status>('videoProbeStatus', {});
      setStatus(result);
      // Sync local form state on first load (not while editing)
      if (!settingsDirty) {
        setCloudModel((current) => current || result.settings.cloudModel);
        setLocalModel((current) => current || result.settings.localModel);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [pa, settingsDirty]);

  useEffect(() => {
    void fetchStatus();
    pollRef.current = setInterval(() => void fetchStatus(), 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  // Auto-scroll log to bottom on updates
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [status?.log]);

  // Sync form fields when status first loads
  useEffect(() => {
    if (status && !settingsDirty) {
      if (!cloudModel) setCloudModel(status.settings.cloudModel);
      if (!localModel) setLocalModel(status.settings.localModel);
    }
  }, [status, settingsDirty, cloudModel, localModel]);

  async function runAction(label: string, actionId: string, input: Record<string, unknown> = {}) {
    setBusy(label);
    setError(null);
    try {
      const result = await pa.extension.invoke<{ ok: boolean; error?: string; status?: Status }>(actionId, input);
      if (result.status) setStatus(result.status);
      if (!result.ok && result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings(patch: Partial<Settings>) {
    setError(null);
    try {
      if (typeof patch.hfToken === 'string') {
        const response = await fetch('/api/secrets/system-video-probe/hfToken', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: patch.hfToken }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || 'Failed to save Hugging Face token.');
        }
        setHfToken('');
      }

      const settingsPatch: Partial<Settings> = { ...patch };
      delete settingsPatch.hfToken;
      const result = await pa.extension.invoke<{ ok: boolean; settings: Settings }>('videoProbeWriteSettings', settingsPatch);
      if (result.settings) {
        setStatus((prev) => (prev ? { ...prev, settings: result.settings } : prev));
        setSettingsDirty(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function setBackend(backend: 'openrouter' | 'local') {
    await saveSettings({ backend });
  }

  const setupRunning = status?.process.setupRunning ?? false;
  const serverRunning = status?.process.serverRunning ?? false;
  const serverReachable = status?.server.reachable ?? false;
  const serverListening = status?.server.listening ?? false;
  const runtimeInstalled = status?.runtimeInstalled ?? false;
  const currentBackend = status?.settings.backend ?? 'openrouter';
  const serverEnabled = serverReachable || serverRunning;
  const openrouterAuth = status?.openrouterAuth;

  const statusLabel =
    busy ??
    (serverReachable
      ? 'Running'
      : serverRunning || serverListening
        ? 'Loading model…'
        : setupRunning
          ? 'Installing'
          : runtimeInstalled
            ? 'Ready'
            : 'Not set up');
  const statusDotClass = serverReachable
    ? 'bg-success'
    : serverRunning || serverListening || setupRunning
      ? 'bg-warning animate-pulse'
      : 'bg-dim';

  async function toggleServer() {
    if (serverReachable || serverRunning) {
      await runAction('Stopping…', 'videoProbeStop');
    } else if (runtimeInstalled) {
      await runAction('Starting…', 'videoProbeStart');
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
        <AppPageIntro
          title="Video Probe"
          summary="Analyze video files with the probe_video agent tool. Uses Nemotron Nano Omni via mlx-vlm on Apple Silicon, or any configured OpenRouter model."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {currentBackend === 'local' && runtimeInstalled ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={serverEnabled}
                  aria-label="Enable local server"
                  disabled={Boolean(busy) || setupRunning}
                  onClick={() => void toggleServer()}
                  className="group inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-1.5 text-[12px] font-medium text-secondary transition-colors hover:bg-surface/45 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'relative inline-flex h-[18px] w-[32px] shrink-0 rounded-full border p-[1px] transition-all',
                      serverEnabled
                        ? 'border-accent/55 bg-accent/75 shadow-sm'
                        : 'border-border-default bg-surface/40 group-hover:bg-surface/60',
                    )}
                  >
                    <span
                      className={cx(
                        'h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform',
                        serverEnabled ? 'translate-x-[14px]' : 'translate-x-0',
                      )}
                    />
                  </span>
                  <span>Server</span>
                </button>
              ) : null}
              <div className="inline-flex items-center gap-2 text-sm text-secondary">
                <span className={cx('h-2 w-2 rounded-full', statusDotClass)} />
                <span className="font-medium text-primary">{statusLabel}</span>
              </div>
              <ToolbarButton onClick={() => void fetchStatus()} title="Refresh" aria-label="Refresh">
                ↻
              </ToolbarButton>
            </div>
          }
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}

        {setupRunning ? (
          <RuntimeStrip
            status="Installing mlx-vlm and downloading model…"
            tone="running"
            metadata={['~18 GB download']}
            message={
              <>
                Check the log below for progress.
                {!status?.settings.hfToken ? (
                  <span>
                    {' '}
                    Add a{' '}
                    <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-accent underline">
                      HF token
                    </a>{' '}
                    below to skip rate limits and speed things up.
                  </span>
                ) : null}
              </>
            }
          >
            <div className="flex flex-wrap items-center justify-end gap-3">
              <ToolbarButton disabled={Boolean(busy)} onClick={() => void runAction('Cancelling…', 'videoProbeCancel')}>
                Cancel
              </ToolbarButton>
            </div>
            <ProgressBar value={33} minPercent={33} className="mt-3" barClassName="animate-pulse" label="Setup progress" />
          </RuntimeStrip>
        ) : null}

        {/* Backend settings */}
        <SurfacePanel className="p-5">
          <PanelHeader title="Backend" meta="Choose where video analysis runs." titleClassName="text-[26px] leading-tight" />

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  id: 'openrouter',
                  label: 'OpenRouter',
                  description: 'Any configured OpenRouter model. Uses your existing provider credentials.',
                },
                {
                  id: 'local',
                  label: 'Local mlx-vlm',
                  description: 'Nemotron Nano Omni on Apple Silicon. Private, on-device. Requires setup below.',
                },
              ] as const
            ).map((option) => (
              <ChoiceRow
                key={option.id}
                onClick={() => void setBackend(option.id)}
                checked={currentBackend === option.id}
                label={option.label}
                details={option.description}
              >
                <span className="sr-only">{currentBackend === option.id ? 'Selected' : 'Not selected'}</span>
              </ChoiceRow>
            ))}
          </div>

          {currentBackend === 'openrouter' ? (
            <div className="mt-4 space-y-3">
              <Field label="Model">
                <div className="flex gap-2">
                  <TextInput
                    value={cloudModel}
                    placeholder="google/gemini-2.5-flash"
                    onChange={(e) => {
                      setCloudModel(e.target.value);
                      setSettingsDirty(true);
                    }}
                  />
                  <ToolbarButton disabled={!settingsDirty || !cloudModel.trim()} onClick={() => void saveSettings({ cloudModel })}>
                    Save
                  </ToolbarButton>
                </div>
              </Field>
              <Notice tone={openrouterAuth?.configured ? 'success' : openrouterAuth ? 'warning' : 'info'}>
                {!openrouterAuth ? (
                  <>Checking OpenRouter API key status…</>
                ) : openrouterAuth.configured ? (
                  <>
                    OpenRouter key detected from {openrouterAuth.source === 'environment' ? 'OPENROUTER_API_KEY' : 'provider settings'}. The
                    model must support video input (e.g. <span className="font-mono text-primary">google/gemini-2.5-flash</span>,{' '}
                    <span className="font-mono text-primary">qwen/qwen3.5-35b-a3b</span>).
                  </>
                ) : (
                  <>
                    No OpenRouter API key detected. Configure OpenRouter in{' '}
                    <a href="/settings/providers" className="text-accent underline underline-offset-2">
                      Settings → Providers
                    </a>
                    , or set <span className="font-mono text-primary">OPENROUTER_API_KEY</span>. The model must support video input.
                  </>
                )}
              </Notice>
            </div>
          ) : null}
        </SurfacePanel>

        {/* Local runtime section */}
        {currentBackend === 'local' ? (
          <SurfacePanel className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <PanelHeader
                title="Local Runtime"
                titleClassName="text-[26px] leading-tight"
                meta={
                  <span>
                  mlx-vlm runs Nemotron Nano Omni on Apple Silicon. Set up once; the agent auto-starts it when needed.
                  </span>
                }
              />
              <div className="flex flex-wrap gap-2">
                {!runtimeInstalled || setupRunning ? (
                  <ToolbarButton disabled={Boolean(busy) || setupRunning} onClick={() => void runAction('Installing…', 'videoProbeSetup')}>
                    {setupRunning ? 'Installing…' : 'Set Up'}
                  </ToolbarButton>
                ) : null}
                {runtimeInstalled || setupRunning ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (!window.confirm('Delete the mlx-vlm runtime and all downloaded model weights? This cannot be undone.')) return;
                      void runAction('Resetting…', 'videoProbeReset');
                    }}
                    className="ui-action-button border-danger/50 text-danger hover:bg-danger/10"
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-md border border-border-subtle bg-elevated p-2">
                <div className="text-dim">Runtime</div>
                <div className="mt-1">
                  {runtimeInstalled ? <Pill tone="success">Installed</Pill> : <Pill tone="warning">Not installed</Pill>}
                </div>
              </div>
              <div className="rounded-md border border-border-subtle bg-elevated p-2">
                <div className="text-dim">Server</div>
                <div className="mt-1">
                  {serverReachable ? (
                    <Pill tone="success">Running</Pill>
                  ) : serverRunning || serverListening ? (
                    <Pill tone="warning">Loading model…</Pill>
                  ) : (
                    <Pill>Stopped</Pill>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-border-subtle bg-elevated p-2">
                <div className="text-dim">Endpoint</div>
                <div className="mt-1 truncate font-mono text-primary">{status?.baseUrl ?? '…'}/v1</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <Field label="Model">
                <div className="flex gap-2">
                  <TextInput
                    value={localModel}
                    placeholder={status?.modelId ?? 'mlx-community/...'}
                    onChange={(e) => {
                      setLocalModel(e.target.value);
                      setSettingsDirty(true);
                    }}
                  />
                  <ToolbarButton disabled={!settingsDirty || !localModel.trim()} onClick={() => void saveSettings({ localModel })}>
                    Save
                  </ToolbarButton>
                </div>
              </Field>
              <Field label="Hugging Face Token (optional)">
                <div className="flex gap-2">
                  <TextInput
                    type="password"
                    value={hfToken}
                    placeholder={status?.settings.hfToken ? 'Token stored securely' : 'hf_...'}
                    onChange={(e) => {
                      setHfToken(e.target.value);
                      setSettingsDirty(true);
                    }}
                  />
                  <ToolbarButton disabled={!settingsDirty || !hfToken.trim()} onClick={() => void saveSettings({ hfToken })}>
                    Save
                  </ToolbarButton>
                </div>
                <span className="mt-1 block text-xs text-dim">
                  Speeds up downloads significantly. Get one at{' '}
                  <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-accent underline">
                    huggingface.co/settings/tokens
                  </a>
                  . Read-only scope is enough.
                </span>
              </Field>
            </div>
          </SurfacePanel>
        ) : null}

        {/* Log */}
        {currentBackend === 'local' ? (
          <RuntimeSection title="Runtime Logs" description="Setup and server output. Refreshes automatically.">
            <TerminalBlock ref={logRef} className="max-h-96 bg-base leading-5">
              {status?.log || 'No logs yet.'}
            </TerminalBlock>
          </RuntimeSection>
        ) : null}
      </AppPageLayout>
    </div>
  );
}
