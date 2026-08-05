// .tui-build/tui/plugin.mjs
import { createComponent as _$createComponent2 } from "opentui:runtime-module:%40opentui%2Fsolid";
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
      const list = result?.monitors ?? [];
      setMonitors(list.map((monitor) => toDisplay(monitor)));
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
          var _el$11 = _$createElement("box"), _el$12 = _$createElement("text"), _el$13 = _$createElement("text"), _el$14 = _$createTextNode(` `), _el$15 = _$createElement("text");
          _$insertNode(_el$11, _el$12);
          _$insertNode(_el$11, _el$13);
          _$insertNode(_el$11, _el$15);
          _$setProp(_el$11, "flexDirection", "row");
          _$setProp(_el$11, "width", "100%");
          _$insert(_el$12, () => sourceIcon(monitor.sourceType));
          _$insertNode(_el$13, _el$14);
          _$insert(_el$13, () => sourceLabel(monitor), null);
          _$insert(_el$15, () => monitor.detail);
          _$effect((_p$) => {
            var _v$3 = monitorTone(monitor, props.theme), _v$4 = props.theme.text, _v$5 = props.theme.textMuted;
            _v$3 !== _p$.e && (_p$.e = _$setProp(_el$12, "fg", _v$3, _p$.e));
            _v$4 !== _p$.t && (_p$.t = _$setProp(_el$13, "fg", _v$4, _p$.t));
            _v$5 !== _p$.a && (_p$.a = _$setProp(_el$15, "fg", _v$5, _p$.a));
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0
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
function toDisplay(monitor) {
  const source = monitor.source ?? {};
  return {
    id: String(monitor.id ?? ""),
    name: String(monitor.name ?? ""),
    sourceType: String(source.type ?? ""),
    detail: sourceDetail(source),
    enabled: Boolean(monitor.enabled),
    delivery: String(monitor.delivery ?? "poll")
  };
}
var SOURCE_ICONS = {
  jira: "\uFF2A",
  github: "\uFF27",
  slack: "\uFF33"
};
var SOURCE_LABELS = {
  jira: "Jira",
  github: "GitHub",
  slack: "Slack"
};
function sourceIcon(type) {
  return SOURCE_ICONS[type] ?? "?";
}
function sourceLabel(monitor) {
  return SOURCE_LABELS[monitor.sourceType] ?? monitor.sourceType;
}
function sourceDetail(source) {
  if (typeof source.repo === "string") return ` \xB7 ${source.repo}#${String(source.prNumber ?? "")}`;
  if (typeof source.issueKey === "string") return ` \xB7 ${source.issueKey}`;
  if (typeof source.channelId === "string") return ` \xB7 ${source.channelId}`;
  return "";
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
  const unregister = api.command?.register(() => [{
    value: "sourcefed",
    title: "Sourcefed monitors",
    description: "Show monitors for the current OpenCode session",
    slash: {
      name: "sourcefed"
    },
    onSelect: async (dialog) => {
      const currentRoute = api.route.current;
      const sessionID = "params" in currentRoute && typeof currentRoute.params?.sessionID === "string" ? currentRoute.params.sessionID : void 0;
      if (!sessionID) {
        api.ui.toast({
          variant: "warning",
          message: "No active OpenCode session"
        });
        return;
      }
      const url = process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl2();
      client ??= await connectDaemonClient2({
        name: "sourcefed-opencode-tui",
        url
      });
      const result = await client.request("monitor.list", {
        target: {
          kind: "opencode-session",
          id: sessionID
        }
      });
      const message = JSON.stringify(result, null, 2);
      dialog?.replace(() => api.ui.DialogAlert({
        title: "Sourcefed monitors",
        message,
        onConfirm: () => dialog.clear()
      }));
    }
  }]);
  void unregister;
};

// .tui-build/tui/index.mjs
var id = "sourcefed-tui";
var index_default = { id, tui: sourcefedTui };
export {
  index_default as default,
  id
};
