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
import { connectDaemonClient as connectDaemonClient2, defaultDaemonUrl as defaultDaemonUrl2 } from "@sourcefed/daemon";

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
import { connectDaemonClient, defaultDaemonUrl } from "@sourcefed/daemon";
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
    value: "sourcefed logs",
    title: "Sourcefed logs",
    description: "Show recent Sourcefed notifications for the current OpenCode session",
    slash: {
      name: "sourcefed logs"
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
  return (() => {
    var _el$ = _$createElement2("box"), _el$2 = _$createElement2("text"), _el$3 = _$createTextNode2(`Sourcefed monitors (`), _el$4 = _$createTextNode2(`)`);
    _$insertNode2(_el$, _el$2);
    _$setProp2(_el$, "flexDirection", "column");
    _$setProp2(_el$, "width", "100%");
    _$insertNode2(_el$2, _el$3);
    _$insertNode2(_el$2, _el$4);
    _$insert2(_el$2, () => props.monitors.length, _el$4);
    _$insert2(_el$, _$createComponent2(Show2, {
      get when() {
        return props.monitors.length === 0;
      },
      get fallback() {
        return (() => {
          var _el$7 = _$createElement2("box");
          _$setProp2(_el$7, "flexDirection", "column");
          _$setProp2(_el$7, "width", "100%");
          _$insert2(_el$7, () => props.monitors.map((monitor) => (() => {
            var _el$8 = _$createElement2("box"), _el$9 = _$createElement2("text"), _el$0 = _$createTextNode2(` `), _el$1 = _$createElement2("text"), _el$10 = _$createTextNode2(` `), _el$11 = _$createElement2("text");
            _$insertNode2(_el$8, _el$9);
            _$insertNode2(_el$8, _el$1);
            _$insertNode2(_el$8, _el$11);
            _$setProp2(_el$8, "flexDirection", "row");
            _$setProp2(_el$8, "width", "100%");
            _$insertNode2(_el$9, _el$0);
            _$insert2(_el$9, () => monitor.enabled ? "\u25CF" : "\u25CB", _el$0);
            _$insertNode2(_el$1, _el$10);
            _$insert2(_el$1, () => monitor.icon, _el$10);
            _$insert2(_el$1, () => monitor.describe, null);
            _$insert2(_el$11, () => monitor.detail);
            _$effect2((_p$) => {
              var _v$ = monitor.enabled ? theme().success : theme().textMuted, _v$2 = theme().text, _v$3 = theme().textMuted;
              _v$ !== _p$.e && (_p$.e = _$setProp2(_el$9, "fg", _v$, _p$.e));
              _v$2 !== _p$.t && (_p$.t = _$setProp2(_el$1, "fg", _v$2, _p$.t));
              _v$3 !== _p$.a && (_p$.a = _$setProp2(_el$11, "fg", _v$3, _p$.a));
              return _p$;
            }, {
              e: void 0,
              t: void 0,
              a: void 0
            });
            return _el$8;
          })()));
          return _el$7;
        })();
      },
      get children() {
        var _el$5 = _$createElement2("text");
        _$insertNode2(_el$5, _$createTextNode2(`No active monitors`));
        _$effect2((_$p) => _$setProp2(_el$5, "fg", theme().textMuted, _$p));
        return _el$5;
      }
    }), null);
    _$effect2((_$p) => _$setProp2(_el$2, "fg", theme().accent, _$p));
    return _el$;
  })();
}
function LogsDialog(props) {
  const theme = createMemo2(() => props.api.theme.current);
  return (() => {
    var _el$12 = _$createElement2("box"), _el$13 = _$createElement2("text"), _el$14 = _$createTextNode2(`Sourcefed notifications (`), _el$15 = _$createTextNode2(`)`);
    _$insertNode2(_el$12, _el$13);
    _$setProp2(_el$12, "flexDirection", "column");
    _$setProp2(_el$12, "width", "100%");
    _$insertNode2(_el$13, _el$14);
    _$insertNode2(_el$13, _el$15);
    _$insert2(_el$13, () => props.logs.length, _el$15);
    _$insert2(_el$12, _$createComponent2(Show2, {
      get when() {
        return props.logs.length > 0;
      },
      get fallback() {
        return (() => {
          var _el$17 = _$createElement2("text");
          _$insertNode2(_el$17, _$createTextNode2(`No notifications sent yet`));
          _$effect2((_$p) => _$setProp2(_el$17, "fg", theme().textMuted, _$p));
          return _el$17;
        })();
      },
      get children() {
        var _el$16 = _$createElement2("box");
        _$setProp2(_el$16, "flexDirection", "column");
        _$setProp2(_el$16, "width", "100%");
        _$insert2(_el$16, () => props.logs.map((entry) => (() => {
          var _el$19 = _$createElement2("box"), _el$20 = _$createElement2("box"), _el$21 = _$createElement2("text"), _el$22 = _$createTextNode2(` `), _el$23 = _$createElement2("text"), _el$24 = _$createTextNode2(` `), _el$25 = _$createTextNode2(` `);
          _$insertNode2(_el$19, _el$20);
          _$setProp2(_el$19, "flexDirection", "column");
          _$setProp2(_el$19, "width", "100%");
          _$insertNode2(_el$20, _el$21);
          _$insertNode2(_el$20, _el$23);
          _$setProp2(_el$20, "flexDirection", "row");
          _$setProp2(_el$20, "width", "100%");
          _$insertNode2(_el$21, _el$22);
          _$insert2(_el$21, () => entry.actionable ? "\u25B6" : "\xB7", _el$22);
          _$insertNode2(_el$23, _el$24);
          _$insertNode2(_el$23, _el$25);
          _$insert2(_el$23, () => entry.icon, _el$24);
          _$insert2(_el$23, () => new Date(entry.at).toLocaleString(), _el$25);
          _$insert2(_el$23, () => entry.summary, null);
          _$insert2(_el$19, _$createComponent2(Show2, {
            get when() {
              return entry.body;
            },
            get children() {
              var _el$26 = _$createElement2("text"), _el$27 = _$createTextNode2(` `);
              _$insertNode2(_el$26, _el$27);
              _$insert2(_el$26, () => entry.body, null);
              _$effect2((_$p) => _$setProp2(_el$26, "fg", theme().textMuted, _$p));
              return _el$26;
            }
          }), null);
          _$effect2((_p$) => {
            var _v$4 = entry.actionable ? theme().warning : theme().textMuted, _v$5 = theme().text;
            _v$4 !== _p$.e && (_p$.e = _$setProp2(_el$21, "fg", _v$4, _p$.e));
            _v$5 !== _p$.t && (_p$.t = _$setProp2(_el$23, "fg", _v$5, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$19;
        })()));
        return _el$16;
      }
    }), null);
    _$effect2((_$p) => _$setProp2(_el$13, "fg", theme().accent, _$p));
    return _el$12;
  })();
}

// .tui-build/tui/index.mjs
var id = "sourcefed-tui";
var index_default = { id, tui: sourcefedTui };
export {
  index_default as default,
  id
};
