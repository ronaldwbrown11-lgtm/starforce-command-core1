/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as achievements from "../achievements.js";
import type * as admin from "../admin.js";
import type * as aiAssistant from "../aiAssistant.js";
import type * as aiAssistantHelpers from "../aiAssistantHelpers.js";
import type * as arg from "../arg.js";
import type * as assets from "../assets.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as auth_otpRateLimit from "../auth/otpRateLimit.js";
import type * as blog from "../blog.js";
import type * as canonScanner from "../canonScanner.js";
import type * as canonScannerHelpers from "../canonScannerHelpers.js";
import type * as captainLog from "../captainLog.js";
import type * as changelog from "../changelog.js";
import type * as content from "../content.js";
import type * as contests from "../contests.js";
import type * as cronJobs from "../cronJobs.js";
import type * as digest from "../digest.js";
import type * as digestData from "../digestData.js";
import type * as discordBridge from "../discordBridge.js";
import type * as discordBridgeActions from "../discordBridgeActions.js";
import type * as discordBridgeNode from "../discordBridgeNode.js";
import type * as discoveries from "../discoveries.js";
import type * as economy from "../economy.js";
import type * as email from "../email.js";
import type * as events from "../events.js";
import type * as faqs from "../faqs.js";
import type * as fleetRecords from "../fleetRecords.js";
import type * as groupSpace from "../groupSpace.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as loreLibrary from "../loreLibrary.js";
import type * as messages from "../messages.js";
import type * as missions from "../missions.js";
import type * as nighthawk from "../nighthawk.js";
import type * as operator from "../operator.js";
import type * as quest from "../quest.js";
import type * as rateLimit from "../rateLimit.js";
import type * as search from "../search.js";
import type * as sectorMap from "../sectorMap.js";
import type * as seed from "../seed.js";
import type * as seedHelpers from "../seedHelpers.js";
import type * as serviceDossiers from "../serviceDossiers.js";
import type * as signals from "../signals.js";
import type * as siteAppearance from "../siteAppearance.js";
import type * as sitemap from "../sitemap.js";
import type * as social from "../social.js";
import type * as socialLinks from "../socialLinks.js";
import type * as staticCovers from "../staticCovers.js";
import type * as storage from "../storage.js";
import type * as storageHelper from "../storageHelper.js";
import type * as stripe from "../stripe.js";
import type * as stripeWebhook from "../stripeWebhook.js";
import type * as support from "../support.js";
import type * as tiers from "../tiers.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";
import type * as vessels from "../vessels.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  achievements: typeof achievements;
  admin: typeof admin;
  aiAssistant: typeof aiAssistant;
  aiAssistantHelpers: typeof aiAssistantHelpers;
  arg: typeof arg;
  assets: typeof assets;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  "auth/otpRateLimit": typeof auth_otpRateLimit;
  blog: typeof blog;
  canonScanner: typeof canonScanner;
  canonScannerHelpers: typeof canonScannerHelpers;
  captainLog: typeof captainLog;
  changelog: typeof changelog;
  content: typeof content;
  contests: typeof contests;
  cronJobs: typeof cronJobs;
  digest: typeof digest;
  digestData: typeof digestData;
  discordBridge: typeof discordBridge;
  discordBridgeActions: typeof discordBridgeActions;
  discordBridgeNode: typeof discordBridgeNode;
  discoveries: typeof discoveries;
  economy: typeof economy;
  email: typeof email;
  events: typeof events;
  faqs: typeof faqs;
  fleetRecords: typeof fleetRecords;
  groupSpace: typeof groupSpace;
  groups: typeof groups;
  http: typeof http;
  loreLibrary: typeof loreLibrary;
  messages: typeof messages;
  missions: typeof missions;
  nighthawk: typeof nighthawk;
  operator: typeof operator;
  quest: typeof quest;
  rateLimit: typeof rateLimit;
  search: typeof search;
  sectorMap: typeof sectorMap;
  seed: typeof seed;
  seedHelpers: typeof seedHelpers;
  serviceDossiers: typeof serviceDossiers;
  signals: typeof signals;
  siteAppearance: typeof siteAppearance;
  sitemap: typeof sitemap;
  social: typeof social;
  socialLinks: typeof socialLinks;
  staticCovers: typeof staticCovers;
  storage: typeof storage;
  storageHelper: typeof storageHelper;
  stripe: typeof stripe;
  stripeWebhook: typeof stripeWebhook;
  support: typeof support;
  tiers: typeof tiers;
  usage: typeof usage;
  users: typeof users;
  vessels: typeof vessels;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
