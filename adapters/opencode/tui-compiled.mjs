// .tui-build/tui/plugin.mjs
import { memo as _$memo2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { effect as _$effect2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createComponent as _$createComponent2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createMemo as createMemo2, createSignal as createSignal2, Show as Show2 } from "opentui:runtime-module:solid-js";
import { connectDaemonClient as connectDaemonClient2, defaultDaemonUrl as defaultDaemonUrl2 } from "@fdcn/sourcefed/daemon";

// .tui-build/tui/sidebar.mjs
import { memo as _$memo } from "opentui:runtime-module:%40opentui%2Fsolid";
import { effect as _$effect } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createComponent as _$createComponent } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement } from "opentui:runtime-module:%40opentui%2Fsolid";
import { Show, createMemo, createSignal, onCleanup } from "opentui:runtime-module:solid-js";
import { connectDaemonClient, defaultDaemonUrl } from "@fdcn/sourcefed/daemon";
function tone(theme) {
  return {
    text: theme.text.base,
    textMuted: theme.text.muted,
    accent: theme.text.action.primary.base,
    success: theme.text.feedback.success.base,
    error: theme.text.feedback.error.base,
    warning: theme.text.feedback.warning.base
  };
}
var REFRESH_MS = 3e3;
function Sidebar(props) {
  const [monitors, setMonitors] = createSignal([]);
  const palette = createMemo(() => tone(props.ctx.theme));
  const active = createMemo(() => monitors().filter((monitor) => monitor.enabled));
  const refresh = async () => {
    let client;
    try {
      client = await connectDaemonClient({
        name: "sourcefed-opencode-tui",
        url: process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl()
      });
      const result = await client.request("monitor.list", {
        target: {
          kind: "opencode-session",
          id: props.sessionID
        }
      });
      setMonitors(result?.monitors ?? []);
    } catch {
      setMonitors([]);
    } finally {
      await client?.close();
    }
  };
  void refresh();
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  onCleanup(() => clearInterval(timer));
  return _$createComponent(Show, {
    get when() {
      return active().length > 0;
    },
    get children() {
      var _el$ = _$createElement("box"), _el$2 = _$createElement("box"), _el$3 = _$createElement("text"), _el$5 = _$createElement("text"), _el$6 = _$createTextNode(` (`), _el$7 = _$createTextNode(`)`);
      _$insertNode(_el$, _el$2);
      _$setProp(_el$, "flexDirection", "column");
      _$setProp(_el$, "width", "100%");
      _$setProp(_el$, "marginTop", 1);
      _$insertNode(_el$2, _el$3);
      _$insertNode(_el$2, _el$5);
      _$setProp(_el$2, "flexDirection", "row");
      _$setProp(_el$2, "width", "100%");
      _$insertNode(_el$3, _$createTextNode(`Sourcefed`));
      _$insertNode(_el$5, _el$6);
      _$insertNode(_el$5, _el$7);
      _$insert(_el$5, () => active().length, _el$7);
      _$insert(_el$, _$createComponent(MonitorRows, {
        monitors: active,
        get tone() {
          return palette();
        },
        compact: true
      }), null);
      _$effect((_p$) => {
        var _v$ = palette().accent, _v$2 = palette().textMuted;
        _v$ !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$, _p$.e));
        _v$2 !== _p$.t && (_p$.t = _$setProp(_el$5, "fg", _v$2, _p$.t));
        return _p$;
      }, {
        e: void 0,
        t: void 0
      });
      return _el$;
    }
  });
}
function MonitorRows(props) {
  const visible = createMemo(() => props.monitors().slice(0, 4));
  return (() => {
    var _el$8 = _$createElement("box");
    _$setProp(_el$8, "flexDirection", "column");
    _$setProp(_el$8, "width", "100%");
    _$insert(_el$8, () => visible().map((monitor) => (() => {
      var _el$1 = _$createElement("box"), _el$10 = _$createElement("text"), _el$11 = _$createElement("text"), _el$12 = _$createTextNode(` `);
      _$insertNode(_el$1, _el$10);
      _$insertNode(_el$1, _el$11);
      _$setProp(_el$1, "flexDirection", "row");
      _$setProp(_el$1, "width", "100%");
      _$insert(_el$10, () => monitor.icon);
      _$insertNode(_el$11, _el$12);
      _$insert(_el$11, () => monitor.name, null);
      _$effect((_p$) => {
        var _v$3 = monitorTone(monitor, props.tone), _v$4 = props.tone.textMuted;
        _v$3 !== _p$.e && (_p$.e = _$setProp(_el$10, "fg", _v$3, _p$.e));
        _v$4 !== _p$.t && (_p$.t = _$setProp(_el$11, "fg", _v$4, _p$.t));
        return _p$;
      }, {
        e: void 0,
        t: void 0
      });
      return _el$1;
    })()), null);
    _$insert(_el$8, _$createComponent(Show, {
      get when() {
        return _$memo(() => !!props.compact)() && visible().length < props.monitors().length;
      },
      get children() {
        var _el$9 = _$createElement("text");
        _$insertNode(_el$9, _$createTextNode(`Open Sourcefed for more`));
        _$effect((_$p) => _$setProp(_el$9, "fg", props.tone.textMuted, _$p));
        return _el$9;
      }
    }), null);
    return _el$8;
  })();
}
function monitorTone(monitor, tone2) {
  if (!monitor.enabled) return tone2.textMuted;
  return tone2.success;
}

// .tui-build/tui/plugin.mjs
var sourcefedTui = (ctx) => {
  let client;
  const getClient = async () => {
    if (!client) {
      client = await connectDaemonClient2({
        name: "sourcefed-opencode-tui",
        url: process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl2()
      });
    }
    return client;
  };
  const currentSessionID = () => {
    const route = ctx.ui.router.current();
    return route.type === "session" ? route.sessionID : void 0;
  };
  const monitorTarget = (id2) => ({
    target: {
      kind: "opencode-session",
      id: id2
    }
  });
  const listMonitors = async (sessionID) => {
    const result = await (await getClient()).request("monitor.list", monitorTarget(sessionID));
    return result?.monitors ?? [];
  };
  const runAction = async (sessionID, action, id2) => {
    const result = await (await getClient()).request(`monitor.${action}`, {
      ...monitorTarget(sessionID),
      id: id2
    });
    if (result?.ok === false) throw new Error(result.error ?? `monitor ${action} failed`);
  };
  const showMonitors = async (sessionID, focusIndex = 0) => {
    const monitors = await listMonitors(sessionID);
    ctx.ui.dialog.set({
      size: "large"
    });
    ctx.ui.dialog.show(() => _$createComponent2(MonitorDialog, {
      ctx,
      monitors,
      focusIndex,
      toggle: async (monitor) => {
        await runAction(sessionID, monitor.enabled ? "stop" : "start", monitor.id);
        return listMonitors(sessionID);
      },
      remove: (monitor, index) => void confirmRemove(sessionID, monitor, index)
    }));
  };
  const confirmRemove = async (sessionID, monitor, index) => {
    try {
      const confirmed = await ctx.ui.dialog.confirm({
        title: "Delete monitor",
        message: `Delete ${monitor.describe}? It stops watching and its record is removed.`,
        label: {
          confirm: "Delete",
          cancel: "Cancel"
        }
      });
      if (confirmed) {
        await runAction(sessionID, "remove", monitor.id);
        ctx.ui.toast.show({
          variant: "success",
          message: `Deleted ${monitor.name}`
        });
      }
      await showMonitors(sessionID, index);
    } catch (error) {
      ctx.ui.toast.show({
        variant: "error",
        message: `Sourcefed: ${errorMessage(error)}`
      });
    }
  };
  const disposeSlot = ctx.ui.slot({
    append: "sidebar.content",
    render: ({
      sessionID
    }) => _$createComponent2(Sidebar, {
      ctx,
      sessionID
    })
  });
  const disposeKeymapSlot = ctx.ui.slot({
    append: "app",
    render: () => _$createComponent2(KeymapRegistration, {
      ctx,
      currentSessionID,
      getClient,
      showMonitors
    })
  });
  return () => {
    disposeSlot();
    disposeKeymapSlot();
    void client?.close();
  };
};
function KeymapRegistration(props) {
  const {
    ctx,
    currentSessionID,
    getClient,
    showMonitors
  } = props;
  ctx.keymap.layer(() => ({
    mode: "global",
    commands: [{
      id: "sourcefed",
      title: "Sourcefed monitors",
      description: "Show, stop, start, or delete monitors for the current OpenCode session",
      slash: {
        name: "sourcefed"
      },
      run: async () => {
        const id2 = currentSessionID();
        if (!id2) {
          ctx.ui.toast.show({
            variant: "warning",
            message: "No active OpenCode session"
          });
          return;
        }
        try {
          await showMonitors(id2);
        } catch (error) {
          ctx.ui.toast.show({
            variant: "error",
            message: `Sourcefed daemon unavailable: ${errorMessage(error)}`
          });
        }
      }
    }, {
      id: "sourcefed-logs",
      title: "Sourcefed logs",
      description: "Show recent Sourcefed notifications for the current OpenCode session",
      slash: {
        name: "sourcefed-logs"
      },
      run: async () => {
        const id2 = currentSessionID();
        if (!id2) {
          ctx.ui.toast.show({
            variant: "warning",
            message: "No active OpenCode session"
          });
          return;
        }
        try {
          const daemon = await getClient();
          const result = await daemon.request("monitor.logs", {
            target: {
              kind: "opencode-session",
              id: id2
            }
          });
          const logs = result?.logs ?? [];
          ctx.ui.dialog.set({
            size: "large"
          });
          ctx.ui.dialog.show(() => _$createComponent2(LogsDialog, {
            ctx,
            logs
          }));
        } catch (error) {
          ctx.ui.toast.show({
            variant: "error",
            message: `Sourcefed daemon unavailable: ${errorMessage(error)}`
          });
        }
      }
    }]
  }));
  return null;
}
var DIALOG_LAYER_PRIORITY = 100;
function MonitorDialog(props) {
  const palette = createMemo2(() => tone(props.ctx.theme));
  const [monitors, setMonitors] = createSignal2(props.monitors);
  const [selected, setSelected] = createSignal2(clampIndex(props.focusIndex, props.monitors.length));
  const [busy, setBusy] = createSignal2();
  const [error, setError] = createSignal2();
  const active = createMemo2(() => monitors().filter((monitor) => monitor.enabled).length);
  const maxListRows = Math.max(6, Math.floor(props.ctx.renderer.height * 0.45));
  const move = (delta) => setSelected((index) => clampIndex(index + delta, monitors().length));
  const current = () => busy() ? void 0 : monitors()[selected()];
  const toggle = async (monitor) => {
    setError(void 0);
    setBusy(`${monitor.enabled ? "Stopping" : "Starting"} ${monitor.name}\u2026`);
    try {
      const next = await props.toggle(monitor);
      setMonitors(next);
      const kept = next.findIndex((candidate) => candidate.id === monitor.id);
      setSelected(clampIndex(kept >= 0 ? kept : selected(), next.length));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(void 0);
    }
  };
  props.ctx.keymap.layer(() => ({
    mode: "global",
    priority: DIALOG_LAYER_PRIORITY,
    commands: [{
      title: "Previous monitor",
      bind: "up",
      run: () => move(-1)
    }, {
      title: "Next monitor",
      bind: "down",
      run: () => move(1)
    }, {
      title: "Stop or start monitor",
      bind: "s",
      run: () => {
        const monitor = current();
        if (monitor) void toggle(monitor);
      }
    }, {
      title: "Delete monitor",
      bind: "d",
      run: () => {
        const monitor = current();
        if (monitor) props.remove(monitor, selected());
      }
    }]
  }));
  return (() => {
    var _el$ = _$createElement2("box"), _el$2 = _$createElement2("box"), _el$3 = _$createElement2("text"), _el$4 = _$createTextNode2(`Sourcefed monitors (`), _el$5 = _$createTextNode2(` active)`), _el$6 = _$createElement2("box"), _el$7 = _$createElement2("text"), _el$10 = _$createElement2("text");
    _$insertNode2(_el$, _el$2);
    _$insertNode2(_el$, _el$10);
    _$setProp2(_el$, "flexDirection", "column");
    _$setProp2(_el$, "width", "100%");
    _$setProp2(_el$, "paddingX", 2);
    _$setProp2(_el$, "paddingY", 1);
    _$insertNode2(_el$2, _el$3);
    _$insertNode2(_el$2, _el$6);
    _$insertNode2(_el$2, _el$7);
    _$setProp2(_el$2, "flexDirection", "row");
    _$setProp2(_el$2, "width", "100%");
    _$setProp2(_el$2, "minWidth", 0);
    _$insertNode2(_el$3, _el$4);
    _$insertNode2(_el$3, _el$5);
    _$setProp2(_el$3, "attributes", 1);
    _$insert2(_el$3, active, _el$5);
    _$setProp2(_el$6, "flexGrow", 1);
    _$insertNode2(_el$7, _$createTextNode2(`esc`));
    _$insert2(_el$, _$createComponent2(Show2, {
      get when() {
        return monitors().length > 0;
      },
      get fallback() {
        return (() => {
          var _el$11 = _$createElement2("text");
          _$insertNode2(_el$11, _$createTextNode2(`No monitors`));
          _$effect2((_$p) => _$setProp2(_el$11, "fg", palette().textMuted, _$p));
          return _el$11;
        })();
      },
      get children() {
        var _el$9 = _$createElement2("scrollbox"), _el$0 = _$createElement2("box");
        _$insertNode2(_el$9, _el$0);
        _$setProp2(_el$9, "maxHeight", maxListRows);
        _$setProp2(_el$9, "scrollY", true);
        _$setProp2(_el$0, "flexDirection", "column");
        _$setProp2(_el$0, "width", "100%");
        _$insert2(_el$0, () => monitors().map((monitor, index) => _$createComponent2(MonitorCard, {
          monitor,
          get tone() {
            return palette();
          },
          get selected() {
            return index === selected();
          }
        })));
        return _el$9;
      }
    }), _el$10);
    _$insert2(_el$, _$createComponent2(Show2, {
      get when() {
        return error();
      },
      get children() {
        var _el$1 = _$createElement2("text");
        _$insert2(_el$1, error);
        _$effect2((_$p) => _$setProp2(_el$1, "fg", palette().error, _$p));
        return _el$1;
      }
    }), _el$10);
    _$insert2(_el$10, () => busy() ?? "\u2191\u2193 select \xB7 s stop/start \xB7 d delete \xB7 esc close");
    _$effect2((_p$) => {
      var _v$ = palette().text, _v$2 = palette().textMuted, _v$3 = palette().textMuted;
      _v$ !== _p$.e && (_p$.e = _$setProp2(_el$3, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp2(_el$7, "fg", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp2(_el$10, "fg", _v$3, _p$.a));
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$;
  })();
}
function MonitorCard(props) {
  const monitor = props.monitor;
  const palette = props.tone;
  const status = !monitor.enabled ? palette.textMuted : monitor.unresponsive ? palette.error : palette.success;
  const statusLabel = !monitor.enabled ? "stopped" : monitor.unresponsive ? "recovering connection" : "healthy";
  const rows = [["Delivery", monitor.delivery], ["Poll interval", `${monitor.pollIntervalSec}s`], ["Created", formatTime(monitor.createdAt)], ["Updated", formatTime(monitor.updatedAt)], ["Last poll", formatTime(monitor.lastPolledAt)], ["Webhook heartbeat", formatTime(monitor.webhookHeartbeatAt)]];
  return (() => {
    var _el$13 = _$createElement2("box"), _el$14 = _$createElement2("box"), _el$15 = _$createElement2("box"), _el$16 = _$createElement2("text"), _el$17 = _$createElement2("text"), _el$19 = _$createElement2("text"), _el$20 = _$createTextNode2(` `), _el$21 = _$createTextNode2(` `), _el$22 = _$createElement2("text"), _el$23 = _$createTextNode2(` [`), _el$24 = _$createTextNode2(`]`);
    _$insertNode2(_el$13, _el$14);
    _$setProp2(_el$13, "flexDirection", "column");
    _$setProp2(_el$13, "width", "100%");
    _$setProp2(_el$13, "minWidth", 0);
    _$insertNode2(_el$14, _el$15);
    _$insertNode2(_el$14, _el$17);
    _$insertNode2(_el$14, _el$19);
    _$insertNode2(_el$14, _el$22);
    _$setProp2(_el$14, "flexDirection", "row");
    _$setProp2(_el$14, "width", "100%");
    _$setProp2(_el$14, "minWidth", 0);
    _$insertNode2(_el$15, _el$16);
    _$setProp2(_el$15, "width", 2);
    _$setProp2(_el$15, "flexShrink", 0);
    _$insert2(_el$16, () => props.selected ? "\u203A" : "");
    _$insertNode2(_el$17, _$createTextNode2(`\u25CF`));
    _$setProp2(_el$17, "fg", status);
    _$insertNode2(_el$19, _el$20);
    _$insertNode2(_el$19, _el$21);
    _$insert2(_el$19, () => monitor.icon, _el$21);
    _$insert2(_el$19, () => monitor.describe, null);
    _$insertNode2(_el$22, _el$23);
    _$insertNode2(_el$22, _el$24);
    _$setProp2(_el$22, "fg", status);
    _$setProp2(_el$22, "flexGrow", 1);
    _$setProp2(_el$22, "flexShrink", 1);
    _$setProp2(_el$22, "minWidth", 0);
    _$setProp2(_el$22, "truncate", true);
    _$insert2(_el$22, statusLabel, _el$24);
    _$insert2(_el$13, _$createComponent2(Show2, {
      get when() {
        return props.selected;
      },
      get children() {
        return rows.map(([label, value]) => (() => {
          var _el$25 = _$createElement2("box"), _el$26 = _$createElement2("text"), _el$27 = _$createTextNode2(`: `), _el$28 = _$createElement2("text");
          _$insertNode2(_el$25, _el$26);
          _$insertNode2(_el$25, _el$28);
          _$setProp2(_el$25, "flexDirection", "row");
          _$setProp2(_el$25, "width", "100%");
          _$setProp2(_el$25, "minWidth", 0);
          _$setProp2(_el$25, "paddingLeft", 4);
          _$insertNode2(_el$26, _el$27);
          _$setProp2(_el$26, "flexShrink", 0);
          _$insert2(_el$26, label, _el$27);
          _$setProp2(_el$28, "flexGrow", 1);
          _$setProp2(_el$28, "flexShrink", 1);
          _$setProp2(_el$28, "minWidth", 0);
          _$setProp2(_el$28, "truncate", true);
          _$insert2(_el$28, value);
          _$effect2((_p$) => {
            var _v$7 = palette.textMuted, _v$8 = palette.text;
            _v$7 !== _p$.e && (_p$.e = _$setProp2(_el$26, "fg", _v$7, _p$.e));
            _v$8 !== _p$.t && (_p$.t = _$setProp2(_el$28, "fg", _v$8, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$25;
        })());
      }
    }), null);
    _$effect2((_p$) => {
      var _v$4 = props.selected ? 1 : 0, _v$5 = palette.accent, _v$6 = palette.text;
      _v$4 !== _p$.e && (_p$.e = _$setProp2(_el$13, "marginBottom", _v$4, _p$.e));
      _v$5 !== _p$.t && (_p$.t = _$setProp2(_el$16, "fg", _v$5, _p$.t));
      _v$6 !== _p$.a && (_p$.a = _$setProp2(_el$19, "fg", _v$6, _p$.a));
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$13;
  })();
}
function clampIndex(index, length) {
  return Math.min(Math.max(index, 0), Math.max(length - 1, 0));
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function formatTime(value) {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
function LogsDialog(props) {
  const palette = createMemo2(() => tone(props.ctx.theme));
  const maxListRows = Math.max(6, Math.floor(props.ctx.renderer.height * 0.45));
  return (() => {
    var _el$29 = _$createElement2("box"), _el$30 = _$createElement2("box"), _el$31 = _$createElement2("text"), _el$32 = _$createTextNode2(`Sourcefed notifications (`), _el$33 = _$createTextNode2(`)`), _el$34 = _$createElement2("box"), _el$35 = _$createElement2("text");
    _$insertNode2(_el$29, _el$30);
    _$setProp2(_el$29, "flexDirection", "column");
    _$setProp2(_el$29, "width", "100%");
    _$setProp2(_el$29, "paddingX", 2);
    _$setProp2(_el$29, "paddingY", 1);
    _$insertNode2(_el$30, _el$31);
    _$insertNode2(_el$30, _el$34);
    _$insertNode2(_el$30, _el$35);
    _$setProp2(_el$30, "flexDirection", "row");
    _$setProp2(_el$30, "width", "100%");
    _$setProp2(_el$30, "minWidth", 0);
    _$insertNode2(_el$31, _el$32);
    _$insertNode2(_el$31, _el$33);
    _$setProp2(_el$31, "attributes", 1);
    _$insert2(_el$31, () => props.logs.length, _el$33);
    _$setProp2(_el$34, "flexGrow", 1);
    _$insertNode2(_el$35, _$createTextNode2(`esc`));
    _$insert2(_el$29, _$createComponent2(Show2, {
      get when() {
        return props.logs.length > 0;
      },
      get fallback() {
        return (() => {
          var _el$39 = _$createElement2("text");
          _$insertNode2(_el$39, _$createTextNode2(`No notifications sent yet`));
          _$effect2((_$p) => _$setProp2(_el$39, "fg", palette().textMuted, _$p));
          return _el$39;
        })();
      },
      get children() {
        var _el$37 = _$createElement2("scrollbox"), _el$38 = _$createElement2("box");
        _$insertNode2(_el$37, _el$38);
        _$setProp2(_el$37, "maxHeight", maxListRows);
        _$setProp2(_el$37, "scrollY", true);
        _$setProp2(_el$37, "stickyScroll", true);
        _$setProp2(_el$37, "stickyStart", "bottom");
        _$setProp2(_el$38, "flexDirection", "column");
        _$setProp2(_el$38, "width", "100%");
        _$insert2(_el$38, () => props.logs.map((entry) => (() => {
          var _el$41 = _$createElement2("box"), _el$42 = _$createElement2("box"), _el$43 = _$createElement2("text"), _el$44 = _$createElement2("text"), _el$45 = _$createTextNode2(` `), _el$46 = _$createElement2("text"), _el$47 = _$createTextNode2(` `), _el$48 = _$createTextNode2(` `);
          _$insertNode2(_el$41, _el$42);
          _$setProp2(_el$41, "flexDirection", "column");
          _$setProp2(_el$41, "width", "100%");
          _$insertNode2(_el$42, _el$43);
          _$insertNode2(_el$42, _el$44);
          _$insertNode2(_el$42, _el$46);
          _$setProp2(_el$42, "flexDirection", "row");
          _$setProp2(_el$42, "width", "100%");
          _$setProp2(_el$42, "minWidth", 0);
          _$insert2(_el$43, () => entry.actionable ? "\u25B6" : "\xB7");
          _$insertNode2(_el$44, _el$45);
          _$setProp2(_el$44, "flexShrink", 0);
          _$setProp2(_el$44, "minWidth", 0);
          _$insert2(_el$44, () => entry.icon, null);
          _$insertNode2(_el$46, _el$47);
          _$insertNode2(_el$46, _el$48);
          _$setProp2(_el$46, "flexGrow", 1);
          _$setProp2(_el$46, "flexShrink", 1);
          _$setProp2(_el$46, "minWidth", 0);
          _$setProp2(_el$46, "truncate", true);
          _$insert2(_el$46, () => new Date(entry.at).toLocaleString(), _el$48);
          _$insert2(_el$46, () => entry.summary, null);
          _$insert2(_el$41, _$createComponent2(Show2, {
            get when() {
              return entry.body;
            },
            get children() {
              var _el$49 = _$createElement2("text"), _el$50 = _$createTextNode2(` `);
              _$insertNode2(_el$49, _el$50);
              _$insert2(_el$49, () => entry.body, null);
              _$effect2((_$p) => _$setProp2(_el$49, "fg", palette().textMuted, _$p));
              return _el$49;
            }
          }), null);
          _$effect2((_p$) => {
            var _v$1 = entry.actionable ? palette().warning : palette().textMuted, _v$10 = palette().text, _v$11 = palette().text;
            _v$1 !== _p$.e && (_p$.e = _$setProp2(_el$43, "fg", _v$1, _p$.e));
            _v$10 !== _p$.t && (_p$.t = _$setProp2(_el$44, "fg", _v$10, _p$.t));
            _v$11 !== _p$.a && (_p$.a = _$setProp2(_el$46, "fg", _v$11, _p$.a));
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0
          });
          return _el$41;
        })()));
        return _el$37;
      }
    }), null);
    _$effect2((_p$) => {
      var _v$9 = palette().text, _v$0 = palette().textMuted;
      _v$9 !== _p$.e && (_p$.e = _$setProp2(_el$31, "fg", _v$9, _p$.e));
      _v$0 !== _p$.t && (_p$.t = _$setProp2(_el$35, "fg", _v$0, _p$.t));
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$29;
  })();
}

// .tui-build/tui/index.mjs
var id = "sourcefed-tui";
var index_default = { id, setup: sourcefedTui };
export {
  index_default as default,
  id
};
