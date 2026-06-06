import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { Button, CodeBlock, Disclosure, Notice, Pill, ResourceList, ResourceListRow, Textarea } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface AlleycatPairPayload {
  v: 1;
  node_id: string;
  token: string;
  relay: string | null;
}

interface AlleycatStatus {
  running: boolean;
  port: number | null;
  pairPayload: AlleycatPairPayload | null;
  agents: Array<{ name: string; display_name: string; wire: string; available: boolean }>;
  implementation: string;
  sidecarRunning: boolean;
  logs: string[];
  note: string;
}

interface AlleycatSettingsPanelProps {
  pa: NativeExtensionClient;
}

const SECTION = 'mb-6';
const LABEL = 'mb-1.5 text-[12px] font-medium text-secondary';
const NOTE = 'mt-1 text-[11px] leading-relaxed text-tertiary';

function shortNodeId(nodeId: string): string {
  return nodeId.length <= 18 ? nodeId : `${nodeId.slice(0, 8)}…${nodeId.slice(-8)}`;
}

export function AlleycatSettingsPanel({ pa }: AlleycatSettingsPanelProps) {
  return <AlleycatPanel pa={pa} />;
}

function AlleycatPanel({ pa }: AlleycatSettingsPanelProps) {
  const [status, setStatus] = useState<AlleycatStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus((await pa.extension.invoke('alleycatStatus')) as AlleycatStatus);
    } finally {
      setLoading(false);
    }
  }, [pa]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pairPayloadJson = useMemo(() => {
    if (!status?.pairPayload) return '';
    return JSON.stringify(status.pairPayload, null, 2);
  }, [status?.pairPayload]);
  const pairPayloadReady = Boolean(status?.pairPayload?.node_id && status.pairPayload.node_id !== 'sidecar-not-running');
  const qrCodeUrl =
    pairPayloadJson && pairPayloadReady
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pairPayloadJson)}`
      : null;

  async function invoke(action: 'rotateToken') {
    setBusy(true);
    try {
      const result = (await pa.extension.invoke(action)) as AlleycatStatus | { ok: true };
      if ('running' in result) setStatus(result);
      else await refresh();
    } catch (error) {
      pa.ui.notify({
        type: 'error',
        message: `Alleycat ${action} failed`,
        details: error instanceof Error ? error.message : String(error),
        source: 'system-alleycat',
      });
    } finally {
      setBusy(false);
    }
  }

  async function copyPairPayload() {
    if (!pairPayloadJson) return;
    await navigator.clipboard.writeText(pairPayloadJson).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (loading) return <p className="text-[13px] text-tertiary">Loading Alleycat host status…</p>;

  return (
    <div>
      <div className={SECTION}>
        <div className={LABEL}>Setup</div>
        <Notice title="Use the Kitty Litter iOS app, not the Kitty Litter npm host.">
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Enable this extension in Neon Pilot; the companion host starts automatically.</li>
            <li>Open Kitty Litter on your phone and scan this QR code.</li>
            <li>Select Neon Pilot. It should be the only advertised agent.</li>
          </ol>
          <p className="mt-2 text-tertiary">
            Disable the extension to stop the host. Do not install or run <span className="font-mono">npx kittylitter</span>; that starts
            the upstream host and advertises its built-in agents.
          </p>
        </Notice>
      </div>

      <div className={SECTION}>
        <div className={LABEL}>Host status</div>
        <div className="flex items-center gap-2 text-[13px] text-primary">
          <span className={`inline-block h-2 w-2 rounded-full ${status?.running ? 'bg-success' : 'bg-danger'}`} />
          <Pill tone={status?.running ? 'success' : 'danger'}>{status?.running ? 'Running' : 'Stopped'}</Pill>
          {status?.port ? <span className="text-tertiary">local compat port {status.port}</span> : null}
          {status?.implementation ? <span className="text-tertiary">· {status.implementation}</span> : null}
        </div>
        <p className={NOTE}>{status?.note}</p>
      </div>

      <div className={SECTION}>
        <div className={LABEL}>Advertised agents</div>
        <ResourceList>
          {(status?.agents ?? []).map((agent) => (
            <ResourceListRow
              key={agent.name}
              title={agent.display_name}
              detail={`${agent.name} · ${agent.wire}`}
              meta={agent.available ? 'Available' : 'Unavailable'}
              metaTone={agent.available ? 'success' : 'muted'}
            />
          ))}
        </ResourceList>
      </div>

      {status?.pairPayload && pairPayloadReady ? (
        <div className={SECTION}>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <div className={LABEL}>Pairing QR</div>
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="Alleycat pairing QR code"
                  className="h-[180px] w-[180px] rounded-lg border border-border-subtle"
                />
              ) : null}
              <p className={NOTE}>
                Node {shortNodeId(status.pairPayload.node_id)} · relay {status.pairPayload.relay ?? 'default'}
              </p>
            </div>
            <Disclosure summary={<span className="text-[12px] font-medium text-primary">Pair payload</span>} className="self-start">
              <Textarea
                readOnly
                className="mt-2 min-h-[9rem] resize-none font-mono text-[12px]"
                value={pairPayloadJson}
                onClick={(event) => event.currentTarget.select()}
              />
            </Disclosure>
          </div>
        </div>
      ) : null}

      {status?.logs?.length ? (
        <Disclosure className={SECTION} summary={<span className="text-[12px] font-medium text-primary">Host logs</span>}>
          <CodeBlock compact className="max-h-40 overflow-auto">
            {status.logs.slice(-12).join('\n')}
          </CodeBlock>
        </Disclosure>
      ) : null}

      <div className={SECTION}>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !status?.pairPayload} onClick={() => void copyPairPayload()}>
            {copied ? 'Copied' : 'Copy pair payload'}
          </Button>
          <Button disabled={busy} onClick={() => void invoke('rotateToken')}>
            Rotate token
          </Button>
          <Button disabled={busy} onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
