// .tui-build/tui/plugin.mjs
import { memo as _$memo2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { effect as _$effect2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createComponent as _$createComponent2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createMemo as createMemo2, Show as Show2 } from "opentui:runtime-module:solid-js";
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
var REFRESH_MS = 3e3;
function Sidebar(props) {
  const [monitors, setMonitors] = createSignal([]);
  const theme = createMemo(() => props.api.theme.current);
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
  return (() => {
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
      get theme() {
        return theme();
      },
      compact: true
    }), null);
    _$effect((_p$) => {
      var _v$ = theme().accent, _v$2 = theme().textMuted;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$5, "fg", _v$2, _p$.t));
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
function MonitorRows(props) {
  const visible = createMemo(() => props.monitors().slice(0, 4));
  return (() => {
    var _el$8 = _$createElement("box");
    _$setProp(_el$8, "flexDirection", "column");
    _$setProp(_el$8, "width", "100%");
    _$insert(_el$8, _$createComponent(Show, {
      get when() {
        return visible().length > 0;
      },
      get fallback() {
        return (() => {
          var _el$1 = _$createElement("text");
          _$insertNode(_el$1, _$createTextNode(`No active monitors`));
          _$effect((_$p) => _$setProp(_el$1, "fg", props.theme.textMuted, _$p));
          return _el$1;
        })();
      },
      get children() {
        return visible().map((monitor) => (() => {
          var _el$11 = _$createElement("box"), _el$12 = _$createElement("text"), _el$13 = _$createElement("text");
          _$insertNode(_el$11, _el$12);
          _$insertNode(_el$11, _el$13);
          _$setProp(_el$11, "flexDirection", "row");
          _$setProp(_el$11, "width", "100%");
          _$insert(_el$12, () => monitor.icon);
          _$insert(_el$13, () => monitor.detail);
          _$effect((_p$) => {
            var _v$3 = monitorTone(monitor, props.theme), _v$4 = props.theme.textMuted;
            _v$3 !== _p$.e && (_p$.e = _$setProp(_el$12, "fg", _v$3, _p$.e));
            _v$4 !== _p$.t && (_p$.t = _$setProp(_el$13, "fg", _v$4, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$11;
        })());
      }
    }), null);
    _$insert(_el$8, _$createComponent(Show, {
      get when() {
        return _$memo(() => !!props.compact)() && visible().length < props.monitors().length;
      },
      get children() {
        var _el$9 = _$createElement("text");
        _$insertNode(_el$9, _$createTextNode(`Open Sourcefed for more`));
        _$effect((_$p) => _$setProp(_el$9, "fg", props.theme.textMuted, _$p));
        return _el$9;
      }
    }), null);
    return _el$8;
  })();
}
function monitorTone(monitor, theme) {
  if (!monitor.enabled) return theme.textMuted;
  return theme.success;
}

// .tui-build/tui/plugin.mjs
var sourcefedTui = async (api) => {
  api.slots.register({
    order: 190,
    slots: {
      sidebar_content: (_context, value) => _$createComponent2(Sidebar, {
        api,
        get sessionID() {
          return value.session_id;
        }
      })
    }
  });
  let client;
  const getSessionID = () => {
    const currentRoute = api.route.current;
    return "params" in currentRoute && typeof currentRoute.params?.sessionID === "string" ? currentRoute.params.sessionID : void 0;
  };
  const getClient = async () => {
    if (client) return client;
    client = await connectDaemonClient2({
      name: "sourcefed-opencode-tui",
      url: process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl2()
    });
    return client;
  };
  const unregister = api.command?.register(() => [{
    value: "sourcefed",
    title: "Sourcefed monitors",
    description: "Show monitors for the current OpenCode session",
    slash: {
      name: "sourcefed"
    },
    onSelect: async (dialog) => {
      const sessionID = getSessionID();
      if (!sessionID) {
        api.ui.toast({
          variant: "warning",
          message: "No active OpenCode session"
        });
        return;
      }
      try {
        const daemon = await getClient();
        if (!daemon) throw new Error("no daemon client");
        const result = await daemon.request("monitor.list", {
          target: {
            kind: "opencode-session",
            id: sessionID
          }
        });
        const monitors = result?.monitors ?? [];
        api.ui.dialog.replace(() => _$createComponent2(MonitorDialog, {
          api,
          monitors
        }));
        api.ui.dialog.setSize("large");
      } catch (error) {
        api.ui.toast({
          variant: "error",
          message: `Sourcefed daemon unavailable: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  }, {
    value: "sourcefed-logs",
    title: "Sourcefed logs",
    description: "Show recent Sourcefed notifications for the current OpenCode session",
    slash: {
      name: "sourcefed-logs"
    },
    onSelect: async (dialog) => {
      const sessionID = getSessionID();
      if (!sessionID) {
        api.ui.toast({
          variant: "warning",
          message: "No active OpenCode session"
        });
        return;
      }
      try {
        const daemon = await getClient();
        if (!daemon) throw new Error("no daemon client");
        const result = await daemon.request("monitor.logs", {
          target: {
            kind: "opencode-session",
            id: sessionID
          }
        });
        const logs = result?.logs ?? [];
        api.ui.dialog.replace(() => _$createComponent2(LogsDialog, {
          api,
          logs
        }));
        api.ui.dialog.setSize("large");
      } catch (error) {
        api.ui.toast({
          variant: "error",
          message: `Sourcefed daemon unavailable: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  }]);
  void unregister;
};
function MonitorDialog(props) {
  const theme = createMemo2(() => props.api.theme.current);
  const active = props.monitors.filter((monitor) => monitor.enabled);
  const maxListRows = Math.max(6, Math.floor(props.api.renderer.height * 0.45));
  return (() => {
    var _el$ = _$createElement2("box"), _el$2 = _$createElement2("box"), _el$3 = _$createElement2("text"), _el$4 = _$createTextNode2(`Sourcefed monitors (`), _el$5 = _$createTextNode2(`)`), _el$6 = _$createElement2("box"), _el$7 = _$createElement2("text");
    _$insertNode2(_el$, _el$2);
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
    _$insert2(_el$3, () => active.length, _el$5);
    _$setProp2(_el$6, "flexGrow", 1);
    _$insertNode2(_el$7, _$createTextNode2(`esc`));
    _$insert2(_el$, _$createComponent2(Show2, {
      get when() {
        return active.length === 0;
      },
      get fallback() {
        return (() => {
          var _el$1 = _$createElement2("scrollbox"), _el$10 = _$createElement2("box");
          _$insertNode2(_el$1, _el$10);
          _$setProp2(_el$1, "maxHeight", maxListRows);
          _$setProp2(_el$1, "scrollY", true);
          _$setProp2(_el$10, "flexDirection", "column");
          _$setProp2(_el$10, "width", "100%");
          _$insert2(_el$10, () => active.map((monitor) => _$createComponent2(MonitorCard, {
            monitor,
            get theme() {
              return theme();
            }
          })));
          return _el$1;
        })();
      },
      get children() {
        var _el$9 = _$createElement2("text");
        _$insertNode2(_el$9, _$createTextNode2(`No active monitors`));
        _$effect2((_$p) => _$setProp2(_el$9, "fg", theme().textMuted, _$p));
        return _el$9;
      }
    }), null);
    _$effect2((_p$) => {
      var _v$ = theme().text, _v$2 = theme().textMuted;
      _v$ !== _p$.e && (_p$.e = _$setProp2(_el$3, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp2(_el$7, "fg", _v$2, _p$.t));
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
function MonitorCard(props) {
  const monitor = props.monitor;
  const theme = props.theme;
  const status = monitor.unresponsive ? theme.error : monitor.enabled ? theme.success : theme.textMuted;
  const statusLabel = !monitor.enabled ? "stopped" : monitor.unresponsive ? "recovering connection" : "healthy";
  const rows = [["Delivery", monitor.delivery], ["Poll interval", `${monitor.pollIntervalSec}s`], ["Created", formatTime(monitor.createdAt)], ["Updated", formatTime(monitor.updatedAt)], ["Last poll", formatTime(monitor.lastPolledAt)], ["Webhook heartbeat", formatTime(monitor.webhookHeartbeatAt)]];
  return (() => {
    var _el$11 = _$createElement2("box"), _el$12 = _$createElement2("box"), _el$13 = _$createElement2("text"), _el$15 = _$createElement2("text"), _el$16 = _$createTextNode2(` `), _el$17 = _$createTextNode2(` `), _el$18 = _$createElement2("text"), _el$19 = _$createTextNode2(` [`), _el$20 = _$createTextNode2(`]`);
    _$insertNode2(_el$11, _el$12);
    _$setProp2(_el$11, "flexDirection", "column");
    _$setProp2(_el$11, "width", "100%");
    _$setProp2(_el$11, "minWidth", 0);
    _$setProp2(_el$11, "marginBottom", 1);
    _$insertNode2(_el$12, _el$13);
    _$insertNode2(_el$12, _el$15);
    _$insertNode2(_el$12, _el$18);
    _$setProp2(_el$12, "flexDirection", "row");
    _$setProp2(_el$12, "width", "100%");
    _$setProp2(_el$12, "minWidth", 0);
    _$insertNode2(_el$13, _$createTextNode2(`\u25CF`));
    _$setProp2(_el$13, "fg", status);
    _$insertNode2(_el$15, _el$16);
    _$insertNode2(_el$15, _el$17);
    _$insert2(_el$15, () => monitor.icon, _el$17);
    _$insert2(_el$15, () => monitor.describe, null);
    _$insertNode2(_el$18, _el$19);
    _$insertNode2(_el$18, _el$20);
    _$setProp2(_el$18, "fg", status);
    _$setProp2(_el$18, "flexGrow", 1);
    _$setProp2(_el$18, "flexShrink", 1);
    _$setProp2(_el$18, "minWidth", 0);
    _$setProp2(_el$18, "truncate", true);
    _$insert2(_el$18, statusLabel, _el$20);
    _$insert2(_el$11, () => rows.map(([label, value]) => (() => {
      var _el$21 = _$createElement2("box"), _el$22 = _$createElement2("text"), _el$23 = _$createTextNode2(`: `), _el$24 = _$createElement2("text");
      _$insertNode2(_el$21, _el$22);
      _$insertNode2(_el$21, _el$24);
      _$setProp2(_el$21, "flexDirection", "row");
      _$setProp2(_el$21, "width", "100%");
      _$setProp2(_el$21, "minWidth", 0);
      _$insertNode2(_el$22, _el$23);
      _$setProp2(_el$22, "flexShrink", 0);
      _$insert2(_el$22, label, _el$23);
      _$setProp2(_el$24, "flexGrow", 1);
      _$setProp2(_el$24, "flexShrink", 1);
      _$setProp2(_el$24, "minWidth", 0);
      _$setProp2(_el$24, "truncate", true);
      _$insert2(_el$24, value);
      _$effect2((_p$) => {
        var _v$3 = theme.textMuted, _v$4 = theme.text;
        _v$3 !== _p$.e && (_p$.e = _$setProp2(_el$22, "fg", _v$3, _p$.e));
        _v$4 !== _p$.t && (_p$.t = _$setProp2(_el$24, "fg", _v$4, _p$.t));
        return _p$;
      }, {
        e: void 0,
        t: void 0
      });
      return _el$21;
    })()), null);
    _$effect2((_$p) => _$setProp2(_el$15, "fg", theme.text, _$p));
    return _el$11;
  })();
}
function formatTime(value) {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
function LogsDialog(props) {
  const theme = createMemo2(() => props.api.theme.current);
  const maxListRows = Math.max(6, Math.floor(props.api.renderer.height * 0.45));
  return (() => {
    var _el$25 = _$createElement2("box"), _el$26 = _$createElement2("box"), _el$27 = _$createElement2("text"), _el$28 = _$createTextNode2(`Sourcefed notifications (`), _el$29 = _$createTextNode2(`)`), _el$30 = _$createElement2("box"), _el$31 = _$createElement2("text");
    _$insertNode2(_el$25, _el$26);
    _$setProp2(_el$25, "flexDirection", "column");
    _$setProp2(_el$25, "width", "100%");
    _$setProp2(_el$25, "paddingX", 2);
    _$setProp2(_el$25, "paddingY", 1);
    _$insertNode2(_el$26, _el$27);
    _$insertNode2(_el$26, _el$30);
    _$insertNode2(_el$26, _el$31);
    _$setProp2(_el$26, "flexDirection", "row");
    _$setProp2(_el$26, "width", "100%");
    _$setProp2(_el$26, "minWidth", 0);
    _$insertNode2(_el$27, _el$28);
    _$insertNode2(_el$27, _el$29);
    _$setProp2(_el$27, "attributes", 1);
    _$insert2(_el$27, () => props.logs.length, _el$29);
    _$setProp2(_el$30, "flexGrow", 1);
    _$insertNode2(_el$31, _$createTextNode2(`esc`));
    _$insert2(_el$25, _$createComponent2(Show2, {
      get when() {
        return props.logs.length > 0;
      },
      get fallback() {
        return (() => {
          var _el$35 = _$createElement2("text");
          _$insertNode2(_el$35, _$createTextNode2(`No notifications sent yet`));
          _$effect2((_$p) => _$setProp2(_el$35, "fg", theme().textMuted, _$p));
          return _el$35;
        })();
      },
      get children() {
        var _el$33 = _$createElement2("scrollbox"), _el$34 = _$createElement2("box");
        _$insertNode2(_el$33, _el$34);
        _$setProp2(_el$33, "maxHeight", maxListRows);
        _$setProp2(_el$33, "scrollY", true);
        _$setProp2(_el$33, "stickyScroll", true);
        _$setProp2(_el$33, "stickyStart", "bottom");
        _$setProp2(_el$34, "flexDirection", "column");
        _$setProp2(_el$34, "width", "100%");
        _$insert2(_el$34, () => props.logs.map((entry) => (() => {
          var _el$37 = _$createElement2("box"), _el$38 = _$createElement2("box"), _el$39 = _$createElement2("text"), _el$40 = _$createElement2("text"), _el$41 = _$createTextNode2(` `), _el$42 = _$createElement2("text"), _el$43 = _$createTextNode2(` `), _el$44 = _$createTextNode2(` `);
          _$insertNode2(_el$37, _el$38);
          _$setProp2(_el$37, "flexDirection", "column");
          _$setProp2(_el$37, "width", "100%");
          _$insertNode2(_el$38, _el$39);
          _$insertNode2(_el$38, _el$40);
          _$insertNode2(_el$38, _el$42);
          _$setProp2(_el$38, "flexDirection", "row");
          _$setProp2(_el$38, "width", "100%");
          _$setProp2(_el$38, "minWidth", 0);
          _$insert2(_el$39, () => entry.actionable ? "\u25B6" : "\xB7");
          _$insertNode2(_el$40, _el$41);
          _$setProp2(_el$40, "flexShrink", 0);
          _$setProp2(_el$40, "minWidth", 0);
          _$insert2(_el$40, () => entry.icon, null);
          _$insertNode2(_el$42, _el$43);
          _$insertNode2(_el$42, _el$44);
          _$setProp2(_el$42, "flexGrow", 1);
          _$setProp2(_el$42, "flexShrink", 1);
          _$setProp2(_el$42, "minWidth", 0);
          _$setProp2(_el$42, "truncate", true);
          _$insert2(_el$42, () => new Date(entry.at).toLocaleString(), _el$44);
          _$insert2(_el$42, () => entry.summary, null);
          _$insert2(_el$37, _$createComponent2(Show2, {
            get when() {
              return entry.body;
            },
            get children() {
              var _el$45 = _$createElement2("text"), _el$46 = _$createTextNode2(` `);
              _$insertNode2(_el$45, _el$46);
              _$insert2(_el$45, () => entry.body, null);
              _$effect2((_$p) => _$setProp2(_el$45, "fg", theme().textMuted, _$p));
              return _el$45;
            }
          }), null);
          _$effect2((_p$) => {
            var _v$7 = entry.actionable ? theme().warning : theme().textMuted, _v$8 = theme().text, _v$9 = theme().text;
            _v$7 !== _p$.e && (_p$.e = _$setProp2(_el$39, "fg", _v$7, _p$.e));
            _v$8 !== _p$.t && (_p$.t = _$setProp2(_el$40, "fg", _v$8, _p$.t));
            _v$9 !== _p$.a && (_p$.a = _$setProp2(_el$42, "fg", _v$9, _p$.a));
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0
          });
          return _el$37;
        })()));
        return _el$33;
      }
    }), null);
    _$effect2((_p$) => {
      var _v$5 = theme().text, _v$6 = theme().textMuted;
      _v$5 !== _p$.e && (_p$.e = _$setProp2(_el$27, "fg", _v$5, _p$.e));
      _v$6 !== _p$.t && (_p$.t = _$setProp2(_el$31, "fg", _v$6, _p$.t));
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$25;
  })();
}

// .tui-build/tui/index.mjs
var id = "sourcefed-tui";
var index_default = { id, tui: sourcefedTui };
export {
  index_default as default,
  id
};
