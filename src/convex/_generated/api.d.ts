/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as assets from "../assets.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as blog from "../blog.js";
import type * as canonScanner from "../canonScanner.js";
import type * as canonScannerHelpers from "../canonScannerHelpers.js";
import type * as content from "../content.js";
import type * as discoveries from "../discoveries.js";
import type * as email from "../email.js";
import type * as faqs from "../faqs.js";
import type * as groupSpace from "../groupSpace.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as loreLibrary from "../loreLibrary.js";
import type * as messages from "../messages.js";
import type * as missions from "../missions.js";
import type * as nighthawk from "../nighthawk.js";
import type * as operator from "../operator.js";
import type * as search from "../search.js";
import type * as sectorMap from "../sectorMap.js";
import type * as seed from "../seed.js";
import type * as seedHelpers from "../seedHelpers.js";
import type * as siteAppearance from "../siteAppearance.js";
import type * as sitemap from "../sitemap.js";
import type * as social from "../social.js";
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
  admin: typeof admin;
  assets: typeof assets;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  blog: typeof blog;
  canonScanner: typeof canonScanner;
  canonScannerHelpers: typeof canonScannerHelpers;
  content: typeof content;
  discoveries: typeof discoveries;
  email: typeof email;
  faqs: typeof faqs;
  groupSpace: typeof groupSpace;
  groups: typeof groups;
  http: typeof http;
  loreLibrary: typeof loreLibrary;
  messages: typeof messages;
  missions: typeof missions;
  nighthawk: typeof nighthawk;
  operator: typeof operator;
  search: typeof search;
  sectorMap: typeof sectorMap;
  seed: typeof seed;
  seedHelpers: typeof seedHelpers;
  siteAppearance: typeof siteAppearance;
  sitemap: typeof sitemap;
  social: typeof social;
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
