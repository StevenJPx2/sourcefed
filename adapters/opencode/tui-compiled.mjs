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

// packages/daemon/dist/index.js
import { link, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { link as link2, mkdir as mkdir2, open as open2, readFile as readFile2, rename as rename2, rm as rm2, writeFile as writeFile2 } from "node:fs/promises";
import os2 from "node:os";
import path2 from "node:path";
import { inflateRawSync } from "node:zlib";
import { createHmac, timingSafeEqual } from "node:crypto";
import { link as link3, mkdir as mkdir3, open as open3, readFile as readFile3, rename as rename3, rm as rm3, writeFile as writeFile3 } from "node:fs/promises";
import os3 from "node:os";
import path3 from "node:path";
import { link as link4, mkdir as mkdir4, open as open4, readFile as readFile4, rename as rename4, rm as rm4, writeFile as writeFile4 } from "node:fs/promises";
import os4 from "node:os";
import path4 from "node:path";
import { createHmac as createHmac2 } from "node:crypto";
import { timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import os5 from "node:os";
import path5 from "node:path";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";
import path6 from "node:path";
var EMOJI_REGEX = new RegExp("^(?:[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation}))*)+$", "u");
var MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
var store$42;
var DEFAULT_CONFIG2 = {
  lang: void 0,
  message: void 0,
  abortEarly: void 0,
  abortPipeEarly: void 0
};
// @__NO_SIDE_EFFECTS__
function getGlobalConfig2(config$1) {
  if (!config$1 && !store$42) return DEFAULT_CONFIG2;
  return {
    lang: config$1?.lang ?? store$42?.lang,
    message: config$1?.message,
    abortEarly: config$1?.abortEarly ?? store$42?.abortEarly,
    abortPipeEarly: config$1?.abortPipeEarly ?? store$42?.abortPipeEarly
  };
}
var store$32;
// @__NO_SIDE_EFFECTS__
function getGlobalMessage2(lang) {
  return store$32?.get(lang);
}
var store$22;
// @__NO_SIDE_EFFECTS__
function getSchemaMessage2(lang) {
  return store$22?.get(lang);
}
var store$12;
// @__NO_SIDE_EFFECTS__
function getSpecificMessage2(reference, lang) {
  return store$12?.get(reference)?.get(lang);
}
// @__NO_SIDE_EFFECTS__
function _stringify2(input) {
  const type = typeof input;
  if (type === "string") return `"${input}"`;
  if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
  if (type === "object" || type === "function") return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  return type;
}
function _addIssue2(context, label, dataset, config$1, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */ _stringify2(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config$1.lang,
    abortEarly: config$1.abortEarly,
    abortPipeEarly: config$1.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message$1 = other?.message ?? context.message ?? /* @__PURE__ */ getSpecificMessage2(context.reference, issue.lang) ?? (isSchema ? /* @__PURE__ */ getSchemaMessage2(issue.lang) : null) ?? config$1.message ?? /* @__PURE__ */ getGlobalMessage2(issue.lang);
  if (message$1 !== void 0) issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
  if (isSchema) dataset.typed = false;
  if (dataset.issues) dataset.issues.push(issue);
  else dataset.issues = [issue];
}
var _standardCache2 = /* @__PURE__ */ new WeakMap();
// @__NO_SIDE_EFFECTS__
function _getStandardProps2(context) {
  let cached = _standardCache2.get(context);
  if (!cached) {
    cached = {
      version: 1,
      vendor: "valibot",
      validate(value$1) {
        return context["~run"]({ value: value$1 }, /* @__PURE__ */ getGlobalConfig2());
      }
    };
    _standardCache2.set(context, cached);
  }
  return cached;
}
var EMOJI_REGEX2 = new RegExp("^(?:[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation}))*)+$", "u");
// @__NO_SIDE_EFFECTS__
function getFallback2(schema, dataset, config$1) {
  return typeof schema.fallback === "function" ? schema.fallback(dataset, config$1) : schema.fallback;
}
// @__NO_SIDE_EFFECTS__
function getDefault2(schema, dataset, config$1) {
  return typeof schema.default === "function" ? schema.default(dataset, config$1) : schema.default;
}
// @__NO_SIDE_EFFECTS__
function array2(item, message$1) {
  return {
    kind: "schema",
    type: "array",
    reference: array2,
    expects: "Array",
    async: false,
    item,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps2(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (Array.isArray(input)) {
        dataset.typed = true;
        dataset.value = [];
        for (let key = 0; key < input.length; key++) {
          const value$1 = input[key];
          const itemDataset = this.item["~run"]({ value: value$1 }, config$1);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value$1
            };
            for (const issue of itemDataset.issues) {
              if (issue.path) issue.path.unshift(pathItem);
              else issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) dataset.issues = itemDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed) dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
      } else _addIssue2(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function boolean2(message$1) {
  return {
    kind: "schema",
    type: "boolean",
    reference: boolean2,
    expects: "boolean",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps2(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "boolean") dataset.typed = true;
      else _addIssue2(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function object2(entries$1, message$1) {
  return {
    kind: "schema",
    type: "object",
    reference: object2,
    expects: "Object",
    async: false,
    entries: entries$1,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps2(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== void 0) {
            const value$1 = key in input ? input[key] : /* @__PURE__ */ getDefault2(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value$1 }, config$1);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value$1
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);
                else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config$1.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0) dataset.value[key] = /* @__PURE__ */ getFallback2(valueSchema);
          else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
            _addIssue2(this, "key", dataset, config$1, {
              input: void 0,
              expected: `"${key}"`,
              path: [{
                type: "object",
                origin: "key",
                input,
                key,
                value: input[key]
              }]
            });
            if (config$1.abortEarly) break;
          }
        }
      } else _addIssue2(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function optional(wrapped, default_) {
  return {
    kind: "schema",
    type: "optional",
    reference: optional,
    expects: `(${wrapped.expects} | undefined)`,
    async: false,
    wrapped,
    default: default_,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps2(this);
    },
    "~run"(dataset, config$1) {
      if (dataset.value === void 0) {
        if (this.default !== void 0) dataset.value = /* @__PURE__ */ getDefault2(this, dataset, config$1);
        if (dataset.value === void 0) {
          dataset.typed = true;
          return dataset;
        }
      }
      return this.wrapped["~run"](dataset, config$1);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function string2(message$1) {
  return {
    kind: "schema",
    type: "string",
    reference: string2,
    expects: "string",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps2(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "string") dataset.typed = true;
      else _addIssue2(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function unknown2() {
  return {
    kind: "schema",
    type: "unknown",
    reference: unknown2,
    expects: "unknown",
    async: false,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps2(this);
    },
    "~run"(dataset) {
      dataset.typed = true;
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function safeParse2(schema, input, config$1) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig2(config$1));
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues
  };
}
var Monitor = class {
  type;
  schema;
  poll;
  webhook;
  constructor(options) {
    this.type = options.type;
    this.schema = options.schema;
  }
  validateSource(source) {
    const result = /* @__PURE__ */ safeParse2(this.schema, source);
    if (result.success) return result.output;
    throw new Error(`invalid ${this.type} monitor source`);
  }
  initialDelivery(source) {
    this.validateSource(source);
    if (this.webhook && this.webhook.preferred && this.webhook.configured()) return "webhook";
    if (this.poll) return "poll";
    if (this.webhook) return "webhook";
    throw new Error(`source ${this.type} has no configured transport`);
  }
  resolveDelivery(monitor) {
    let webhookHealthy = false;
    if (this.webhook) webhookHealthy = this.webhook.isHealthy(monitor);
    if (monitor.delivery === "webhook") {
      if (this.webhook && webhookHealthy) return "webhook";
      if (this.poll) return "poll";
      if (this.webhook) return "webhook";
      return void 0;
    }
    if (this.webhook && webhookHealthy) return "webhook";
    if (this.poll) return "poll";
    if (this.webhook) return "webhook";
    return void 0;
  }
  async tick(context, record2) {
    const fresh = await context.service.get(record2.id);
    if (!fresh || !fresh.enabled) return 0;
    if (this.webhook) await this.webhook.retryPending(context, this, fresh);
    const current = await context.service.get(record2.id);
    if (!current || !current.enabled) return 0;
    const nextDelivery = this.resolveDelivery(current);
    if (!nextDelivery) return 0;
    if (nextDelivery !== current.delivery) {
      await context.service.setDelivery(current.id, nextDelivery);
      current.delivery = nextDelivery;
    }
    if (current.delivery !== "poll" || !this.poll) return 0;
    const lastAttemptAt = Number(current.cursors.__lastAttemptAt ?? current.cursors.__lastPolledAt ?? 0);
    const pollIntervalSec = current.pollIntervalSec || 60;
    if (lastAttemptAt && Date.now() - lastAttemptAt < pollIntervalSec * 1e3) return 0;
    return this.poll.run(context, this, current);
  }
  async deliver(context, record2, event, deliveryId) {
    if (!this.webhook) return 0;
    return this.webhook.deliver(context, this, record2, event, deliveryId);
  }
  unresponsive(record2, now = Date.now()) {
    if (!record2.enabled) return false;
    if (record2.delivery === "poll") {
      if (!this.poll) return true;
      return this.poll.isUnresponsive(record2, now);
    }
    if (!this.webhook) return true;
    return this.webhook.isUnresponsive(record2, now);
  }
};
var RoutedEventCursorSchema = /* @__PURE__ */ array2(/* @__PURE__ */ string2());
function eventDeliveryId(event) {
  if (event.id) return event.id;
  return `${event.kind}:${event.at}:${event.summary}`;
}
var activePolls = /* @__PURE__ */ new Set();
var PollMonitor = class {
  constructor(options) {
    this.options = options;
  }
  async run(context, source, record2) {
    if (activePolls.has(record2.id)) return 0;
    activePolls.add(record2.id);
    try {
      const fresh = await context.service.get(record2.id);
      if (!fresh) return 0;
      const sourceRecord = source.validateSource(fresh.source);
      const cursorKey = source.key(sourceRecord);
      const result = await this.options.run(sourceRecord, fresh.cursors[cursorKey]);
      const current = await context.service.get(record2.id);
      if (!current || !current.enabled) return 0;
      const parsedRoutedIds = /* @__PURE__ */ safeParse2(RoutedEventCursorSchema, fresh.cursors.__routedEventIds);
      let routedIds = [];
      if (parsedRoutedIds.success) routedIds = parsedRoutedIds.output;
      let routeFailed = false;
      for (const event of result.events) {
        const eventId = eventDeliveryId(event);
        if (routedIds.includes(eventId)) continue;
        const routed = await context.sink.deliver({ monitor: fresh, event });
        if (!routed.ok) {
          routeFailed = true;
          console.error(`[sourcefed] route failed for ${fresh.id}: ${routed.error}`);
          continue;
        }
        if (!routedIds.includes(eventId)) routedIds.push(eventId);
      }
      if (routeFailed) {
        await context.service.updateCursor(fresh, "__routedEventIds", routedIds);
        return 0;
      }
      await context.service.updateCursorValue(fresh, cursorKey, (current2) => {
        if (this.options.mergeCursor) return this.options.mergeCursor(current2, result.cursor);
        return result.cursor;
      });
      await context.service.updateCursor(fresh, "__routedEventIds", []);
      if (result.terminal) await context.service.remove(fresh.id);
      await context.service.updateCursor(fresh, "__lastPolledAt", Date.now());
      return result.events.length;
    } finally {
      activePolls.delete(record2.id);
    }
  }
  isUnresponsive(record2, now) {
    const intervalMs = Math.max((record2.pollIntervalSec || 60) * 3e3, 12e4);
    const lastPolledAt = Number(record2.cursors.__lastPolledAt ?? 0);
    if (lastPolledAt > 0) return now - lastPolledAt > intervalMs;
    return now - Date.parse(record2.createdAt) > intervalMs;
  }
};
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function mergeCursors(current, result) {
  if (Array.isArray(current) && Array.isArray(result)) {
    return [.../* @__PURE__ */ new Set([...current, ...result])];
  }
  if (isRecord(current) && isRecord(result)) {
    const merged = { ...current };
    for (const [key, value] of Object.entries(result)) {
      if (value === void 0) continue;
      merged[key] = key in current ? mergeCursors(current[key], value) : value;
    }
    return merged;
  }
  return result === void 0 ? current : result;
}
var WEBHOOK_STALE_MS = 9e4;
var WEBHOOK_STARTUP_GRACE_MS = 12e4;
var PendingWebhookEventSchema = /* @__PURE__ */ object2({
  deliveryId: /* @__PURE__ */ string2(),
  event: /* @__PURE__ */ object2({
    source: /* @__PURE__ */ unknown2(),
    kind: /* @__PURE__ */ string2(),
    id: /* @__PURE__ */ optional(/* @__PURE__ */ string2()),
    at: /* @__PURE__ */ string2(),
    summary: /* @__PURE__ */ string2(),
    body: /* @__PURE__ */ optional(/* @__PURE__ */ string2()),
    actionable: /* @__PURE__ */ boolean2(),
    terminal: /* @__PURE__ */ optional(/* @__PURE__ */ boolean2())
  })
});
var PendingWebhookEventsSchema = /* @__PURE__ */ array2(PendingWebhookEventSchema);
var pendingDeliveries = /* @__PURE__ */ new Set();
var PENDING_WEBHOOK_EVENTS = "__pendingWebhookEvents";
var WebhookMonitor = class {
  path;
  preferred;
  configured;
  verify;
  acknowledgeBeforeDelivery;
  challenge;
  deliveryId;
  eventName;
  parse;
  updateCursor;
  constructor(options) {
    this.path = options.path;
    this.preferred = options.preferred ?? true;
    this.configured = options.configured;
    this.verify = options.verify;
    this.acknowledgeBeforeDelivery = options.acknowledgeBeforeDelivery ?? false;
    this.challenge = options.challenge;
    this.deliveryId = options.deliveryId;
    this.eventName = options.eventName;
    this.parse = options.parse;
    this.updateCursor = options.updateCursor;
  }
  isHealthy(record2) {
    if (!this.preferred || !this.configured()) return false;
    const heartbeatAt = Number(record2.cursors.__webhookHeartbeatAt ?? 0);
    if (heartbeatAt > 0) return Date.now() - heartbeatAt <= WEBHOOK_STALE_MS;
    return Date.now() - Date.parse(record2.createdAt) <= WEBHOOK_STARTUP_GRACE_MS;
  }
  isUnresponsive(record2, now) {
    const heartbeatAt = Number(record2.cursors.__webhookHeartbeatAt ?? 0);
    if (heartbeatAt > 0) return now - heartbeatAt > WEBHOOK_STALE_MS;
    return now - Date.parse(record2.createdAt) > WEBHOOK_STARTUP_GRACE_MS;
  }
  async retryPending(context, source, record2) {
    const fresh = await context.service.get(record2.id);
    if (!fresh || !fresh.enabled) return 0;
    const parsed = /* @__PURE__ */ safeParse2(PendingWebhookEventsSchema, fresh.cursors[PENDING_WEBHOOK_EVENTS]);
    if (!parsed.success) return 0;
    let delivered = 0;
    for (const pending of parsed.output) {
      const current = await context.service.get(record2.id);
      if (!current || !current.enabled) break;
      const cursorKey = `webhook:${pending.deliveryId}`;
      if (current.cursors[cursorKey]) {
        await this.removePending(context, current, pending.deliveryId);
        continue;
      }
      delivered += await this.deliver(context, source, current, pending.event, pending.deliveryId);
    }
    return delivered;
  }
  async addPending(context, monitor, deliveryId, event) {
    await context.service.updateCursorValue(monitor, PENDING_WEBHOOK_EVENTS, (cursor) => {
      const parsed = /* @__PURE__ */ safeParse2(PendingWebhookEventsSchema, cursor);
      let pending = [];
      if (parsed.success) pending = parsed.output;
      if (pending.some((entry) => entry.deliveryId === deliveryId)) return pending;
      pending.push({ deliveryId, event });
      return pending;
    });
  }
  async removePending(context, monitor, deliveryId) {
    await context.service.updateCursorValue(monitor, PENDING_WEBHOOK_EVENTS, (cursor) => {
      const parsed = /* @__PURE__ */ safeParse2(PendingWebhookEventsSchema, cursor);
      if (!parsed.success) return [];
      return parsed.output.filter((entry) => entry.deliveryId !== deliveryId);
    });
  }
  async deliver(context, source, record2, event, deliveryId) {
    const fresh = await context.service.get(record2.id);
    if (!fresh || !fresh.enabled) return 0;
    const freshSource = source.validateSource(fresh.source);
    const eventSource = source.validateSource(event.source);
    if (source.key(freshSource) !== source.key(eventSource)) return 0;
    if (event.kind === "ci" && !event.actionable) return 0;
    const cursorKey = `webhook:${deliveryId}`;
    const reservationKey = `${fresh.id}:${deliveryId}`;
    if (pendingDeliveries.has(reservationKey)) return 0;
    if (fresh.cursors[cursorKey]) {
      await this.removePending(context, fresh, deliveryId);
      return 0;
    }
    pendingDeliveries.add(reservationKey);
    try {
      await this.addPending(context, fresh, deliveryId, event);
      if (this.updateCursor) {
        const sourceCursorKey = source.key(freshSource);
        await context.service.updateCursorValue(fresh, sourceCursorKey, (cursor) => this.updateCursor(event, cursor));
      }
      const result = await context.sink.deliver({ monitor: fresh, event });
      if (!result.ok) {
        console.error(`[sourcefed] webhook route failed for ${fresh.id}: ${result.error}`);
        return 0;
      }
      await context.service.setDelivery(fresh.id, "webhook");
      await context.service.updateCursor(fresh, cursorKey, true);
      await this.removePending(context, fresh, deliveryId);
      if (event.terminal) await context.service.remove(fresh.id);
      return 1;
    } finally {
      pendingDeliveries.delete(reservationKey);
    }
  }
};
var MAX_WEBHOOK_BODY_BYTES2 = 1024 * 1024;
function toMonitorEvent(event, source) {
  return {
    source,
    kind: event.kind,
    id: event.id,
    at: event.at,
    summary: event.summary,
    body: event.body,
    actionable: event.actionable,
    terminal: event.terminal
  };
}
var store$422;
var DEFAULT_CONFIG22 = {
  lang: void 0,
  message: void 0,
  abortEarly: void 0,
  abortPipeEarly: void 0
};
// @__NO_SIDE_EFFECTS__
function getGlobalConfig22(config$1) {
  if (!config$1 && !store$422) return DEFAULT_CONFIG22;
  return {
    lang: config$1?.lang ?? store$422?.lang,
    message: config$1?.message,
    abortEarly: config$1?.abortEarly ?? store$422?.abortEarly,
    abortPipeEarly: config$1?.abortPipeEarly ?? store$422?.abortPipeEarly
  };
}
var store$322;
// @__NO_SIDE_EFFECTS__
function getGlobalMessage22(lang) {
  return store$322?.get(lang);
}
var store$222;
// @__NO_SIDE_EFFECTS__
function getSchemaMessage22(lang) {
  return store$222?.get(lang);
}
var store$122;
// @__NO_SIDE_EFFECTS__
function getSpecificMessage22(reference, lang) {
  return store$122?.get(reference)?.get(lang);
}
// @__NO_SIDE_EFFECTS__
function _stringify22(input) {
  const type = typeof input;
  if (type === "string") return `"${input}"`;
  if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
  if (type === "object" || type === "function") return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  return type;
}
function _addIssue22(context, label, dataset, config$1, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */ _stringify22(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config$1.lang,
    abortEarly: config$1.abortEarly,
    abortPipeEarly: config$1.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message$1 = other?.message ?? context.message ?? /* @__PURE__ */ getSpecificMessage22(context.reference, issue.lang) ?? (isSchema ? /* @__PURE__ */ getSchemaMessage22(issue.lang) : null) ?? config$1.message ?? /* @__PURE__ */ getGlobalMessage22(issue.lang);
  if (message$1 !== void 0) issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
  if (isSchema) dataset.typed = false;
  if (dataset.issues) dataset.issues.push(issue);
  else dataset.issues = [issue];
}
var _standardCache22 = /* @__PURE__ */ new WeakMap();
// @__NO_SIDE_EFFECTS__
function _getStandardProps22(context) {
  let cached = _standardCache22.get(context);
  if (!cached) {
    cached = {
      version: 1,
      vendor: "valibot",
      validate(value$1) {
        return context["~run"]({ value: value$1 }, /* @__PURE__ */ getGlobalConfig22());
      }
    };
    _standardCache22.set(context, cached);
  }
  return cached;
}
var EMOJI_REGEX22 = new RegExp("^(?:[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation}))*)+$", "u");
// @__NO_SIDE_EFFECTS__
function getFallback22(schema, dataset, config$1) {
  return typeof schema.fallback === "function" ? schema.fallback(dataset, config$1) : schema.fallback;
}
// @__NO_SIDE_EFFECTS__
function getDefault22(schema, dataset, config$1) {
  return typeof schema.default === "function" ? schema.default(dataset, config$1) : schema.default;
}
// @__NO_SIDE_EFFECTS__
function array22(item, message$1) {
  return {
    kind: "schema",
    type: "array",
    reference: array22,
    expects: "Array",
    async: false,
    item,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps22(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (Array.isArray(input)) {
        dataset.typed = true;
        dataset.value = [];
        for (let key = 0; key < input.length; key++) {
          const value$1 = input[key];
          const itemDataset = this.item["~run"]({ value: value$1 }, config$1);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value$1
            };
            for (const issue of itemDataset.issues) {
              if (issue.path) issue.path.unshift(pathItem);
              else issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) dataset.issues = itemDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed) dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
      } else _addIssue22(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function boolean22(message$1) {
  return {
    kind: "schema",
    type: "boolean",
    reference: boolean22,
    expects: "boolean",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps22(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "boolean") dataset.typed = true;
      else _addIssue22(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function literal(literal_, message$1) {
  return {
    kind: "schema",
    type: "literal",
    reference: literal,
    expects: /* @__PURE__ */ _stringify22(literal_),
    async: false,
    literal: literal_,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps22(this);
    },
    "~run"(dataset, config$1) {
      if (dataset.value === this.literal) dataset.typed = true;
      else _addIssue22(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function number2(message$1) {
  return {
    kind: "schema",
    type: "number",
    reference: number2,
    expects: "number",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps22(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "number" && !isNaN(dataset.value)) dataset.typed = true;
      else _addIssue22(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function object22(entries$1, message$1) {
  return {
    kind: "schema",
    type: "object",
    reference: object22,
    expects: "Object",
    async: false,
    entries: entries$1,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps22(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== void 0) {
            const value$1 = key in input ? input[key] : /* @__PURE__ */ getDefault22(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value$1 }, config$1);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value$1
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);
                else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config$1.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0) dataset.value[key] = /* @__PURE__ */ getFallback22(valueSchema);
          else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
            _addIssue22(this, "key", dataset, config$1, {
              input: void 0,
              expected: `"${key}"`,
              path: [{
                type: "object",
                origin: "key",
                input,
                key,
                value: input[key]
              }]
            });
            if (config$1.abortEarly) break;
          }
        }
      } else _addIssue22(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function optional2(wrapped, default_) {
  return {
    kind: "schema",
    type: "optional",
    reference: optional2,
    expects: `(${wrapped.expects} | undefined)`,
    async: false,
    wrapped,
    default: default_,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps22(this);
    },
    "~run"(dataset, config$1) {
      if (dataset.value === void 0) {
        if (this.default !== void 0) dataset.value = /* @__PURE__ */ getDefault22(this, dataset, config$1);
        if (dataset.value === void 0) {
          dataset.typed = true;
          return dataset;
        }
      }
      return this.wrapped["~run"](dataset, config$1);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function string22(message$1) {
  return {
    kind: "schema",
    type: "string",
    reference: string22,
    expects: "string",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps22(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "string") dataset.typed = true;
      else _addIssue22(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function safeParse22(schema, input, config$1) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig22(config$1));
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues
  };
}
var GithubSourceSchema = /* @__PURE__ */ object22({
  type: /* @__PURE__ */ literal("github"),
  repo: /* @__PURE__ */ string22(),
  prNumber: /* @__PURE__ */ number2()
});
var GithubCursorSchema = /* @__PURE__ */ object22({
  reviewIds: /* @__PURE__ */ array22(/* @__PURE__ */ string22()),
  commentIds: /* @__PURE__ */ array22(/* @__PURE__ */ string22()),
  historyPrimed: /* @__PURE__ */ optional2(/* @__PURE__ */ boolean22(), false),
  lineCommentsPrimed: /* @__PURE__ */ optional2(/* @__PURE__ */ boolean22(), false),
  conversationCommentsPrimed: /* @__PURE__ */ optional2(/* @__PURE__ */ boolean22(), false),
  ciState: /* @__PURE__ */ string22(),
  ciFailureState: /* @__PURE__ */ optional2(/* @__PURE__ */ string22(), ""),
  mergeable: /* @__PURE__ */ string22(),
  prState: /* @__PURE__ */ string22()
});
function failureRunIds(failed) {
  const runIds = /* @__PURE__ */ new Set();
  for (const check of failed) {
    const details = check.detailsUrl ?? check.targetUrl ?? "";
    const runId = String(details).match(/\/actions\/runs\/(\d+)/)?.[1];
    if (runId) runIds.add(runId);
  }
  return runIds;
}
var ANSI_ESCAPE = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;
var LOG_PREFIX = /^.*?\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z(?:\s+(?:stdout|stderr))?\s*(?:\|\s*)?/;
function cleanCiLog(raw) {
  return raw.replace(/\r/g, "").replace(ANSI_ESCAPE, "").split("\n").map((line) => line.replace(LOG_PREFIX, "").trimEnd()).filter((line) => !/\bis in dev mode\. Not recommended for production!/i.test(line)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
var API = "https://api.github.com";
var GRAPHQL = "https://api.github.com/graphql";
function githubToken() {
  return process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
}
async function githubJson(path22) {
  const token = githubToken();
  if (!token) return void 0;
  try {
    const response = await fetch(`${API}${path22}`, {
      headers: { authorization: `Bearer ${token}`, "user-agent": "sourcefed", accept: "application/vnd.github+json" }
    });
    if (!response.ok) return void 0;
    return await response.json();
  } catch {
    return void 0;
  }
}
async function githubGraphQL(query, variables) {
  const token = githubToken();
  if (!token) return void 0;
  try {
    const response = await fetch(GRAPHQL, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "user-agent": "sourcefed", "content-type": "application/json" },
      body: JSON.stringify({ query, variables })
    });
    const body = await response.json();
    if (!response.ok || body.errors) return void 0;
    return body.data;
  } catch {
    return void 0;
  }
}
var MAX_COMMENT_PAGES = 10;
async function fetchGithubComments(path22) {
  const comments = [];
  for (let page = 1; page <= MAX_COMMENT_PAGES; page++) {
    const batch = await githubJson(`/${path22}?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) return void 0;
    comments.push(...batch);
    if (batch.length < 100) return comments;
  }
  return comments;
}
var API2 = "https://api.github.com";
var MAX_LOG_BYTES = 1e7;
var MAX_ENTRY_BYTES = 5e6;
var MAX_TOTAL_BYTES = 5e7;
async function fetchRunLog(repo, runId) {
  const token = githubToken();
  if (!token) return void 0;
  try {
    const response = await fetch(`${API2}/repos/${repo}/actions/runs/${runId}/logs`, {
      headers: { authorization: `Bearer ${token}`, "user-agent": "sourcefed", accept: "application/vnd.github+json" }
    });
    if (!response.ok || !response.body) return void 0;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_LOG_BYTES) return void 0;
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_LOG_BYTES) return void 0;
      chunks.push(value);
    }
    const buffer = concatChunks(chunks);
    const entries = extractZipEntries(buffer);
    return entries.map((entry) => new TextDecoder().decode(entry.content)).join("\n");
  } catch {
    return void 0;
  }
}
function concatChunks(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
function extractZipEntries(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let end = -1;
  const scanStart = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= scanStart; offset--) {
    if (view.getUint32(offset, true) === 101010256) {
      end = offset;
      break;
    }
  }
  if (end < 0) return [];
  const entryCount = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const entries = [];
  let totalBytes = 0;
  for (let index = 0; index < entryCount; index++) {
    if (view.getUint32(cursor, true) !== 33639248) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(buffer.slice(cursor + 46, cursor + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    let content;
    if (method === 8) {
      const declaredSize = view.getUint32(localOffset + 22, true);
      if (declaredSize > MAX_ENTRY_BYTES) {
        cursor += 46 + nameLength + extraLength + commentLength;
        continue;
      }
      try {
        content = inflateRawSync(compressed);
      } catch {
        content = compressed;
      }
    } else {
      content = compressed;
    }
    totalBytes += content.length;
    if (totalBytes > MAX_TOTAL_BYTES) break;
    entries.push({ name, content });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
var PR_DATA_QUERY = `
query PullRequestData($owner: String!, $name: String!, $number: Int!, $reviewsAfter: String, $contextsAfter: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      state
      mergeable
      mergeStateStatus
      reviews(first: 100, after: $reviewsAfter) {
        nodes {
          databaseId
          author { login }
          state
          submittedAt
          body
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
      statusCheckRollup {
        contexts(first: 100, after: $contextsAfter) {
          nodes {
            ... on StatusContext {
              context
              state
              targetUrl
            }
            ... on CheckRun {
              name
              conclusion
              detailsUrl
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
}`;
var MAX_REVIEW_PAGES = 300;
async function fetchPrData(repo, prNumber) {
  const [owner, name] = repo.split("/");
  if (!owner || !name) return void 0;
  const data = await githubGraphQL(PR_DATA_QUERY, { owner, name, number: prNumber, reviewsAfter: void 0, contextsAfter: void 0 });
  const pullRequest = data?.repository?.pullRequest;
  if (!pullRequest) return void 0;
  const reviews = [];
  let page = pullRequest.reviews;
  while (page?.nodes && page.nodes.length > 0) {
    reviews.push(...page.nodes.map((node) => ({
      id: node.databaseId,
      author: node.author,
      state: node.state,
      submittedAt: node.submittedAt,
      body: node.body
    })));
    if (!page.pageInfo?.hasNextPage || reviews.length >= MAX_REVIEW_PAGES) break;
    const next = await githubGraphQL(PR_DATA_QUERY, { owner, name, number: prNumber, reviewsAfter: page.pageInfo.endCursor, contextsAfter: void 0 });
    page = next?.repository?.pullRequest?.reviews;
  }
  const statusCheckRollup = [];
  let contextsPage = pullRequest.statusCheckRollup?.contexts;
  while (contextsPage?.nodes && contextsPage.nodes.length > 0) {
    statusCheckRollup.push(...contextsPage.nodes);
    if (!contextsPage.pageInfo?.hasNextPage) break;
    const next = await githubGraphQL(PR_DATA_QUERY, { owner, name, number: prNumber, reviewsAfter: void 0, contextsAfter: contextsPage.pageInfo.endCursor });
    contextsPage = next?.repository?.pullRequest?.statusCheckRollup?.contexts;
  }
  return {
    reviews,
    statusCheckRollup,
    mergeable: pullRequest.mergeable,
    mergeStateStatus: pullRequest.mergeStateStatus,
    state: pullRequest.state
  };
}
async function failureRunLog(repo, runId) {
  const log = await fetchRunLog(repo, runId);
  if (!log || !log.trim()) return void 0;
  const tail = cleanCiLog(log).split("\n").slice(-60).join("\n");
  return `
### Failing log (run ${runId})
\`\`\`
${tail}
\`\`\``;
}
function formatFailedCheck(check) {
  let name = check.name;
  if (!name) name = check.context;
  if (!name) name = "check";
  let conclusion = check.conclusion;
  if (!conclusion) conclusion = check.state;
  if (!conclusion) conclusion = "FAILURE";
  return `- ${name}: ${conclusion}`;
}
async function ciFailureDetail(repo, failed) {
  const lines = failed.map(formatFailedCheck);
  const runIds = failureRunIds(failed);
  for (const runId of [...runIds].slice(0, 3)) {
    const log = await failureRunLog(repo, runId);
    if (log) lines.push(log);
  }
  return lines.join("\n");
}
async function confirmStillFailing(repo, prNumber, failed) {
  const data = await fetchPrData(repo, prNumber);
  if (!data) return failed;
  const rollup = data.statusCheckRollup ?? [];
  const current = /* @__PURE__ */ new Map();
  for (const check of rollup) {
    let name = check.name;
    if (!name) name = check.context;
    if (!name) name = "check";
    let state = check.conclusion;
    if (!state) state = check.state;
    if (!state) state = "PENDING";
    current.set(name, String(state).toUpperCase());
  }
  return failed.filter((check) => {
    let name = check.name;
    if (!name) name = check.context;
    if (!name) name = "check";
    const state = current.get(name);
    if (state === void 0) return false;
    return /FAIL|ERROR|CANCEL/i.test(state);
  });
}
async function appendGithubCiEvent(repo, prNumber, cursor, events, rollup) {
  const ciState = rollup.map((check) => check.conclusion ?? check.state ?? "PENDING").sort().join(",");
  if (!ciState || ciState === cursor.ciState) return;
  const previousCiState = cursor.ciState;
  cursor.ciState = ciState;
  if (previousCiState === void 0) return;
  let failed = rollup.filter((check) => /FAIL|ERROR|CANCEL/i.test(check.conclusion ?? ""));
  failed = await confirmStillFailing(repo, prNumber, failed);
  const failureState = failed.map((check) => `${check.name ?? check.context ?? "check"}:${check.conclusion ?? check.state ?? "FAILURE"}`).sort().join(",");
  if (failed.length > 0 && failureState !== cursor.ciFailureState) {
    const names = failed.map((check) => check.name ?? check.context ?? "check").join(", ");
    events.push({
      kind: "ci",
      id: `ci:${failureState}`,
      repo,
      prNumber,
      at: (/* @__PURE__ */ new Date()).toISOString(),
      summary: `CI failed on #${prNumber}: ${names}`,
      body: await ciFailureDetail(repo, failed),
      actionable: true
    });
  }
  cursor.ciFailureState = failureState;
}
function appendGithubConflictEvent(repo, prNumber, cursor, events, mergeable) {
  if (mergeable === cursor.mergeable) return;
  const previousMergeable = cursor.mergeable;
  cursor.mergeable = mergeable;
  if (previousMergeable === void 0) return;
  if (mergeable !== "CONFLICTING" && mergeable !== "DIRTY") return;
  events.push({
    kind: "conflict",
    id: `conflict:${mergeable}`,
    repo,
    prNumber,
    at: (/* @__PURE__ */ new Date()).toISOString(),
    summary: `PR #${prNumber} now has merge conflicts with its base (${mergeable})`,
    actionable: true
  });
}
function appendGithubReviews(repo, prNumber, cursor, events, reviews, historyPrimed) {
  const ref = `#${prNumber}`;
  for (const review of reviews) {
    const id2 = "rev:" + String(review.id ?? `${review.author?.login}-${review.submittedAt}`);
    if (cursor.reviewIds.includes(id2)) continue;
    cursor.reviewIds.push(id2);
    if (review.state === "PENDING" || !historyPrimed) continue;
    if (!review.body?.trim()) continue;
    let actionable = false;
    if (review.state === "CHANGES_REQUESTED") actionable = true;
    if (review.state === "COMMENTED" && review.body?.trim()) actionable = true;
    events.push({
      kind: "review",
      id: id2,
      repo,
      prNumber,
      at: review.submittedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
      summary: `Review by ${review.author?.login ?? "someone"} [${review.state}] on ${ref}`,
      body: review.body,
      actionable
    });
  }
}
function appendGithubStateEvent(repo, prNumber, cursor, events, prState) {
  const isTerminal = prState === "MERGED" || prState === "CLOSED";
  if (prState === cursor.prState) return isTerminal;
  const previousPrState = cursor.prState;
  cursor.prState = prState;
  if (previousPrState !== void 0 && isTerminal) {
    let summary = `PR #${prNumber} was CLOSED without merging`;
    if (prState === "MERGED") summary = `PR #${prNumber} was MERGED`;
    events.push({
      kind: "merged",
      id: `state:${prState}`,
      repo,
      prNumber,
      at: (/* @__PURE__ */ new Date()).toISOString(),
      summary,
      actionable: prState === "MERGED",
      terminal: isTerminal
    });
  }
  return isTerminal;
}
function appendComments(repo, prNumber, cursor, events, comments, idPrefix, historyPrimed, summary, body) {
  for (const comment of comments) {
    const id2 = idPrefix + String(comment.id);
    if (cursor.commentIds.includes(id2)) continue;
    cursor.commentIds.push(id2);
    if (!historyPrimed) continue;
    const text = body(comment);
    events.push({
      kind: "comment",
      id: id2,
      repo,
      prNumber,
      at: comment.created_at ?? (/* @__PURE__ */ new Date()).toISOString(),
      summary: summary(comment),
      body: text,
      actionable: Boolean(text.trim())
    });
  }
}
function emptyGithubCursor() {
  return {
    reviewIds: [],
    commentIds: [],
    historyPrimed: false,
    lineCommentsPrimed: false,
    conversationCommentsPrimed: false,
    ciState: "",
    ciFailureState: "",
    mergeable: "",
    prState: ""
  };
}
var warnedMissingToken = false;
async function pollGithub(repo, prNumber, cursorRaw) {
  const parsedCursor = /* @__PURE__ */ safeParse22(GithubCursorSchema, cursorRaw);
  let cursor = emptyGithubCursor();
  if (parsedCursor.success) cursor = parsedCursor.output;
  const events = [];
  const ref = `#${prNumber}`;
  if (!githubToken()) {
    if (!warnedMissingToken) {
      warnedMissingToken = true;
      console.warn("[sourcefed] GH_TOKEN or GITHUB_TOKEN is not set; GitHub monitors will not poll");
    }
    return { events, cursor, terminal: false };
  }
  const data = await fetchPrData(repo, prNumber);
  if (!data) return { events, cursor, terminal: false };
  let historyPrimed = cursor.historyPrimed;
  if (!historyPrimed) historyPrimed = Boolean(cursor.reviewIds.length || cursor.commentIds.length || cursor.ciState || cursor.mergeable || cursor.prState);
  const lineCommentsPrimed = cursor.lineCommentsPrimed;
  const conversationCommentsPrimed = cursor.conversationCommentsPrimed;
  appendGithubReviews(repo, prNumber, cursor, events, data.reviews ?? [], historyPrimed);
  if (!cursor.historyPrimed) cursor.historyPrimed = true;
  const lineComments = await fetchGithubComments(`repos/${repo}/pulls/${prNumber}/comments`);
  if (lineComments) {
    appendComments(
      repo,
      prNumber,
      cursor,
      events,
      lineComments,
      "c:",
      lineCommentsPrimed,
      (comment) => `Comment by ${comment.user?.login ?? "someone"} on ${comment.path ?? ref}`,
      (comment) => {
        let location = comment.path ?? "";
        if (comment.line) location += `:${comment.line}`;
        return `${location} \u2014 ${comment.body ?? ""}`;
      }
    );
    cursor.lineCommentsPrimed = true;
  }
  const conversationComments = await fetchGithubComments(`repos/${repo}/issues/${prNumber}/comments`);
  if (conversationComments) {
    appendComments(
      repo,
      prNumber,
      cursor,
      events,
      conversationComments,
      "issue:",
      conversationCommentsPrimed,
      (comment) => `Comment by ${comment.user?.login ?? "someone"} on ${ref}`,
      (comment) => comment.body ?? ""
    );
    cursor.conversationCommentsPrimed = true;
  }
  await appendGithubCiEvent(repo, prNumber, cursor, events, data.statusCheckRollup ?? []);
  const mergeable = data.mergeable ?? data.mergeStateStatus ?? "UNKNOWN";
  appendGithubConflictEvent(repo, prNumber, cursor, events, mergeable);
  const prState = data.state ?? "OPEN";
  const terminal = appendGithubStateEvent(repo, prNumber, cursor, events, prState);
  return { events, cursor, terminal };
}
var githubPollMonitor = new PollMonitor({
  run: async (source, cursor) => {
    const result = await pollGithub(source.repo, source.prNumber, cursor);
    return {
      cursor: result.cursor,
      events: result.events.map((event) => toMonitorEvent(event, source)),
      terminal: result.terminal
    };
  },
  mergeCursor: mergeCursors
});
function updateGithubCursor(event, cursorRaw) {
  const parsed = /* @__PURE__ */ safeParse22(GithubCursorSchema, cursorRaw);
  let cursor = emptyGithubCursor();
  if (parsed.success) cursor = parsed.output;
  if (event.id?.startsWith("review:")) {
    const id2 = `rev:${event.id.slice("review:".length)}`;
    if (!cursor.reviewIds.includes(id2)) cursor.reviewIds.push(id2);
  }
  if (event.id?.startsWith("c:") || event.id?.startsWith("issue:")) {
    if (!cursor.commentIds.includes(event.id)) cursor.commentIds.push(event.id);
  }
  if (event.kind === "merged") cursor.prState = "MERGED";
  if (event.kind === "closed") cursor.prState = "CLOSED";
  if (event.kind === "conflict") cursor.mergeable = "CONFLICTING";
  return cursor;
}
function fallbackGithubEvent({ payload, actor, repo, prNumber, eventName }) {
  return {
    kind: eventName,
    summary: `GitHub ${eventName} ${payload.action ?? "changed"} by ${actor} on ${repo}#${prNumber}`,
    actionable: true
  };
}
function parseCheckRun({ payload, repo, prNumber }) {
  const conclusion = payload.check_run?.conclusion ?? payload.check_run?.status ?? "changed";
  return {
    kind: "ci",
    summary: `GitHub CI ${conclusion} on ${repo}#${prNumber}`,
    body: payload.check_run?.output?.text ?? payload.check_run?.name,
    actionable: /FAIL|ERROR|CANCEL/i.test(String(conclusion))
  };
}
function parseCheckSuite({ payload, repo, prNumber }) {
  const conclusion = payload.check_suite?.conclusion ?? payload.check_suite?.status ?? "changed";
  return {
    kind: "ci",
    summary: `GitHub CI ${conclusion} on ${repo}#${prNumber}`,
    body: payload.check_suite?.latest_check_runs?.map((check) => check.name).join(", "),
    actionable: /FAIL|ERROR|CANCEL/i.test(String(conclusion))
  };
}
function parseGithubComment({ payload, actor, repo, prNumber, eventName }) {
  return {
    kind: "comment",
    id: payload.comment?.id === void 0 ? void 0 : `${eventName === "issue_comment" ? "issue:" : "c:"}${payload.comment.id}`,
    summary: `GitHub comment by ${actor} on ${repo}#${prNumber}`,
    body: payload.comment?.body,
    actionable: true
  };
}
function parsePullRequest({ payload, repo, prNumber }) {
  const merged = payload.action === "closed" && payload.pull_request?.merged === true;
  let kind = payload.action ?? "changed";
  if (payload.action === "synchronize") kind = "commit";
  if (merged) kind = "merged";
  let summary = `GitHub PR ${payload.action ?? "changed"}`;
  if (merged) summary += " and merged";
  summary += ` on ${repo}#${prNumber}`;
  let body = payload.pull_request?.body;
  if (merged) body = void 0;
  let id2;
  if (merged) id2 = "pr:MERGED";
  if (payload.action === "closed" && !merged) id2 = "pr:CLOSED";
  return { kind, id: id2, summary, body, actionable: true };
}
function parsePullRequestReview({ payload, actor, repo, prNumber }) {
  let actionable = false;
  if (["changes_requested", "commented"].includes(String(payload.review?.state ?? "").toLowerCase())) actionable = true;
  return {
    kind: "review",
    id: payload.review?.id === void 0 ? void 0 : `review:${payload.review.id}`,
    summary: `GitHub review ${payload.action ?? "changed"} by ${actor} on ${repo}#${prNumber}`,
    body: payload.review?.body,
    actionable
  };
}
var githubEventHandlers = {
  pull_request_review: parsePullRequestReview,
  pull_request_review_comment: parseGithubComment,
  issue_comment: parseGithubComment,
  check_run: parseCheckRun,
  check_suite: parseCheckSuite,
  pull_request: parsePullRequest
};
function githubPullRequestNumber(payload, eventName) {
  let value = payload.pull_request?.number;
  if (value === void 0) value = payload.issue?.number;
  if (value === void 0 && eventName === "check_run") value = payload.check_run?.pull_requests?.[0]?.number;
  if (value === void 0 && eventName === "check_suite") value = payload.check_suite?.pull_requests?.[0]?.number;
  if (value === void 0) return void 0;
  const number22 = Number(value);
  if (!Number.isInteger(number22)) return void 0;
  return number22;
}
function parseGithubWebhook(payload, eventName, _deliveryId) {
  const repo = payload.repository?.full_name;
  const prNumber = githubPullRequestNumber(payload, eventName);
  if (!repo || prNumber === void 0) return void 0;
  if (eventName === "pull_request" && payload.action === "edited") return void 0;
  const handler = githubEventHandlers[eventName] ?? fallbackGithubEvent;
  const actor = payload.sender?.login ?? payload.review?.user?.login ?? "someone";
  const shape = handler({ payload, actor, repo, prNumber, eventName });
  if (eventName === "pull_request_review" && !shape.body?.trim()) return void 0;
  let body = shape.body;
  if (shape.kind === "merged") body = "";
  const event = {
    source: { type: "github", repo, prNumber },
    kind: shape.kind,
    id: shape.id,
    at: payload.repository?.updated_at ?? (/* @__PURE__ */ new Date()).toISOString(),
    summary: shape.summary,
    body: body || void 0,
    actionable: shape.actionable,
    terminal: shape.kind === "merged" || shape.kind === "closed"
  };
  return event;
}
function verifyHmac(body, signature, secret) {
  if (!secret || !signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
function verifyGithubWebhook(body, request) {
  return verifyHmac(body, request.headers.get("x-hub-signature-256"), process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET);
}
var githubWebhookMonitor = new WebhookMonitor({
  path: "/webhooks/github",
  preferred: true,
  configured: () => Boolean(process.env.SOURCEFED_GITHUB_WEBHOOK_SECRET),
  verify: verifyGithubWebhook,
  deliveryId: (request) => request.headers.get("x-github-delivery") ?? void 0,
  eventName: (request) => request.headers.get("x-github-event") ?? "github",
  parse: parseGithubWebhook,
  updateCursor: updateGithubCursor
});
var GithubMonitor = class extends Monitor {
  poll = githubPollMonitor;
  webhook = githubWebhookMonitor;
  constructor() {
    super({ type: "github", schema: GithubSourceSchema });
  }
  key = (source) => `github:${source.repo}#${source.prNumber}`;
  icon = "\u{F02A4}";
  label = (source) => `#${source.prNumber}`;
  detail = (source) => ` ${source.repo}#${source.prNumber}`;
  describe = (source) => `GitHub ${source.repo}#${source.prNumber}`;
  build(input) {
    if (input.repo && input.prNumber) return { type: "github", repo: input.repo, prNumber: input.prNumber };
    return { error: "repo and prNumber are required for a github monitor" };
  }
};
var store$43;
var DEFAULT_CONFIG3 = {
  lang: void 0,
  message: void 0,
  abortEarly: void 0,
  abortPipeEarly: void 0
};
// @__NO_SIDE_EFFECTS__
function getGlobalConfig3(config$1) {
  if (!config$1 && !store$43) return DEFAULT_CONFIG3;
  return {
    lang: config$1?.lang ?? store$43?.lang,
    message: config$1?.message,
    abortEarly: config$1?.abortEarly ?? store$43?.abortEarly,
    abortPipeEarly: config$1?.abortPipeEarly ?? store$43?.abortPipeEarly
  };
}
var store$33;
// @__NO_SIDE_EFFECTS__
function getGlobalMessage3(lang) {
  return store$33?.get(lang);
}
var store$23;
// @__NO_SIDE_EFFECTS__
function getSchemaMessage3(lang) {
  return store$23?.get(lang);
}
var store$13;
// @__NO_SIDE_EFFECTS__
function getSpecificMessage3(reference, lang) {
  return store$13?.get(reference)?.get(lang);
}
// @__NO_SIDE_EFFECTS__
function _stringify3(input) {
  const type = typeof input;
  if (type === "string") return `"${input}"`;
  if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
  if (type === "object" || type === "function") return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  return type;
}
function _addIssue3(context, label, dataset, config$1, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */ _stringify3(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config$1.lang,
    abortEarly: config$1.abortEarly,
    abortPipeEarly: config$1.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message$1 = other?.message ?? context.message ?? /* @__PURE__ */ getSpecificMessage3(context.reference, issue.lang) ?? (isSchema ? /* @__PURE__ */ getSchemaMessage3(issue.lang) : null) ?? config$1.message ?? /* @__PURE__ */ getGlobalMessage3(issue.lang);
  if (message$1 !== void 0) issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
  if (isSchema) dataset.typed = false;
  if (dataset.issues) dataset.issues.push(issue);
  else dataset.issues = [issue];
}
var _standardCache3 = /* @__PURE__ */ new WeakMap();
// @__NO_SIDE_EFFECTS__
function _getStandardProps3(context) {
  let cached = _standardCache3.get(context);
  if (!cached) {
    cached = {
      version: 1,
      vendor: "valibot",
      validate(value$1) {
        return context["~run"]({ value: value$1 }, /* @__PURE__ */ getGlobalConfig3());
      }
    };
    _standardCache3.set(context, cached);
  }
  return cached;
}
var EMOJI_REGEX3 = new RegExp("^(?:[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation}))*)+$", "u");
// @__NO_SIDE_EFFECTS__
function array3(item, message$1) {
  return {
    kind: "schema",
    type: "array",
    reference: array3,
    expects: "Array",
    async: false,
    item,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps3(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (Array.isArray(input)) {
        dataset.typed = true;
        dataset.value = [];
        for (let key = 0; key < input.length; key++) {
          const value$1 = input[key];
          const itemDataset = this.item["~run"]({ value: value$1 }, config$1);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value$1
            };
            for (const issue of itemDataset.issues) {
              if (issue.path) issue.path.unshift(pathItem);
              else issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) dataset.issues = itemDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed) dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
      } else _addIssue3(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function string3(message$1) {
  return {
    kind: "schema",
    type: "string",
    reference: string3,
    expects: "string",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps3(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "string") dataset.typed = true;
      else _addIssue3(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function safeParse3(schema, input, config$1) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig3(config$1));
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues
  };
}
var Monitor2 = class {
  type;
  schema;
  poll;
  webhook;
  constructor(options) {
    this.type = options.type;
    this.schema = options.schema;
  }
  validateSource(source) {
    const result = /* @__PURE__ */ safeParse3(this.schema, source);
    if (result.success) return result.output;
    throw new Error(`invalid ${this.type} monitor source`);
  }
  initialDelivery(source) {
    this.validateSource(source);
    if (this.webhook && this.webhook.preferred && this.webhook.configured()) return "webhook";
    if (this.poll) return "poll";
    if (this.webhook) return "webhook";
    throw new Error(`source ${this.type} has no configured transport`);
  }
  resolveDelivery(monitor) {
    let webhookHealthy = false;
    if (this.webhook) webhookHealthy = this.webhook.isHealthy(monitor);
    if (monitor.delivery === "webhook") {
      if (this.webhook && webhookHealthy) return "webhook";
      if (this.poll) return "poll";
      if (this.webhook) return "webhook";
      return void 0;
    }
    if (this.webhook && webhookHealthy) return "webhook";
    if (this.poll) return "poll";
    if (this.webhook) return "webhook";
    return void 0;
  }
  async tick(context, record2) {
    const fresh = await context.service.get(record2.id);
    if (!fresh || !fresh.enabled) return 0;
    if (this.webhook) await this.webhook.retryPending(context, this, fresh);
    const current = await context.service.get(record2.id);
    if (!current || !current.enabled) return 0;
    const nextDelivery = this.resolveDelivery(current);
    if (!nextDelivery) return 0;
    if (nextDelivery !== current.delivery) {
      await context.service.setDelivery(current.id, nextDelivery);
      current.delivery = nextDelivery;
    }
    if (current.delivery !== "poll" || !this.poll) return 0;
    const lastAttemptAt = Number(current.cursors.__lastAttemptAt ?? current.cursors.__lastPolledAt ?? 0);
    const pollIntervalSec = current.pollIntervalSec || 60;
    if (lastAttemptAt && Date.now() - lastAttemptAt < pollIntervalSec * 1e3) return 0;
    return this.poll.run(context, this, current);
  }
  async deliver(context, record2, event, deliveryId) {
    if (!this.webhook) return 0;
    return this.webhook.deliver(context, this, record2, event, deliveryId);
  }
  unresponsive(record2, now = Date.now()) {
    if (!record2.enabled) return false;
    if (record2.delivery === "poll") {
      if (!this.poll) return true;
      return this.poll.isUnresponsive(record2, now);
    }
    if (!this.webhook) return true;
    return this.webhook.isUnresponsive(record2, now);
  }
};
var RoutedEventCursorSchema2 = /* @__PURE__ */ array3(/* @__PURE__ */ string3());
function eventDeliveryId2(event) {
  if (event.id) return event.id;
  return `${event.kind}:${event.at}:${event.summary}`;
}
var activePolls2 = /* @__PURE__ */ new Set();
var PollMonitor2 = class {
  constructor(options) {
    this.options = options;
  }
  async run(context, source, record2) {
    if (activePolls2.has(record2.id)) return 0;
    activePolls2.add(record2.id);
    try {
      const fresh = await context.service.get(record2.id);
      if (!fresh) return 0;
      const sourceRecord = source.validateSource(fresh.source);
      const cursorKey = source.key(sourceRecord);
      const result = await this.options.run(sourceRecord, fresh.cursors[cursorKey]);
      const current = await context.service.get(record2.id);
      if (!current || !current.enabled) return 0;
      const parsedRoutedIds = /* @__PURE__ */ safeParse3(RoutedEventCursorSchema2, fresh.cursors.__routedEventIds);
      let routedIds = [];
      if (parsedRoutedIds.success) routedIds = parsedRoutedIds.output;
      let routeFailed = false;
      for (const event of result.events) {
        const eventId = eventDeliveryId2(event);
        if (routedIds.includes(eventId)) continue;
        const routed = await context.sink.deliver({ monitor: fresh, event });
        if (!routed.ok) {
          routeFailed = true;
          console.error(`[sourcefed] route failed for ${fresh.id}: ${routed.error}`);
          continue;
        }
        if (!routedIds.includes(eventId)) routedIds.push(eventId);
      }
      if (routeFailed) {
        await context.service.updateCursor(fresh, "__routedEventIds", routedIds);
        return 0;
      }
      await context.service.updateCursorValue(fresh, cursorKey, (current2) => {
        if (this.options.mergeCursor) return this.options.mergeCursor(current2, result.cursor);
        return result.cursor;
      });
      await context.service.updateCursor(fresh, "__routedEventIds", []);
      if (result.terminal) await context.service.remove(fresh.id);
      await context.service.updateCursor(fresh, "__lastPolledAt", Date.now());
      return result.events.length;
    } finally {
      activePolls2.delete(record2.id);
    }
  }
  isUnresponsive(record2, now) {
    const intervalMs = Math.max((record2.pollIntervalSec || 60) * 3e3, 12e4);
    const lastPolledAt = Number(record2.cursors.__lastPolledAt ?? 0);
    if (lastPolledAt > 0) return now - lastPolledAt > intervalMs;
    return now - Date.parse(record2.createdAt) > intervalMs;
  }
};
var MAX_WEBHOOK_BODY_BYTES3 = 1024 * 1024;
function toMonitorEvent2(event, source) {
  return {
    source,
    kind: event.kind,
    id: event.id,
    at: event.at,
    summary: event.summary,
    body: event.body,
    actionable: event.actionable,
    terminal: event.terminal
  };
}
var store$423;
var DEFAULT_CONFIG23 = {
  lang: void 0,
  message: void 0,
  abortEarly: void 0,
  abortPipeEarly: void 0
};
// @__NO_SIDE_EFFECTS__
function getGlobalConfig23(config$1) {
  if (!config$1 && !store$423) return DEFAULT_CONFIG23;
  return {
    lang: config$1?.lang ?? store$423?.lang,
    message: config$1?.message,
    abortEarly: config$1?.abortEarly ?? store$423?.abortEarly,
    abortPipeEarly: config$1?.abortPipeEarly ?? store$423?.abortPipeEarly
  };
}
var store$323;
// @__NO_SIDE_EFFECTS__
function getGlobalMessage23(lang) {
  return store$323?.get(lang);
}
var store$223;
// @__NO_SIDE_EFFECTS__
function getSchemaMessage23(lang) {
  return store$223?.get(lang);
}
var store$123;
// @__NO_SIDE_EFFECTS__
function getSpecificMessage23(reference, lang) {
  return store$123?.get(reference)?.get(lang);
}
// @__NO_SIDE_EFFECTS__
function _stringify23(input) {
  const type = typeof input;
  if (type === "string") return `"${input}"`;
  if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
  if (type === "object" || type === "function") return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  return type;
}
function _addIssue23(context, label, dataset, config$1, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */ _stringify23(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config$1.lang,
    abortEarly: config$1.abortEarly,
    abortPipeEarly: config$1.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message$1 = other?.message ?? context.message ?? /* @__PURE__ */ getSpecificMessage23(context.reference, issue.lang) ?? (isSchema ? /* @__PURE__ */ getSchemaMessage23(issue.lang) : null) ?? config$1.message ?? /* @__PURE__ */ getGlobalMessage23(issue.lang);
  if (message$1 !== void 0) issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
  if (isSchema) dataset.typed = false;
  if (dataset.issues) dataset.issues.push(issue);
  else dataset.issues = [issue];
}
var _standardCache23 = /* @__PURE__ */ new WeakMap();
// @__NO_SIDE_EFFECTS__
function _getStandardProps23(context) {
  let cached = _standardCache23.get(context);
  if (!cached) {
    cached = {
      version: 1,
      vendor: "valibot",
      validate(value$1) {
        return context["~run"]({ value: value$1 }, /* @__PURE__ */ getGlobalConfig23());
      }
    };
    _standardCache23.set(context, cached);
  }
  return cached;
}
var EMOJI_REGEX23 = new RegExp("^(?:[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation}))*)+$", "u");
// @__NO_SIDE_EFFECTS__
function getFallback3(schema, dataset, config$1) {
  return typeof schema.fallback === "function" ? schema.fallback(dataset, config$1) : schema.fallback;
}
// @__NO_SIDE_EFFECTS__
function getDefault3(schema, dataset, config$1) {
  return typeof schema.default === "function" ? schema.default(dataset, config$1) : schema.default;
}
// @__NO_SIDE_EFFECTS__
function array23(item, message$1) {
  return {
    kind: "schema",
    type: "array",
    reference: array23,
    expects: "Array",
    async: false,
    item,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps23(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (Array.isArray(input)) {
        dataset.typed = true;
        dataset.value = [];
        for (let key = 0; key < input.length; key++) {
          const value$1 = input[key];
          const itemDataset = this.item["~run"]({ value: value$1 }, config$1);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value$1
            };
            for (const issue of itemDataset.issues) {
              if (issue.path) issue.path.unshift(pathItem);
              else issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) dataset.issues = itemDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed) dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
      } else _addIssue23(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function literal2(literal_, message$1) {
  return {
    kind: "schema",
    type: "literal",
    reference: literal2,
    expects: /* @__PURE__ */ _stringify23(literal_),
    async: false,
    literal: literal_,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps23(this);
    },
    "~run"(dataset, config$1) {
      if (dataset.value === this.literal) dataset.typed = true;
      else _addIssue23(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function number3(message$1) {
  return {
    kind: "schema",
    type: "number",
    reference: number3,
    expects: "number",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps23(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "number" && !isNaN(dataset.value)) dataset.typed = true;
      else _addIssue23(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function object3(entries$1, message$1) {
  return {
    kind: "schema",
    type: "object",
    reference: object3,
    expects: "Object",
    async: false,
    entries: entries$1,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps23(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== void 0) {
            const value$1 = key in input ? input[key] : /* @__PURE__ */ getDefault3(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value$1 }, config$1);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value$1
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);
                else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config$1.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0) dataset.value[key] = /* @__PURE__ */ getFallback3(valueSchema);
          else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
            _addIssue23(this, "key", dataset, config$1, {
              input: void 0,
              expected: `"${key}"`,
              path: [{
                type: "object",
                origin: "key",
                input,
                key,
                value: input[key]
              }]
            });
            if (config$1.abortEarly) break;
          }
        }
      } else _addIssue23(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function optional3(wrapped, default_) {
  return {
    kind: "schema",
    type: "optional",
    reference: optional3,
    expects: `(${wrapped.expects} | undefined)`,
    async: false,
    wrapped,
    default: default_,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps23(this);
    },
    "~run"(dataset, config$1) {
      if (dataset.value === void 0) {
        if (this.default !== void 0) dataset.value = /* @__PURE__ */ getDefault3(this, dataset, config$1);
        if (dataset.value === void 0) {
          dataset.typed = true;
          return dataset;
        }
      }
      return this.wrapped["~run"](dataset, config$1);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function string23(message$1) {
  return {
    kind: "schema",
    type: "string",
    reference: string23,
    expects: "string",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps23(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "string") dataset.typed = true;
      else _addIssue23(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function safeParse23(schema, input, config$1) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig23(config$1));
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues
  };
}
var JiraSourceSchema = /* @__PURE__ */ object3({
  type: /* @__PURE__ */ literal2("jira"),
  issueKey: /* @__PURE__ */ string23()
});
var JiraCursorSchema = /* @__PURE__ */ object3({
  commentIds: /* @__PURE__ */ array23(/* @__PURE__ */ number3()),
  descriptionVersion: /* @__PURE__ */ optional3(/* @__PURE__ */ string23()),
  changelogCount: /* @__PURE__ */ number3()
});
function jiraChangeValue(item, side) {
  let value = item.toString ?? item.to;
  if (side === "from") value = item.fromString ?? item.from;
  if (value === void 0 || value === null || value === "") return "none";
  return String(value);
}
function formatJiraChangelogItem(item) {
  return `${item.field}: ${jiraChangeValue(item, "from")} \u2192 ${jiraChangeValue(item, "to")}`;
}
function isTerminalStatus(status) {
  if (typeof status !== "string") return false;
  const terminalStatus = process.env.SOURCEFED_JIRA_TERMINAL_STATUS;
  if (!terminalStatus) return false;
  return status.trim().toLowerCase() === terminalStatus.trim().toLowerCase();
}
var TRACKED_CHANGE_FIELDS = /* @__PURE__ */ new Set(["summary", "status", "assignee", "priority", "labels"]);
function meaningfulChangelogItems(items) {
  return items.filter((item) => {
    if (!TRACKED_CHANGE_FIELDS.has(String(item.field))) return false;
    return jiraChangeValue(item, "from") !== jiraChangeValue(item, "to");
  });
}
function jiraChangelogEvent(issueKey, history) {
  const changes = meaningfulChangelogItems(history.items ?? []);
  const items = changes.map(formatJiraChangelogItem).join("; ");
  if (!items) return void 0;
  const terminal = changes.some((item) => item.field === "status" && isTerminalStatus(jiraChangeValue(item, "to")));
  return {
    kind: "changelog",
    id: `history:${history.id ?? history.created ?? items}`,
    issueKey,
    at: history.created ?? (/* @__PURE__ */ new Date()).toISOString(),
    summary: `Jira ${issueKey} ${items}`,
    body: items,
    author: history.author?.displayName,
    actionable: true,
    terminal
  };
}
function appendJiraChangelog(issueKey, cursor, events, histories) {
  const total = histories.length;
  if (cursor.changelogCount !== 0 && total > cursor.changelogCount) {
    for (const history of histories.slice(cursor.changelogCount)) {
      const event = jiraChangelogEvent(issueKey, history);
      if (event) events.push(event);
    }
  }
  cursor.changelogCount = total;
}
function adfText(node) {
  if (!node || typeof node !== "object") return "";
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) return node.content.map(adfText).join("");
  return "";
}
function appendJiraComments(issueKey, cursor, events, comments) {
  const freshComments = [];
  for (const comment of comments) {
    const id2 = Number(comment.id);
    if (cursor.commentIds.includes(id2)) continue;
    freshComments.push(comment);
  }
  if (cursor.commentIds.length === 0) {
    cursor.commentIds = freshComments.map((comment) => Number(comment.id));
    return;
  }
  for (const comment of freshComments) {
    const body = adfText(comment.body);
    events.push({
      kind: "comment",
      id: `comment:${comment.id}`,
      issueKey,
      at: comment.created ?? (/* @__PURE__ */ new Date()).toISOString(),
      summary: `Jira ${issueKey} comment by ${comment.author?.displayName ?? "someone"}`,
      body,
      author: comment.author?.displayName,
      actionable: true
    });
    cursor.commentIds.push(Number(comment.id));
  }
}
function appendJiraDescription(issueKey, cursor, events, description) {
  let descriptionVersion = "none";
  if (description) descriptionVersion = JSON.stringify(description).slice(0, 40);
  if (cursor.descriptionVersion !== void 0 && descriptionVersion !== cursor.descriptionVersion) {
    events.push({
      kind: "description",
      id: `description:${descriptionVersion}`,
      issueKey,
      at: (/* @__PURE__ */ new Date()).toISOString(),
      summary: `Jira ${issueKey} description updated`,
      body: adfText(description),
      actionable: true
    });
  }
  cursor.descriptionVersion = descriptionVersion;
}
function emptyJiraCursor() {
  return { commentIds: [], descriptionVersion: void 0, changelogCount: 0 };
}
function jiraAuth() {
  const email = process.env.ATLASSIAN_EMAIL;
  const key = process.env.ATLASSIAN_API_KEY;
  if (!email || !key) throw new Error("ATLASSIAN_EMAIL / ATLASSIAN_API_KEY not set");
  return "Basic " + Buffer.from(`${email}:${key}`).toString("base64");
}
var JIRA_BASE = process.env.SOURCEFED_JIRA_BASE_URL;
async function jiraFetch(path22) {
  if (!JIRA_BASE) throw new Error("SOURCEFED_JIRA_BASE_URL is required for Jira monitors");
  const response = await fetch(`${JIRA_BASE}/rest/api/3${path22}`, {
    headers: { Authorization: jiraAuth(), Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`Jira ${response.status} for ${path22}`);
  return response.json();
}
async function pollJira(issueKey, cursorRaw) {
  const parsedCursor = /* @__PURE__ */ safeParse23(JiraCursorSchema, cursorRaw);
  let cursor = emptyJiraCursor();
  if (parsedCursor.success) cursor = parsedCursor.output;
  const events = [];
  const comments = await jiraFetch(`/issue/${issueKey}/comment?maxResults=50&orderBy=-created`);
  appendJiraComments(issueKey, cursor, events, comments.comments ?? []);
  const issue = await jiraFetch(`/issue/${issueKey}?expand=changelog&fields=status,description`);
  const statusName = issue.fields?.status?.name;
  appendJiraDescription(issueKey, cursor, events, issue.fields?.description);
  const changelog = issue.changelog?.histories ?? [];
  appendJiraChangelog(issueKey, cursor, events, changelog);
  return { events, cursor, terminal: isTerminalStatus(statusName) };
}
var jiraPollMonitor = new PollMonitor2({
  run: async (source, cursor) => {
    const result = await pollJira(source.issueKey, cursor);
    return {
      cursor: result.cursor,
      events: result.events.map((event) => toMonitorEvent2(event, source)),
      terminal: result.terminal
    };
  }
});
var JiraMonitor = class extends Monitor2 {
  poll = jiraPollMonitor;
  constructor() {
    super({ type: "jira", schema: JiraSourceSchema });
  }
  key = (source) => `jira:${source.issueKey}`;
  icon = "\u{F0303}";
  label = (source) => source.issueKey;
  detail = (source) => ` ${source.issueKey}`;
  describe = (source) => `Jira ${source.issueKey}`;
  build(input) {
    if (input.issueKey) return { type: "jira", issueKey: input.issueKey };
    return { error: "issueKey is required for a jira monitor" };
  }
};
var store$44;
var DEFAULT_CONFIG4 = {
  lang: void 0,
  message: void 0,
  abortEarly: void 0,
  abortPipeEarly: void 0
};
// @__NO_SIDE_EFFECTS__
function getGlobalConfig4(config$1) {
  if (!config$1 && !store$44) return DEFAULT_CONFIG4;
  return {
    lang: config$1?.lang ?? store$44?.lang,
    message: config$1?.message,
    abortEarly: config$1?.abortEarly ?? store$44?.abortEarly,
    abortPipeEarly: config$1?.abortPipeEarly ?? store$44?.abortPipeEarly
  };
}
var store$34;
// @__NO_SIDE_EFFECTS__
function getGlobalMessage4(lang) {
  return store$34?.get(lang);
}
var store$24;
// @__NO_SIDE_EFFECTS__
function getSchemaMessage4(lang) {
  return store$24?.get(lang);
}
var store$14;
// @__NO_SIDE_EFFECTS__
function getSpecificMessage4(reference, lang) {
  return store$14?.get(reference)?.get(lang);
}
// @__NO_SIDE_EFFECTS__
function _stringify4(input) {
  const type = typeof input;
  if (type === "string") return `"${input}"`;
  if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
  if (type === "object" || type === "function") return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  return type;
}
function _addIssue4(context, label, dataset, config$1, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */ _stringify4(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config$1.lang,
    abortEarly: config$1.abortEarly,
    abortPipeEarly: config$1.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message$1 = other?.message ?? context.message ?? /* @__PURE__ */ getSpecificMessage4(context.reference, issue.lang) ?? (isSchema ? /* @__PURE__ */ getSchemaMessage4(issue.lang) : null) ?? config$1.message ?? /* @__PURE__ */ getGlobalMessage4(issue.lang);
  if (message$1 !== void 0) issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
  if (isSchema) dataset.typed = false;
  if (dataset.issues) dataset.issues.push(issue);
  else dataset.issues = [issue];
}
var _standardCache4 = /* @__PURE__ */ new WeakMap();
// @__NO_SIDE_EFFECTS__
function _getStandardProps4(context) {
  let cached = _standardCache4.get(context);
  if (!cached) {
    cached = {
      version: 1,
      vendor: "valibot",
      validate(value$1) {
        return context["~run"]({ value: value$1 }, /* @__PURE__ */ getGlobalConfig4());
      }
    };
    _standardCache4.set(context, cached);
  }
  return cached;
}
var EMOJI_REGEX4 = new RegExp("^(?:[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation}))*)+$", "u");
// @__NO_SIDE_EFFECTS__
function getFallback4(schema, dataset, config$1) {
  return typeof schema.fallback === "function" ? schema.fallback(dataset, config$1) : schema.fallback;
}
// @__NO_SIDE_EFFECTS__
function getDefault4(schema, dataset, config$1) {
  return typeof schema.default === "function" ? schema.default(dataset, config$1) : schema.default;
}
// @__NO_SIDE_EFFECTS__
function array4(item, message$1) {
  return {
    kind: "schema",
    type: "array",
    reference: array4,
    expects: "Array",
    async: false,
    item,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps4(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (Array.isArray(input)) {
        dataset.typed = true;
        dataset.value = [];
        for (let key = 0; key < input.length; key++) {
          const value$1 = input[key];
          const itemDataset = this.item["~run"]({ value: value$1 }, config$1);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value$1
            };
            for (const issue of itemDataset.issues) {
              if (issue.path) issue.path.unshift(pathItem);
              else issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) dataset.issues = itemDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed) dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
      } else _addIssue4(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function boolean3(message$1) {
  return {
    kind: "schema",
    type: "boolean",
    reference: boolean3,
    expects: "boolean",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps4(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "boolean") dataset.typed = true;
      else _addIssue4(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function object4(entries$1, message$1) {
  return {
    kind: "schema",
    type: "object",
    reference: object4,
    expects: "Object",
    async: false,
    entries: entries$1,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps4(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== void 0) {
            const value$1 = key in input ? input[key] : /* @__PURE__ */ getDefault4(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value$1 }, config$1);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value$1
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);
                else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config$1.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0) dataset.value[key] = /* @__PURE__ */ getFallback4(valueSchema);
          else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
            _addIssue4(this, "key", dataset, config$1, {
              input: void 0,
              expected: `"${key}"`,
              path: [{
                type: "object",
                origin: "key",
                input,
                key,
                value: input[key]
              }]
            });
            if (config$1.abortEarly) break;
          }
        }
      } else _addIssue4(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function optional4(wrapped, default_) {
  return {
    kind: "schema",
    type: "optional",
    reference: optional4,
    expects: `(${wrapped.expects} | undefined)`,
    async: false,
    wrapped,
    default: default_,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps4(this);
    },
    "~run"(dataset, config$1) {
      if (dataset.value === void 0) {
        if (this.default !== void 0) dataset.value = /* @__PURE__ */ getDefault4(this, dataset, config$1);
        if (dataset.value === void 0) {
          dataset.typed = true;
          return dataset;
        }
      }
      return this.wrapped["~run"](dataset, config$1);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function string4(message$1) {
  return {
    kind: "schema",
    type: "string",
    reference: string4,
    expects: "string",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps4(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "string") dataset.typed = true;
      else _addIssue4(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function unknown3() {
  return {
    kind: "schema",
    type: "unknown",
    reference: unknown3,
    expects: "unknown",
    async: false,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps4(this);
    },
    "~run"(dataset) {
      dataset.typed = true;
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function safeParse4(schema, input, config$1) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig4(config$1));
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues
  };
}
var Monitor3 = class {
  type;
  schema;
  poll;
  webhook;
  constructor(options) {
    this.type = options.type;
    this.schema = options.schema;
  }
  validateSource(source) {
    const result = /* @__PURE__ */ safeParse4(this.schema, source);
    if (result.success) return result.output;
    throw new Error(`invalid ${this.type} monitor source`);
  }
  initialDelivery(source) {
    this.validateSource(source);
    if (this.webhook && this.webhook.preferred && this.webhook.configured()) return "webhook";
    if (this.poll) return "poll";
    if (this.webhook) return "webhook";
    throw new Error(`source ${this.type} has no configured transport`);
  }
  resolveDelivery(monitor) {
    let webhookHealthy = false;
    if (this.webhook) webhookHealthy = this.webhook.isHealthy(monitor);
    if (monitor.delivery === "webhook") {
      if (this.webhook && webhookHealthy) return "webhook";
      if (this.poll) return "poll";
      if (this.webhook) return "webhook";
      return void 0;
    }
    if (this.webhook && webhookHealthy) return "webhook";
    if (this.poll) return "poll";
    if (this.webhook) return "webhook";
    return void 0;
  }
  async tick(context, record2) {
    const fresh = await context.service.get(record2.id);
    if (!fresh || !fresh.enabled) return 0;
    if (this.webhook) await this.webhook.retryPending(context, this, fresh);
    const current = await context.service.get(record2.id);
    if (!current || !current.enabled) return 0;
    const nextDelivery = this.resolveDelivery(current);
    if (!nextDelivery) return 0;
    if (nextDelivery !== current.delivery) {
      await context.service.setDelivery(current.id, nextDelivery);
      current.delivery = nextDelivery;
    }
    if (current.delivery !== "poll" || !this.poll) return 0;
    const lastAttemptAt = Number(current.cursors.__lastAttemptAt ?? current.cursors.__lastPolledAt ?? 0);
    const pollIntervalSec = current.pollIntervalSec || 60;
    if (lastAttemptAt && Date.now() - lastAttemptAt < pollIntervalSec * 1e3) return 0;
    return this.poll.run(context, this, current);
  }
  async deliver(context, record2, event, deliveryId) {
    if (!this.webhook) return 0;
    return this.webhook.deliver(context, this, record2, event, deliveryId);
  }
  unresponsive(record2, now = Date.now()) {
    if (!record2.enabled) return false;
    if (record2.delivery === "poll") {
      if (!this.poll) return true;
      return this.poll.isUnresponsive(record2, now);
    }
    if (!this.webhook) return true;
    return this.webhook.isUnresponsive(record2, now);
  }
};
var RoutedEventCursorSchema3 = /* @__PURE__ */ array4(/* @__PURE__ */ string4());
function eventDeliveryId3(event) {
  if (event.id) return event.id;
  return `${event.kind}:${event.at}:${event.summary}`;
}
var activePolls3 = /* @__PURE__ */ new Set();
var PollMonitor3 = class {
  constructor(options) {
    this.options = options;
  }
  async run(context, source, record2) {
    if (activePolls3.has(record2.id)) return 0;
    activePolls3.add(record2.id);
    try {
      const fresh = await context.service.get(record2.id);
      if (!fresh) return 0;
      const sourceRecord = source.validateSource(fresh.source);
      const cursorKey = source.key(sourceRecord);
      const result = await this.options.run(sourceRecord, fresh.cursors[cursorKey]);
      const current = await context.service.get(record2.id);
      if (!current || !current.enabled) return 0;
      const parsedRoutedIds = /* @__PURE__ */ safeParse4(RoutedEventCursorSchema3, fresh.cursors.__routedEventIds);
      let routedIds = [];
      if (parsedRoutedIds.success) routedIds = parsedRoutedIds.output;
      let routeFailed = false;
      for (const event of result.events) {
        const eventId = eventDeliveryId3(event);
        if (routedIds.includes(eventId)) continue;
        const routed = await context.sink.deliver({ monitor: fresh, event });
        if (!routed.ok) {
          routeFailed = true;
          console.error(`[sourcefed] route failed for ${fresh.id}: ${routed.error}`);
          continue;
        }
        if (!routedIds.includes(eventId)) routedIds.push(eventId);
      }
      if (routeFailed) {
        await context.service.updateCursor(fresh, "__routedEventIds", routedIds);
        return 0;
      }
      await context.service.updateCursorValue(fresh, cursorKey, (current2) => {
        if (this.options.mergeCursor) return this.options.mergeCursor(current2, result.cursor);
        return result.cursor;
      });
      await context.service.updateCursor(fresh, "__routedEventIds", []);
      if (result.terminal) await context.service.remove(fresh.id);
      await context.service.updateCursor(fresh, "__lastPolledAt", Date.now());
      return result.events.length;
    } finally {
      activePolls3.delete(record2.id);
    }
  }
  isUnresponsive(record2, now) {
    const intervalMs = Math.max((record2.pollIntervalSec || 60) * 3e3, 12e4);
    const lastPolledAt = Number(record2.cursors.__lastPolledAt ?? 0);
    if (lastPolledAt > 0) return now - lastPolledAt > intervalMs;
    return now - Date.parse(record2.createdAt) > intervalMs;
  }
};
var WEBHOOK_STALE_MS2 = 9e4;
var WEBHOOK_STARTUP_GRACE_MS2 = 12e4;
var PendingWebhookEventSchema2 = /* @__PURE__ */ object4({
  deliveryId: /* @__PURE__ */ string4(),
  event: /* @__PURE__ */ object4({
    source: /* @__PURE__ */ unknown3(),
    kind: /* @__PURE__ */ string4(),
    id: /* @__PURE__ */ optional4(/* @__PURE__ */ string4()),
    at: /* @__PURE__ */ string4(),
    summary: /* @__PURE__ */ string4(),
    body: /* @__PURE__ */ optional4(/* @__PURE__ */ string4()),
    actionable: /* @__PURE__ */ boolean3(),
    terminal: /* @__PURE__ */ optional4(/* @__PURE__ */ boolean3())
  })
});
var PendingWebhookEventsSchema2 = /* @__PURE__ */ array4(PendingWebhookEventSchema2);
var pendingDeliveries2 = /* @__PURE__ */ new Set();
var PENDING_WEBHOOK_EVENTS2 = "__pendingWebhookEvents";
var WebhookMonitor2 = class {
  path;
  preferred;
  configured;
  verify;
  acknowledgeBeforeDelivery;
  challenge;
  deliveryId;
  eventName;
  parse;
  updateCursor;
  constructor(options) {
    this.path = options.path;
    this.preferred = options.preferred ?? true;
    this.configured = options.configured;
    this.verify = options.verify;
    this.acknowledgeBeforeDelivery = options.acknowledgeBeforeDelivery ?? false;
    this.challenge = options.challenge;
    this.deliveryId = options.deliveryId;
    this.eventName = options.eventName;
    this.parse = options.parse;
    this.updateCursor = options.updateCursor;
  }
  isHealthy(record2) {
    if (!this.preferred || !this.configured()) return false;
    const heartbeatAt = Number(record2.cursors.__webhookHeartbeatAt ?? 0);
    if (heartbeatAt > 0) return Date.now() - heartbeatAt <= WEBHOOK_STALE_MS2;
    return Date.now() - Date.parse(record2.createdAt) <= WEBHOOK_STARTUP_GRACE_MS2;
  }
  isUnresponsive(record2, now) {
    const heartbeatAt = Number(record2.cursors.__webhookHeartbeatAt ?? 0);
    if (heartbeatAt > 0) return now - heartbeatAt > WEBHOOK_STALE_MS2;
    return now - Date.parse(record2.createdAt) > WEBHOOK_STARTUP_GRACE_MS2;
  }
  async retryPending(context, source, record2) {
    const fresh = await context.service.get(record2.id);
    if (!fresh || !fresh.enabled) return 0;
    const parsed = /* @__PURE__ */ safeParse4(PendingWebhookEventsSchema2, fresh.cursors[PENDING_WEBHOOK_EVENTS2]);
    if (!parsed.success) return 0;
    let delivered = 0;
    for (const pending of parsed.output) {
      const current = await context.service.get(record2.id);
      if (!current || !current.enabled) break;
      const cursorKey = `webhook:${pending.deliveryId}`;
      if (current.cursors[cursorKey]) {
        await this.removePending(context, current, pending.deliveryId);
        continue;
      }
      delivered += await this.deliver(context, source, current, pending.event, pending.deliveryId);
    }
    return delivered;
  }
  async addPending(context, monitor, deliveryId, event) {
    await context.service.updateCursorValue(monitor, PENDING_WEBHOOK_EVENTS2, (cursor) => {
      const parsed = /* @__PURE__ */ safeParse4(PendingWebhookEventsSchema2, cursor);
      let pending = [];
      if (parsed.success) pending = parsed.output;
      if (pending.some((entry) => entry.deliveryId === deliveryId)) return pending;
      pending.push({ deliveryId, event });
      return pending;
    });
  }
  async removePending(context, monitor, deliveryId) {
    await context.service.updateCursorValue(monitor, PENDING_WEBHOOK_EVENTS2, (cursor) => {
      const parsed = /* @__PURE__ */ safeParse4(PendingWebhookEventsSchema2, cursor);
      if (!parsed.success) return [];
      return parsed.output.filter((entry) => entry.deliveryId !== deliveryId);
    });
  }
  async deliver(context, source, record2, event, deliveryId) {
    const fresh = await context.service.get(record2.id);
    if (!fresh || !fresh.enabled) return 0;
    const freshSource = source.validateSource(fresh.source);
    const eventSource = source.validateSource(event.source);
    if (source.key(freshSource) !== source.key(eventSource)) return 0;
    if (event.kind === "ci" && !event.actionable) return 0;
    const cursorKey = `webhook:${deliveryId}`;
    const reservationKey = `${fresh.id}:${deliveryId}`;
    if (pendingDeliveries2.has(reservationKey)) return 0;
    if (fresh.cursors[cursorKey]) {
      await this.removePending(context, fresh, deliveryId);
      return 0;
    }
    pendingDeliveries2.add(reservationKey);
    try {
      await this.addPending(context, fresh, deliveryId, event);
      if (this.updateCursor) {
        const sourceCursorKey = source.key(freshSource);
        await context.service.updateCursorValue(fresh, sourceCursorKey, (cursor) => this.updateCursor(event, cursor));
      }
      const result = await context.sink.deliver({ monitor: fresh, event });
      if (!result.ok) {
        console.error(`[sourcefed] webhook route failed for ${fresh.id}: ${result.error}`);
        return 0;
      }
      await context.service.setDelivery(fresh.id, "webhook");
      await context.service.updateCursor(fresh, cursorKey, true);
      await this.removePending(context, fresh, deliveryId);
      if (event.terminal) await context.service.remove(fresh.id);
      return 1;
    } finally {
      pendingDeliveries2.delete(reservationKey);
    }
  }
};
var MAX_WEBHOOK_BODY_BYTES4 = 1024 * 1024;
function toMonitorEvent3(event, source) {
  return {
    source,
    kind: event.kind,
    id: event.id,
    at: event.at,
    summary: event.summary,
    body: event.body,
    actionable: event.actionable,
    terminal: event.terminal
  };
}
var store$424;
var DEFAULT_CONFIG24 = {
  lang: void 0,
  message: void 0,
  abortEarly: void 0,
  abortPipeEarly: void 0
};
// @__NO_SIDE_EFFECTS__
function getGlobalConfig24(config$1) {
  if (!config$1 && !store$424) return DEFAULT_CONFIG24;
  return {
    lang: config$1?.lang ?? store$424?.lang,
    message: config$1?.message,
    abortEarly: config$1?.abortEarly ?? store$424?.abortEarly,
    abortPipeEarly: config$1?.abortPipeEarly ?? store$424?.abortPipeEarly
  };
}
var store$324;
// @__NO_SIDE_EFFECTS__
function getGlobalMessage24(lang) {
  return store$324?.get(lang);
}
var store$224;
// @__NO_SIDE_EFFECTS__
function getSchemaMessage24(lang) {
  return store$224?.get(lang);
}
var store$124;
// @__NO_SIDE_EFFECTS__
function getSpecificMessage24(reference, lang) {
  return store$124?.get(reference)?.get(lang);
}
// @__NO_SIDE_EFFECTS__
function _stringify24(input) {
  const type = typeof input;
  if (type === "string") return `"${input}"`;
  if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
  if (type === "object" || type === "function") return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  return type;
}
function _addIssue24(context, label, dataset, config$1, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */ _stringify24(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config$1.lang,
    abortEarly: config$1.abortEarly,
    abortPipeEarly: config$1.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message$1 = other?.message ?? context.message ?? /* @__PURE__ */ getSpecificMessage24(context.reference, issue.lang) ?? (isSchema ? /* @__PURE__ */ getSchemaMessage24(issue.lang) : null) ?? config$1.message ?? /* @__PURE__ */ getGlobalMessage24(issue.lang);
  if (message$1 !== void 0) issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
  if (isSchema) dataset.typed = false;
  if (dataset.issues) dataset.issues.push(issue);
  else dataset.issues = [issue];
}
var _standardCache24 = /* @__PURE__ */ new WeakMap();
// @__NO_SIDE_EFFECTS__
function _getStandardProps24(context) {
  let cached = _standardCache24.get(context);
  if (!cached) {
    cached = {
      version: 1,
      vendor: "valibot",
      validate(value$1) {
        return context["~run"]({ value: value$1 }, /* @__PURE__ */ getGlobalConfig24());
      }
    };
    _standardCache24.set(context, cached);
  }
  return cached;
}
var EMOJI_REGEX24 = new RegExp("^(?:[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|(?![\\p{Emoji_Modifier_Base}\\u{1F1E6}-\\u{1F1FF}])\\p{Emoji_Presentation}))*)+$", "u");
// @__NO_SIDE_EFFECTS__
function getFallback23(schema, dataset, config$1) {
  return typeof schema.fallback === "function" ? schema.fallback(dataset, config$1) : schema.fallback;
}
// @__NO_SIDE_EFFECTS__
function getDefault23(schema, dataset, config$1) {
  return typeof schema.default === "function" ? schema.default(dataset, config$1) : schema.default;
}
// @__NO_SIDE_EFFECTS__
function array24(item, message$1) {
  return {
    kind: "schema",
    type: "array",
    reference: array24,
    expects: "Array",
    async: false,
    item,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps24(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (Array.isArray(input)) {
        dataset.typed = true;
        dataset.value = [];
        for (let key = 0; key < input.length; key++) {
          const value$1 = input[key];
          const itemDataset = this.item["~run"]({ value: value$1 }, config$1);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value$1
            };
            for (const issue of itemDataset.issues) {
              if (issue.path) issue.path.unshift(pathItem);
              else issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) dataset.issues = itemDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed) dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
      } else _addIssue24(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function boolean23(message$1) {
  return {
    kind: "schema",
    type: "boolean",
    reference: boolean23,
    expects: "boolean",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps24(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "boolean") dataset.typed = true;
      else _addIssue24(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function literal3(literal_, message$1) {
  return {
    kind: "schema",
    type: "literal",
    reference: literal3,
    expects: /* @__PURE__ */ _stringify24(literal_),
    async: false,
    literal: literal_,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps24(this);
    },
    "~run"(dataset, config$1) {
      if (dataset.value === this.literal) dataset.typed = true;
      else _addIssue24(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function object23(entries$1, message$1) {
  return {
    kind: "schema",
    type: "object",
    reference: object23,
    expects: "Object",
    async: false,
    entries: entries$1,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps24(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== void 0) {
            const value$1 = key in input ? input[key] : /* @__PURE__ */ getDefault23(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value$1 }, config$1);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value$1
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);
                else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config$1.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0) dataset.value[key] = /* @__PURE__ */ getFallback23(valueSchema);
          else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
            _addIssue24(this, "key", dataset, config$1, {
              input: void 0,
              expected: `"${key}"`,
              path: [{
                type: "object",
                origin: "key",
                input,
                key,
                value: input[key]
              }]
            });
            if (config$1.abortEarly) break;
          }
        }
      } else _addIssue24(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function optional22(wrapped, default_) {
  return {
    kind: "schema",
    type: "optional",
    reference: optional22,
    expects: `(${wrapped.expects} | undefined)`,
    async: false,
    wrapped,
    default: default_,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps24(this);
    },
    "~run"(dataset, config$1) {
      if (dataset.value === void 0) {
        if (this.default !== void 0) dataset.value = /* @__PURE__ */ getDefault23(this, dataset, config$1);
        if (dataset.value === void 0) {
          dataset.typed = true;
          return dataset;
        }
      }
      return this.wrapped["~run"](dataset, config$1);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function string24(message$1) {
  return {
    kind: "schema",
    type: "string",
    reference: string24,
    expects: "string",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps24(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "string") dataset.typed = true;
      else _addIssue24(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function safeParse24(schema, input, config$1) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig24(config$1));
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues
  };
}
var SlackSourceSchema = /* @__PURE__ */ object23({
  type: /* @__PURE__ */ literal3("slack"),
  channelId: /* @__PURE__ */ string24(),
  threadTs: /* @__PURE__ */ string24()
});
var SlackCursorSchema = /* @__PURE__ */ object23({
  primed: /* @__PURE__ */ boolean23(),
  messageIds: /* @__PURE__ */ array24(/* @__PURE__ */ string24()),
  latestTs: /* @__PURE__ */ optional22(/* @__PURE__ */ string24())
});
function messageTimestamp(ts) {
  const value = Number(ts ?? 0);
  if (Number.isFinite(value)) return value;
  return 0;
}
function messageAt(ts) {
  const value = messageTimestamp(ts);
  if (value > 0) return new Date(value * 1e3).toISOString();
  return (/* @__PURE__ */ new Date()).toISOString();
}
function parseSlackReadResult(result, cursorRaw) {
  const parsedCursor = /* @__PURE__ */ safeParse24(SlackCursorSchema, cursorRaw);
  let previous = {};
  if (parsedCursor.success) previous = parsedCursor.output;
  const cursor = {
    primed: previous.primed ?? false,
    messageIds: previous.messageIds ?? [],
    latestTs: previous.latestTs
  };
  const users = new Map((result.users ?? []).map((user) => [user.id, user.real_name ?? user.name ?? user.id ?? "someone"]));
  const messages = (result.messages ?? []).filter((message) => message.ts);
  const freshMessages = messages.filter((message) => {
    if (cursor.messageIds.includes(message.ts)) return false;
    if (!cursor.latestTs) return true;
    return messageTimestamp(message.ts) > messageTimestamp(cursor.latestTs);
  });
  let events = [];
  if (cursor.primed) {
    events = freshMessages.map((message) => {
      let text = "[message without text]";
      if (message.text?.trim()) text = message.text.trim();
      let author = users.get(message.user);
      if (!author) author = message.user;
      if (!author) author = "someone";
      return {
        kind: "message",
        id: `message:${message.ts}`,
        at: messageAt(message.ts),
        summary: `Slack thread message by ${author}`,
        body: text,
        actionable: true
      };
    });
  }
  cursor.primed = true;
  cursor.messageIds = [.../* @__PURE__ */ new Set([...cursor.messageIds, ...messages.map((message) => message.ts)])].slice(-500);
  let latestTs = cursor.latestTs;
  for (const message of messages) {
    if (messageTimestamp(message.ts) > messageTimestamp(latestTs)) latestTs = message.ts;
  }
  cursor.latestTs = latestTs;
  return { events, cursor };
}
var SLACK_API = "https://slack.com/api";
var warnedMissingToken2 = false;
function slackToken() {
  return process.env.SOURCEFED_SLACK_TOKEN;
}
async function fetchSlackThread(channelId, threadTs) {
  const messages = [];
  let cursor = "";
  let received = false;
  do {
    const page = await slackApi("conversations.replies", {
      channel: channelId,
      ts: threadTs,
      limit: "1000",
      inclusive: "false",
      ...cursor ? { cursor } : {}
    });
    if (!page) break;
    received = true;
    if (Array.isArray(page.messages)) messages.push(...page.messages);
    cursor = page.response_metadata?.next_cursor ?? "";
    if (messages.length >= 1e4) break;
  } while (cursor);
  if (!received) return void 0;
  const users = [];
  let usersCursor = "";
  do {
    const page = await slackApi("users.list", { limit: "200", ...usersCursor ? { cursor: usersCursor } : {} });
    if (!page) break;
    if (Array.isArray(page.members)) {
      users.push(...page.members.map((member) => ({
        id: member.id,
        name: member.name,
        real_name: member.real_name
      })));
    }
    usersCursor = page.response_metadata?.next_cursor ?? "";
  } while (usersCursor);
  const result = { messages, users };
  return result;
}
async function slackApi(method, params) {
  const token = slackToken();
  if (!token) {
    if (!warnedMissingToken2) {
      warnedMissingToken2 = true;
      console.warn("[sourcefed] SOURCEFED_SLACK_TOKEN is not set; Slack monitors will not poll");
    }
    return void 0;
  }
  try {
    const response = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params)
    });
    const result = await response.json();
    if (!response.ok || result?.ok !== true) return void 0;
    return result;
  } catch {
    return void 0;
  }
}
async function pollSlack(source, cursorRaw) {
  const result = await fetchSlackThread(source.channelId, source.threadTs);
  if (!result) throw new Error("slack API request failed; check SOURCEFED_SLACK_TOKEN");
  const parsed = parseSlackReadResult(result, cursorRaw);
  return { ...parsed, terminal: false };
}
var slackPollMonitor = new PollMonitor3({
  run: async (source, cursor) => {
    const result = await pollSlack(source, cursor);
    return {
      cursor: result.cursor,
      events: result.events.map((event) => toMonitorEvent3(event, source)),
      terminal: result.terminal
    };
  }
});
function parseSlackWebhook(payload, _eventName, deliveryId) {
  const event = payload.event;
  const channelId = event?.channel;
  const threadTs = event?.thread_ts;
  if (payload.type !== "event_callback" || event?.type !== "message" || !channelId || !threadTs) return void 0;
  let text = "[message without text]";
  if (event.text?.trim()) text = event.text.trim();
  let author = event.username;
  if (!author) author = event.user;
  if (!author) author = event.bot_id;
  if (!author) author = "someone";
  let at = messageAt(event.event_ts);
  if (!event.event_ts) at = messageAt(event.ts);
  return {
    source: { type: "slack", channelId, threadTs },
    kind: "message",
    id: event.ts === void 0 ? void 0 : `message:${event.ts}`,
    at,
    summary: `Slack thread message by ${author}`,
    body: `${text}

Slack event: ${deliveryId}`,
    actionable: true
  };
}
function slackSignature(body, timestamp, secret) {
  return `v0=${createHmac2("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
}
function validSlackSignature(body, request, secret = process.env.SOURCEFED_SLACK_SIGNING_SECRET) {
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  const timestampValue = Number(timestamp);
  if (!timestamp || !signature || !secret || !Number.isFinite(timestampValue) || Math.abs(Date.now() / 1e3 - timestampValue) > 300) return false;
  const expected = slackSignature(body, timestamp, secret);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual2(actual, wanted);
}
function updateSlackCursor(event, cursorRaw) {
  const parsed = /* @__PURE__ */ safeParse24(SlackCursorSchema, cursorRaw);
  let cursor = { primed: false, messageIds: [], latestTs: void 0 };
  if (parsed.success) cursor = parsed.output;
  if (event.id?.startsWith("message:")) {
    const messageId = event.id.slice("message:".length);
    if (!cursor.messageIds.includes(messageId)) cursor.messageIds.push(messageId);
    if (messageTimestamp(messageId) > messageTimestamp(cursor.latestTs)) cursor.latestTs = messageId;
  }
  cursor.primed = true;
  return cursor;
}
var slackWebhookMonitor = new WebhookMonitor2({
  path: "/webhooks/slack",
  preferred: true,
  configured: () => Boolean(process.env.SOURCEFED_SLACK_SIGNING_SECRET),
  verify: (body, request) => validSlackSignature(body, request),
  acknowledgeBeforeDelivery: true,
  challenge: (payload) => {
    if (payload.type === "url_verification" && payload.challenge) return { challenge: payload.challenge };
    return void 0;
  },
  deliveryId: (_request, payload) => payload.event_id,
  eventName: () => "slack",
  parse: parseSlackWebhook,
  updateCursor: updateSlackCursor
});
var SlackMonitor = class extends Monitor3 {
  poll = slackPollMonitor;
  webhook = slackWebhookMonitor;
  constructor() {
    super({ type: "slack", schema: SlackSourceSchema });
  }
  key = (source) => `slack:${source.channelId}#${source.threadTs}`;
  icon = "\u{F04B1}";
  label = () => "thread";
  detail = (source) => ` ${source.channelId}`;
  describe = (source) => `Slack ${source.channelId} thread ${source.threadTs}`;
  build(input) {
    if (input.channelId && input.threadTs) return { type: "slack", channelId: input.channelId, threadTs: input.threadTs };
    if (!input.threadUrl) return { error: "channelId + threadTs or threadUrl is required for a slack monitor" };
    let url;
    try {
      url = new URL(input.threadUrl);
    } catch {
      return { error: "threadUrl must be a valid Slack URL" };
    }
    const channelId = url.pathname.match(/\/archives\/([^/]+)/)?.[1];
    const pathTimestamp = url.pathname.match(/\/p(\d{10,})/)?.[1];
    let threadTs = url.searchParams.get("thread_ts") ?? void 0;
    if (!threadTs && pathTimestamp) threadTs = `${pathTimestamp.slice(0, -6)}.${pathTimestamp.slice(-6)}`;
    if (channelId && threadTs) return { type: "slack", channelId, threadTs };
    return { error: "threadUrl does not contain a Slack channel and thread timestamp" };
  }
};
var SOURCE_MAP = {
  jira: new JiraMonitor(),
  github: new GithubMonitor(),
  slack: new SlackMonitor()
};
var SOURCE_TYPES = Object.keys(SOURCE_MAP);
var RequestRouter = class {
  pending = /* @__PURE__ */ new Map();
  cursor = 1;
  nextID() {
    return this.cursor++;
  }
  register(id2) {
    return new Promise((resolve, reject) => {
      this.pending.set(id2, { resolve, reject });
    });
  }
  settle(id2, frame) {
    const pending = this.pending.get(id2);
    if (!pending) return;
    this.pending.delete(id2);
    if (frame.error) pending.reject(new Error(frame.error));
    else pending.resolve(frame.result);
  }
  rejectAll(error) {
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
  }
};
function defaultDaemonUrl() {
  const port = process.env.SOURCEFED_DAEMON_PORT ?? 18787;
  return `http://127.0.0.1:${port}`;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function withTimeout(promise, ms, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function encodeTarget(target) {
  return Buffer.from(JSON.stringify(target), "utf8").toString("base64url");
}
function targetKey(target) {
  return JSON.stringify(target);
}
function parseDaemonFrame(line) {
  try {
    return JSON.parse(line);
  } catch {
    return void 0;
  }
}
async function connectDaemonClient(options) {
  const url = options.url ?? process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl();
  return new HttpDaemonClient(url, options.token ?? process.env.SOURCEFED_DAEMON_TOKEN);
}
var HttpDaemonClient = class {
  baseURL;
  token;
  router = new RequestRouter();
  listeners = /* @__PURE__ */ new Map();
  streams = /* @__PURE__ */ new Set();
  constructor(baseURL, token) {
    this.baseURL = baseURL.replace(/\/+$/, "");
    this.token = token;
  }
  headers() {
    return this.token ? { authorization: `Bearer ${this.token}` } : {};
  }
  async request(method, params) {
    const id2 = this.router.nextID();
    const promise = this.router.register(id2);
    try {
      const response = await fetch(`${this.baseURL}/rpc`, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.headers() },
        body: JSON.stringify({ id: id2, method, params })
      });
      const frame = await response.json();
      if (!response.ok || frame.error) throw new Error(frame.error ?? `daemon request failed: ${response.status}`);
      this.router.settle(id2, { result: frame.result });
    } catch (error) {
      this.router.settle(id2, { error: error instanceof Error ? error.message : String(error) });
    }
    return promise;
  }
  async subscribe(target, onEvents) {
    const key = targetKey(target);
    let callbacks = this.listeners.get(key);
    if (!callbacks) {
      callbacks = /* @__PURE__ */ new Set();
      this.listeners.set(key, callbacks);
    }
    callbacks.add(onEvents);
    const controller = new AbortController();
    this.streams.add(controller);
    const url = `${this.baseURL}/events?target=${encodeTarget(target)}`;
    let markSubscribed;
    const subscribed = new Promise((resolve) => {
      markSubscribed = () => resolve();
    });
    let drainComplete = false;
    let draining = false;
    let redrainRequested = false;
    let retryTimer;
    let markDrained;
    const drained = new Promise((resolve) => {
      markDrained = resolve;
    });
    let buffered = [];
    let delivering = Promise.resolve();
    const deliver = (events) => {
      if (!callbacks?.has(onEvents) || events.length === 0) return Promise.resolve();
      delivering = delivering.then(() => deliverWithRetry(events, 0)).catch((error) => {
        console.error(`[sourcefed] event delivery failed: ${error instanceof Error ? error.message : String(error)}`);
      });
      return delivering;
    };
    const deliverWithRetry = async (events, attempt) => {
      try {
        await onEvents(events);
      } catch (error) {
        if (attempt >= 2) {
          console.error(`[sourcefed] event delivery failed after retries; re-draining queue: ${error instanceof Error ? error.message : String(error)}`);
          redrainRequested = true;
          void performDrain();
          return;
        }
        await sleep(250 * (attempt + 1));
        await deliverWithRetry(events, attempt + 1);
      }
    };
    const performDrain = async () => {
      if (draining) {
        redrainRequested = true;
        return;
      }
      draining = true;
      try {
        let passes = 0;
        do {
          redrainRequested = false;
          passes += 1;
          try {
            const drainResult = await this.request("monitor.events", { target });
            drainComplete = true;
            const drainedIds = new Set((drainResult.events ?? []).map((event) => event.id));
            if (drainResult.events && drainResult.events.length > 0) await deliver(drainResult.events);
            for (const batch of buffered) {
              const fresh = batch.filter((event) => !drainedIds.has(event.id));
              if (fresh.length > 0) await deliver(fresh);
            }
            buffered = [];
            markDrained();
          } catch (error) {
            console.error(`[sourcefed] event drain failed: ${error instanceof Error ? error.message : String(error)}`);
            redrainRequested = true;
          }
        } while (redrainRequested && passes < 3);
        if (redrainRequested) markDrained();
      } finally {
        draining = false;
      }
    };
    const runStream = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, headers: this.headers() });
        if (!response.ok || !response.body) throw new Error(`event stream failed: ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const chunk of frames) {
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const frame = parseDaemonFrame(line.slice(6));
              if (!frame || !("type" in frame)) continue;
              if (frame.type === "subscribed") {
                markSubscribed();
                drainComplete = false;
                void performDrain();
              }
              if (frame.type === "event") {
                if (drainComplete) void deliver(frame.events);
                else buffered.push(frame.events);
              }
            }
          }
        }
        consecutiveFailures = 0;
      } catch (error) {
        if (!controller.signal.aborted) {
          consecutiveFailures += 1;
          if (consecutiveFailures === 1) {
            console.error(`[sourcefed] event stream ended: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    };
    let consecutiveFailures = 0;
    void (async () => {
      while (!controller.signal.aborted && callbacks?.has(onEvents)) {
        await runStream();
        if (controller.signal.aborted) break;
        await sleep(500);
      }
    })();
    try {
      await withTimeout(subscribed, 15e3, `sourcefed event stream did not subscribe at ${url}`);
      await withTimeout(drained, 15e3, "sourcefed initial event drain timed out");
    } catch (error) {
      if (retryTimer) clearTimeout(retryTimer);
      const callbacks2 = this.listeners.get(key);
      callbacks2?.delete(onEvents);
      if (callbacks2 && callbacks2.size === 0) this.listeners.delete(key);
      controller.abort();
      this.streams.delete(controller);
      throw error;
    }
    return {
      close: async () => {
        if (retryTimer) clearTimeout(retryTimer);
        const callbacks2 = this.listeners.get(key);
        callbacks2?.delete(onEvents);
        if (callbacks2 && callbacks2.size === 0) this.listeners.delete(key);
        controller.abort();
        this.streams.delete(controller);
      }
    };
  }
  async close() {
    for (const controller of this.streams) controller.abort();
    this.streams.clear();
    this.router.rejectAll(new Error("daemon closed"));
    this.listeners.clear();
  }
};

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
    client = await connectDaemonClient({
      name: "sourcefed-opencode-tui",
      url: process.env.SOURCEFED_DAEMON_URL ?? defaultDaemonUrl()
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
